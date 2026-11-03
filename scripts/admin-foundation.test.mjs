import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { validateProject, validateFile } from '../server/content/contracts.mjs'
import { createContentRepository } from '../server/content/repository.mjs'
import { prepareImport, requireLocalDatabase } from './admin-import.mjs'

test('import reproductible, complet, sans publication ni validation fictive', async () => {
  const a=await prepareImport(),b=await prepareImport()
  assert.deepEqual(a,b)
  assert.equal(a.report.projects,18)
  assert.deepEqual(a.report.errors,[])
  assert.equal(a.files.length>70,true)
  assert(!a.sql.includes('insert into portfolio.admin_members'))
  assert(!a.sql.includes('insert into portfolio.releases'))
  assert(a.sql.includes('where not exists'))
  assert(a.files.some(f=>f.source.endsWith('kevin-kilongo-chemise-bleue.webp')))
  assert(a.files.some(f=>f.source.endsWith('kevin-kilongo-chemise-jaune.webp')))
  assert.equal(new Set(a.candidate.revisionIds).size,18)
})
test('contrats : champs internes, mauvaise couverture et fichiers interdits rejetés', () => {
  const project={title:'Projet',description:'Description',category:'Habitat',mission:'Conception',slug:'projet',images:[{id:'m',alt:'Façade',cover:true,position:0}]}
  assert.equal(validateProject(project),project)
  assert.throws(()=>validateProject({...project,internal:{}}))
  assert.throws(()=>validateProject({...project,images:[]}))
  assert.throws(()=>validateFile(Buffer.from('<svg/>'),'image/svg+xml'))
  assert.throws(()=>validateFile(Buffer.from('not a pdf'),'application/pdf'))
  assert.throws(()=>validateFile(Buffer.from([255,216,255]),'image/jpeg',{width:100000,height:100000}))
  assert.equal(validateFile(Buffer.from('%PDF-1.7'),'application/pdf').requiresServerValidation,true)
})
test('import distant impossible par ce script',()=>{
  assert.equal(requireLocalDatabase('postgresql://u:p@127.0.0.1:54322/postgres').hostname,'127.0.0.1')
  for(const u of ['postgresql://u:p@remote.example:54322/postgres','postgresql://u:p@localhost:5432/postgres'])assert.throws(()=>requireLocalDatabase(u))
})
test('accès : lecture anonyme sans JWT utilisateur ; admin exige une session ; erreurs conservées',async()=>{
  const calls=[]
  const repo=createContentRepository({url:'http://127.0.0.1:54321',publishableKey:'test-public',fetchImpl:async(url,options)=>{calls.push({url,options});return new Response('null',{status:200})}})
  await repo.readPublished()
  assert.equal(calls[0].options.headers.Authorization,undefined)
  await assert.rejects(repo.previewProject('x'),/Connexion requise/)
  assert.equal(calls.length,1)
  const denied=createContentRepository({url:'http://127.0.0.1:54321',publishableKey:'test-public',getAccessToken:async()=>'test-user-token',fetchImpl:async()=>new Response('{}',{status:403})})
  await assert.rejects(denied.previewProject('x'),/403/)
})
test('contrôles statiques SQL/config — ne constituent PAS une exécution RLS',async()=>{
  const dir=new URL('../supabase/migrations/',import.meta.url)
  const sql=(await Promise.all((await readdir(dir)).map(f=>readFile(new URL(f,dir),'utf8')))).join('\n')
  assert(sql.includes('enable row level security'))
  assert(sql.includes("set search_path=''"))
  assert(sql.includes('for update'))
  assert(sql.includes('p_expected'))
  assert(sql.includes('create policy portfolio_admin_upload'))
  assert(!/grant\s+(?:all|insert|update|delete).*admin_members/i.test(sql))
  const config=await readFile(new URL('../supabase/config.toml',import.meta.url),'utf8')
  assert(config.includes('enable_signup = false'))
  assert(!config.includes('"portfolio"'))
})
