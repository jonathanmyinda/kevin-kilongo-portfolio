import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, relative, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { validateProject, validateFile } from '../server/content/contracts.mjs'

const root = resolve(import.meta.dirname, '..')
const load = async path => JSON.parse(await readFile(resolve(root,path), 'utf8'))
const hash = value => createHash('sha256').update(value).digest('hex')
const uuid = value => { const h=hash(value); return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}` }
const sql = value => value == null ? 'null' : typeof value === 'boolean' ? String(value) : typeof value === 'number' ? String(value) : "'"+String(value).replaceAll("'","''")+"'"
function insert(table, row, identity='id') {
  const keys=Object.keys(row)
  // WHERE NOT EXISTS prevents immutable-row insert triggers from firing on replay.
  const predicate=identity.split(',').map(k=>`${k}=${sql(row[k])}`).join(' and ')
  return `insert into portfolio.${table} (${keys.join(',')}) select ${keys.map(k=>sql(row[k])).join(',')} where not exists(select 1 from portfolio.${table} where ${predicate});`
}
export async function prepareImport() {
  const [projects, media, profile, featured] = await Promise.all(['src/data/projects.json','src/data/published-media.json','src/data/profile.json','src/data/homepage-selection.json'].map(load))
  const home=await readFile(resolve(root,'src/sections/HomeSections.jsx'),'utf8')
  const statements=[], files=[], warnings=[], errors=[], seen=new Map(), slugs=new Set()
  async function image(item, kind='image') {
    if (seen.has(item.src)) return seen.get(item.src)
    if (!item.src?.startsWith('/') || item.src.includes('..')) throw new Error('Chemin source invalide')
    const path=resolve(root,'public',item.src.slice(1))
    if (!path.startsWith(resolve(root,'public')+sep)) throw new Error('Chemin hors public')
    const bytes=await readFile(path), sha=hash(bytes)
    const mime=kind==='pdf'?'application/pdf':path.endsWith('.webp')?'image/webp':path.endsWith('.png')?'image/png':'image/jpeg'
    validateFile(bytes,mime,item)
    if (item.sha256 && item.sha256!==sha) throw new Error('Empreinte incorrecte : '+item.src)
    if (item.bytes && item.bytes!==bytes.length) throw new Error('Poids incorrect : '+item.src)
    const id=uuid(item.src+sha), ext=mime==='image/jpeg'?'jpg':mime.split('/')[1]
    const objectKey=`uploads/${id}/${id}.${ext}`
    statements.push(insert('media',{id,object_key:objectKey,kind,mime,bytes:bytes.length,width:item.width??null,height:item.height??null,sha256:sha,validated:false,legacy_path:item.src}))
    files.push({id,source:relative(root,path).replaceAll('\\','/'),objectKey,sha256:sha,bytes:bytes.length,mime,width:item.width??null,height:item.height??null})
    seen.set(item.src,id)
    for(const variant of item.variants??[]) {
      const child=await image(variant)
      statements.push(insert('media_derivatives',{parent_id:id,media_id:child},'parent_id,media_id'))
    }
    return id
  }
  const revisionIds=[], projectIds=new Map()
  for (const source of projects) {
    try {
      if (slugs.has(source.slug)) throw new Error('Slug répété')
      slugs.add(source.slug)
      const actual=media.projects[source.id]
      if (!actual) throw new Error('Galerie absente')
      const gallery=[]
      for (const [position,item] of actual.images.entries()) gallery.push({id:await image(item),position,alt:item.alt,caption:null,credit:item.credit??null,cover:item.src===actual.coverImage})
      const data=validateProject({id:source.id,slug:source.slug,title:source.title,description:source.publicDescription||source.description,category:source.category,location:source.location??null,mission:source.publicRole||source.role,agency:source.agency??null,context:source.context?.startsWith('Section II')?null:source.context??null,images:gallery})
      const id=uuid(source.id),revision=uuid(JSON.stringify({source,data}));projectIds.set(source.id,id);revisionIds.push(revision)
      statements.push(insert('projects',{id,legacy_id:source.id,slug:source.slug}))
      statements.push(insert('project_revisions',{id:revision,project_id:id,...Object.fromEntries(['title','description','category','location','mission','agency','context'].map(k=>[k,data[k]])),internal:JSON.stringify(source)}))
      for(const item of gallery)statements.push(insert('revision_media',{revision_id:revision,media_id:item.id,position:item.position,alt:item.alt,caption:item.caption,credit:item.credit,cover:item.cover},'revision_id,media_id'))
      for(const key of ['location','year','areaSqm']) if(source[key]==null)warnings.push(`${source.id}: ${key} non renseigné (préservé sans invention)`)
    }catch(error){errors.push(`${source.id}: ${error.message}`)}
  }
  let siteId=null
  try {
    const hero=await image(media.heroPortrait),portrait=await image(media.portrait),pdf=await image({src:profile.portfolio.src},'pdf')
    const servicesBlock=home.match(/const expertises = \[([\s\S]*?)\n\]/)?.[1]
    if(!servicesBlock)throw new Error('Services à extraire manuellement : format source modifié')
    const services=Array.from(servicesBlock.matchAll(/\{ title: '([^']*)', text: '([^']*)'(?:, imageKey: '([^']*)')? \}/g),m=>({title:m[1],description:m[2],imageKey:m[3]}))
    if(services.length!==4)throw new Error('Quatre services attendus')
    const lead=home.match(/<p className="lead">([^<]+)<\/p>/)?.[1],facts=home.match(/<p className="about-facts">([^<]+)<\/p>/)?.[1]
    if(!lead||!facts)throw new Error('Présentation visible non extraite')
    const internal={profile,homeSource:home,media,featured,notice:'Archives privées ; ne jamais retourner dans une réponse publique.'}
    siteId=uuid(JSON.stringify({internal,hero,portrait,pdf}))
    statements.push(insert('site_revisions',{id:siteId,name:profile.name,profession:profile.profession,location:profile.location,presentation:lead+'\n\n'+facts,
      signature_home:'Architecture de sens, héritage en mouvement',signature_about:'Patrimoine & modernité : une même architecture',
      email:profile.contact.email,phone:profile.contact.phone,whatsapp:'https://wa.me/243813732058',hero_media_id:hero,portrait_media_id:portrait,pdf_media_id:pdf,internal:JSON.stringify(internal)}))
    for(const [position,item]of services.entries()){
      const asset=item.imageKey?media.services[item.imageKey]:null
      statements.push(insert('services',{site_revision_id:siteId,position,title:item.title,description:item.description,media_id:asset?await image(asset):null,alt:asset?.alt??null,credit:asset?.credit??null},'site_revision_id,position'))
    }
    const catalog=await readFile(resolve(root,'src/data/catalog.js'),'utf8')
    const socials=Array.from(catalog.matchAll(/network: '([^']+)', url: '(https:[^']+)'/g),m=>({label:m[1],url:m[2]}))
    if(socials.length!==2)throw new Error('Liens sociaux effectifs à vérifier')
    for(const[position,item]of socials.entries()) statements.push(insert('social_links',{site_revision_id:siteId,position,...item},'site_revision_id,position'))
    warnings.push('Parcours, outils, faits détaillés, Perspectives et textes JSX conservés dans internal ; projection publique étendue à réaliser avant basculement. Aucun texte perdu dans l’archive privée.')
  }catch(error){errors.push('Profil : '+error.message)}
  for(const item of featured)if(!projectIds.has(item.projectId))errors.push('Sélection inconnue : '+item.projectId)
  return {report:{mode:'simulation',projects:projects.length,files:files.length,errors,warnings,storageValidation:'préliminaire seulement ; validated=false ; aucun fichier téléversé'},
    sql:'begin;\n'+statements.join('\n')+'\ncommit;\n',files,
    candidate:{revisionIds,siteRevisionId:siteId,featuredProjectIds:featured.map(p=>projectIds.get(p.projectId))}}
}
export function requireLocalDatabase(value) {
  const url=new URL(value)
  if(!['postgres:','postgresql:'].includes(url.protocol)||!['localhost','127.0.0.1'].includes(url.hostname)||url.port!=='54322'||url.pathname!=='/postgres')throw new Error('Seule la base Supabase locale sur le port 54322 est autorisée')
  return url
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2)
  if(args.some(a=>!['--dry-run','--export','--apply-local'].includes(a)))throw new Error('Option inconnue')
  const prepared=await prepareImport();console.log(JSON.stringify(prepared.report,null,2))
  if(prepared.report.errors.length)process.exitCode=1
  else if(args.includes('--export')||args.includes('--apply-local')){
    const dir=resolve(root,'node_modules/.cache/admin-import');await mkdir(dir,{recursive:true})
    await writeFile(resolve(dir,'drafts.sql'),prepared.sql)
    await writeFile(resolve(dir,'manifest.json'),JSON.stringify({files:prepared.files,candidate:prepared.candidate},null,2))
    if(args.includes('--apply-local')){
      const u=requireLocalDatabase(process.env.LOCAL_DATABASE_URL)
      execFileSync('psql',['-X','-v','ON_ERROR_STOP=1','-f','-'],{input:prepared.sql,stdio:['pipe','inherit','inherit'],env:{...process.env,PGHOST:u.hostname,PGPORT:u.port,PGDATABASE:'postgres',PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password)}})
      console.log('Brouillons importés localement. Médias non téléversés/non validés ; aucune publication.')
    }
  }
}
