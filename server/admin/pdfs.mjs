import { createHash } from 'node:crypto'
import { supabaseConfig, supabaseSecret } from './supabase.mjs'
import { validatePDF, PDF_LIMIT } from './pdf-validation.mjs'
import { SiteError } from './site.mjs'
const uuid = id => typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
export async function pdfAction({ action,body,token,actor,request,rpc,sessionExpiresAt }) {
  const key = supabaseSecret()
  if (!key?.startsWith('sb_secret_')) throw new SiteError(503,'Service PDF non configuré côté serveur.')
  const service = async (operation,id=null,meta={}) => {
    const r = await request('/rest/v1/rpc/service_pdf',{method:'POST',key,body:{p_action:operation,p_id:id,p_actor:actor,p_meta:meta}})
    if (r.status>=400) {
      if (r.status===403) throw new SiteError(403,'Accès administrateur refusé.')
      if (r.status===409) throw new SiteError(409,operation==='delete-claim'?'Suppression refusée : PDF référencé par une version conservée.':'Validation PDF en cours. Réessayez dans cinq minutes si elle a été interrompue.')
      throw new SiteError(r.status>=500?503:400,'Opération PDF refusée, expirée ou interrompue. Votre brouillon est conservé.')
    }
    return r.data
  }
  const safeURL = path => {
    const url=new URL(path.startsWith('/object/')?'/storage/v1'+path:path,supabaseConfig().url)
    if(url.origin!==supabaseConfig().url)throw new SiteError(503,'Adresse de stockage invalide.')
    return url
  }
  const remove = async(bucket,path)=>{
    const r=await request('/storage/v1/object/'+bucket,{method:'DELETE',key,body:{prefixes:[path]}})
    if(r.status>=300)throw new SiteError(503,'Suppression interrompue. Réessayez.')
    const check=await request(`/storage/v1/object/authenticated/${bucket}/${path}`,{key,binary:true,maxBytes:PDF_LIMIT+1024})
    let missing=check.status===404
    if(check.status===400){try{const error=JSON.parse(check.data.toString());missing=error.error==='not_found'||String(error.statusCode)==='404'}catch{/* No proof of absence. */}}
    if(!missing)throw new SiteError(503,'Suppression non confirmée. Réessayez.')
  }
  if(action==='pdfs')return rpc('admin_pdf_library',{},token)
  if(action==='pdf-begin'){
    if(typeof body.name!=='string'||!body.name.toLowerCase().endsWith('.pdf')||body.name.length>180||!Number.isInteger(body.bytes)||body.bytes<1||body.bytes>PDF_LIMIT)throw new SiteError(413,'Choisissez un PDF de 20 Mio maximum.')
    const i=await rpc('admin_begin_pdf',{p_name:body.name,p_bytes:body.bytes},token)
    const signed=await request('/storage/v1/object/upload/sign/portfolio-pdf-incoming/'+i.incomingKey,{method:'POST',key,body:{}})
    if(signed.status>=300||!signed.data?.url)throw new SiteError(503,'Autorisation de transfert PDF indisponible.')
    const signedURL=safeURL(signed.data.url),signature=signedURL.searchParams.get('token')
    if(!signature||!signedURL.pathname.endsWith('/portfolio-pdf-incoming/'+i.incomingKey))throw new SiteError(503,'Autorisation PDF invalide.')
    return {id:i.id,endpoint:supabaseConfig().url.replace('.supabase.co','.storage.supabase.co')+'/storage/v1/upload/resumable/sign',signature,publishableKey:supabaseConfig().key,bucket:'portfolio-pdf-incoming',objectKey:i.incomingKey}
  }
  if(action==='pdf-cleanup'){
    const entries=await service('cleanup');let cleaned=0
    for(const i of entries){await remove('portfolio-pdf-incoming',i.incomingKey);if(i.finalKey)await remove('portfolio-private',i.finalKey);await service('cleanup-finish',i.id);cleaned++}
    return {cleaned}
  }
  if(!uuid(body.id))throw new SiteError(400,'Identifiant PDF invalide.')
  if(action==='pdf-link'){
    const info=await rpc('admin_pdf_info',{p_id:body.id},token)
    if(!info)throw new SiteError(404,'PDF non validé, supprimé ou introuvable.')
    const filename=body.downloadName||'portfolio-kevin-kilongo-munganga.pdf'
    if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}\.pdf$/.test(filename))throw new SiteError(400,'Nom de téléchargement PDF invalide.')
    const expiresIn=Math.min(120,Math.floor((sessionExpiresAt-Date.now())/1000))
    if(expiresIn<1)throw new SiteError(401,'Votre session a expiré.')
    const r=await request('/storage/v1/object/sign/portfolio-private/'+info.key,{method:'POST',key,body:{expiresIn}})
    if(r.status>=300||!r.data?.signedURL)throw new SiteError(503,'Accès privé au PDF indisponible.')
    const url=safeURL(r.data.signedURL),download=new URL(url)
    download.searchParams.set('download',filename)
    return {previewUrl:url.href,downloadUrl:download.href,bytes:info.bytes,pages:info.pages,expiresIn}
  }
  if(action==='pdf-delete'){
    if(body.confirm!==true)throw new SiteError(400,'Confirmation de suppression requise.')
    const item=await service('delete-claim',body.id);await remove('portfolio-private',item.key);await service('delete-finish',body.id)
    return {deleted:true}
  }
  const i=await service('claim',body.id)
  if(i.state==='ready'){const metadata=await rpc('admin_pdf_info',{p_id:i.media_id},token);if(!metadata)throw new SiteError(404,'PDF introuvable.');return {id:metadata.id,bytes:metadata.bytes,pages:metadata.pages}}
  try{
    const raw=await request('/storage/v1/object/authenticated/portfolio-pdf-incoming/'+i.incoming_key,{key,binary:true,maxBytes:PDF_LIMIT+1024})
    if(raw.status!==200)throw new SiteError(503,'Le transfert PDF est absent ou incomplet. Réessayez sans fermer votre brouillon.')
    const result=await validatePDF(raw.data,i.declared_bytes)
    const saved=await request('/storage/v1/object/portfolio-private/'+i.final_key,{method:'POST',key,mime:'application/pdf',body:raw.data})
    if(saved.status>=300){const previous=await request('/storage/v1/object/authenticated/portfolio-private/'+i.final_key,{key,binary:true,maxBytes:PDF_LIMIT+1024});if(previous.status!==200||createHash('sha256').update(previous.data).digest('hex')!==result.sha)throw new SiteError(503,'Enregistrement PDF interrompu. Réessayez.')}
    const done=await service('finish',i.id,result)
    return {id:done.id,bytes:result.bytes,pages:result.pages}
  }catch(error){try{await service('fail',i.id,{reject:error.status===422||error.status===413})}catch{/* Lease permits recovery without exposing unvalidated bytes. */}throw error}
}
