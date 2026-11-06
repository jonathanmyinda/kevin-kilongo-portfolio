import media from '../../src/data/published-media.json' with {type:'json'}
import {isProdDiagnostic,supabaseConfig,supabaseRequest,supabaseSecret} from '../admin/supabase.mjs'
export function dynamicPreview(env=process.env){
 const rehearsal = env.VERCEL_ENV==='preview'&&env.VERCEL_GIT_COMMIT_REF==='feat/admin-dashboard'||!env.VERCEL_ENV&&env.NODE_ENV!=='production'
 if(env.SUPABASE_TARGET==='prod') return env.PORTFOLIO_CONTENT_SOURCE==='supabase-prod'&&(rehearsal||isProdDiagnostic(env)||env.VERCEL_ENV==='production'&&env.VERCEL_GIT_COMMIT_REF==='main')
 return env.PORTFOLIO_CONTENT_SOURCE==='supabase-dev'&&rehearsal
}
export const fileURL=id=>'/api/media?id='+encodeURIComponent(id)
export function publicView(snapshot,files){
 const registry=new Map(files.map(f=>[f.id,f]))
 const legacy=new Map(Object.values(media.projects).flatMap(p=>p.images).map(i=>[i.src,i]))
 function image(id,alt,credit=null,caption=null){
  const f=registry.get(id);if(!f||f.kind!=='image')throw Error('Média publié indisponible')
  const variants=files.filter(v=>v.parents.includes(id)).sort((a,b)=>a.width-b.width)
  return {id,src:fileURL(id),alt,credit,caption,width:f.width,height:f.height,kind:legacy.get(f.legacyPath)?.kind||'image',...(variants.length?{srcSet:variants.map(v=>`${fileURL(v.id)} ${v.width}w`).join(', ')}:{})}
 }
 const projects=snapshot.projects.map((p,index)=>{
  const images=p.images.map(i=>({...image(i.id,i.alt,i.credit,i.caption),cover:i.cover}))
  const cover=images.find(i=>i.cover);if(!cover)throw Error('Couverture publiée absente')
  return {...p,number:p.number??index+1,publicDescription:p.description,publicRole:p.mission,missionLabel:p.missionLabel||p.mission,tools:p.tools||[],typologies:p.typologies?.length?p.typologies:null,images,coverImage:cover.src}
 })
 const s=snapshot.profile,pdf=registry.get(s.pdfMediaId);if(!pdf||pdf.kind!=='pdf')throw Error('PDF publié indisponible')
 const profile={name:s.name,profession:s.profession,location:s.location,headline:s.headline,subtitle:s.subtitle,presentation:s.presentation,approach:s.approach,signatureAbout:s.signatureAbout,
  heroPortrait:image(s.heroMediaId,s.heroAlt,s.heroCredit),portrait:image(s.portraitMediaId,s.portraitAlt,s.portraitCredit),contact:{email:s.email,phone:s.phone},socials:s.socials.map(x=>({network:x.label,url:x.url})),
  portfolio:{src:fileURL(s.pdfMediaId)+'&download=1',downloadName:s.pdfDownloadName,bytes:pdf.bytes,pages:s.pdf.pages},education:s.education||[],experiences:s.experiences||[],internships:s.internships||[],software:s.software||[],languages:s.languages||[]}
 const services=snapshot.services.map(x=>({title:x.title,text:x.description,...(x.mediaId?{image:image(x.mediaId,x.alt,x.credit)}:{})}))
 const perspectives=media.perspectives.flatMap(item=>{const project=projects.find(p=>p.id===item.projectId);if(!project)return[];const chosen=project.images.find(i=>registry.get(i.id)?.legacyPath===item.image.src)||project.images.find(i=>i.cover);return chosen?[{projectId:project.id,project,image:chosen}]:[]})
 const phone='https://wa.me/'+s.phone.replace(/\D/g,'')
 return {projects,profile,services,perspectives,featuredProjects:snapshot.featured.map(id=>projects.find(p=>p.id===id)).filter(Boolean),contactLinks:{email:'mailto:'+encodeURIComponent(s.email),quote:'mailto:'+encodeURIComponent(s.email)+'?subject='+encodeURIComponent('Demande de devis — Projet architectural'),phone,whatsapp:phone},pdfSize:`${(pdf.bytes/1e6).toLocaleString('fr-FR',{maximumFractionDigits:2})} Mo`}
}
export function createPublicHandler(request=supabaseRequest){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('CDN-Cache-Control','no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff')
 const send=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data))}
 if(req.method!=='GET'){res.setHeader('Allow','GET');return send(405,{error:'Méthode refusée.'})}
 const url=new URL(req.url,'http://localhost'),isMedia=url.pathname==='/api/media'
 if(!isMedia && url.searchParams.get('runtime-check')==='1' &&
    req.headers.host==='kevin-kilongo-portfolio-git-di-0749e1-jonathan-myindas-projects.vercel.app'){
  const env=process.env
  const setting=(value,allowed)=>value===undefined?'missing':allowed.includes(value)?value:'unexpected'
  return send(200,{
   environment:setting(env.VERCEL_ENV,['preview','production']),
   branch:setting(env.VERCEL_GIT_COMMIT_REF,['diag/supabase-prod-503','main']),
   diagnostic:setting(env.PORTFOLIO_PROD_DIAGNOSTIC,['1','0']),
   source:setting(env.PORTFOLIO_CONTENT_SOURCE,['static','supabase-prod','supabase-dev']),
   target:setting(env.SUPABASE_TARGET,['prod','dev']),
   publishableKeyPresent:Boolean(env.SUPABASE_PROD_PUBLISHABLE_KEY),
   secretKeyPresent:Boolean(env.SUPABASE_PROD_SECRET_KEY),
  })
 }
 if(!dynamicPreview())return isMedia?send(404,{error:'Média introuvable.'}):send(200,{source:'static'})
 const source=process.env.PORTFOLIO_CONTENT_SOURCE
 let stage='configuration', status, code
 const rpc=async(name,body={},server=false)=>{
  stage=server?'configuration':name
  status=undefined
  code=undefined
  const options={method:'POST',body,...(server?{key:supabaseSecret()}:{})}
  stage=name
  const r=await request('/rest/v1/rpc/'+name,options)
  status=r.status
  const upstreamCode=r.data?.code ?? r.data?.error_code
  if(typeof upstreamCode==='string' && /^[A-Za-z0-9_]{1,40}$/.test(upstreamCode))code=upstreamCode
  if(status!==200)throw Error('Lecture indisponible')
  return r.data
 }
 try{
  if(request===supabaseRequest)supabaseConfig()
  if(isMedia){
   const id=url.searchParams.get('id');if(!/^[a-f0-9-]{36}$/i.test(id||''))return send(404,{error:'Média introuvable.'})
   const key=await rpc('published_media_key',{p_media:id},true);if(!key)return send(404,{error:'Média introuvable.'})
   let downloadName
   if(url.searchParams.has('download')){const s=await rpc('read_portfolio');if(s?.profile.pdfMediaId!==id)return send(404,{error:'Document introuvable.'});downloadName=s.profile.pdfDownloadName}
   const {url:storageOrigin}=supabaseConfig()
   const r=await request('/storage/v1/object/sign/portfolio-private/'+key,{method:'POST',key:supabaseSecret(),body:{expiresIn:120}})
   if(r.status!==200||!r.data?.signedURL)throw Error('Signature indisponible')
   const target=new URL(r.data.signedURL.startsWith('/object/')?'/storage/v1'+r.data.signedURL:r.data.signedURL,storageOrigin)
   if(target.origin!==storageOrigin)throw Error('URL invalide')
   if(downloadName)target.searchParams.set('download',downloadName)
   // Recheck publication immediately before releasing the temporary capability.
   if(await rpc('published_media_key',{p_media:id},true)!==key)return send(404,{error:'Média introuvable.'})
   res.statusCode=307;res.setHeader('Location',target.href);return res.end()
  }
  const snapshot=await rpc('read_portfolio');if(!snapshot)return send(200,{source,version:0,content:null})
  const files=await rpc('published_files',{},true)
  stage='response'
  status=undefined
  code=undefined
  const content=publicView(snapshot,files),latest=await rpc('read_portfolio')
  if(latest?.version!==snapshot.version)return send(409,{source,error:'La publication change. Réessayez.'})
  return send(200,{source,version:snapshot.version,content,refreshAfter:30})
 }catch{
  if(isProdDiagnostic())console.error(JSON.stringify({stage,status,code}))
  return send(503,{source,error:'Le portfolio est temporairement indisponible. Réessayez dans un instant.'})
 }
}}
export default createPublicHandler()
