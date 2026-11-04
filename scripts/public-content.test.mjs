import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {dynamicPreview,publicView,createPublicHandler} from '../server/content/public.mjs'
const ids=['11111111-1111-4111-a111-111111111111','22222222-2222-4222-a222-222222222222','33333333-3333-4333-a333-333333333333']
const snapshot={version:1,featured:['fixture'],projects:[{id:'fixture',slug:'fixture',title:'Fictif',description:'Essai',mission:'Visualisation uniquement',category:'Test',images:[{id:ids[0],cover:true,alt:'Vue fictive',credit:'Crédit fictif'}]}],services:[],profile:{name:'Test',profession:'Test',location:'Test',headline:'Test',subtitle:'Test',presentation:'Test',approach:'Test',signatureAbout:'Test',email:'test@example.invalid',phone:'+243813732058',heroMediaId:ids[0],portraitMediaId:ids[1],pdfMediaId:ids[2],pdfDownloadName:'test.pdf',pdf:{pages:1},socials:[]}}
const files=ids.map((id,n)=>({id,kind:n===2?'pdf':'image',width:100,height:80,bytes:100,parents:[],key:'private/'+id,legacyPath:null}))
test('activation réservée à cette Preview et à DEV local ; production toujours statique',()=>{
 const enabled={PORTFOLIO_CONTENT_SOURCE:'supabase-dev',VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feat/admin-dashboard'}
 assert(dynamicPreview(enabled));assert(!dynamicPreview({...enabled,VERCEL_ENV:'production'}));assert(!dynamicPreview({...enabled,VERCEL_GIT_COMMIT_REF:'autre'}));assert(!dynamicPreview({}));assert(dynamicPreview({PORTFOLIO_CONTENT_SOURCE:'supabase-dev',NODE_ENV:'development'}))
})
test('projection sans fusion avec les JSON : dépublication et crédits conservés',()=>{
 const view=publicView(snapshot,files);assert.equal(view.projects.length,1);assert.equal(view.projects[0].publicRole,'Visualisation uniquement');assert.equal(view.projects[0].images[0].credit,'Crédit fictif');assert(!JSON.stringify(view).includes('private/'));assert.equal(view.contactLinks.phone,'https://wa.me/243813732058')
 const empty=publicView({...snapshot,projects:[],featured:['project-01','fixture']},files);assert.deepEqual(empty.projects,[]);assert.deepEqual(empty.featuredProjects,[]);assert.deepEqual(empty.perspectives,[])
})
test('un fichier absent du registre publié ne peut pas être réutilisé',()=>assert.throws(()=>publicView(snapshot,files.slice(1))))
test('API publique : aucun brouillon, aucun historique, aucun retour statique en cas d’erreur',async()=>{
 const old={...process.env};process.env.PORTFOLIO_CONTENT_SOURCE='supabase-dev';delete process.env.VERCEL_ENV;process.env.NODE_ENV='development'
 let fail=false
 const server=createServer(createPublicHandler(async(path)=>{
  if(fail)throw Error('Secret et diagnostic privé à ne jamais afficher')
  if(path.endsWith('read_portfolio'))return{status:200,data:snapshot}
  if(path.endsWith('published_files'))return{status:200,data:files}
  if(path.endsWith('published_media_key'))return{status:200,data:null}
  throw Error('Action inattendue')
 }));await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port
 try{
  let r=await fetch(url+'/api/content');assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);const body=await r.json();assert.equal(body.source,'supabase-dev');assert(!JSON.stringify(body).includes('private/'))
  r=await fetch(url+'/api/media?id='+ids[0],{redirect:'manual'});assert.equal(r.status,404)
  r=await fetch(url+'/api/content',{method:'POST'});assert.equal(r.status,405)
  fail=true;r=await fetch(url+'/api/content');assert.equal(r.status,503);assert(!JSON.stringify(await r.json()).includes('Secret'))
 }finally{await new Promise(r=>server.close(r));for(const k of Object.keys(process.env))if(!(k in old))delete process.env[k];Object.assign(process.env,old)}
})
