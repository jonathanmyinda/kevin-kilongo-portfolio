import assert from 'node:assert/strict'
import {readdirSync,readFileSync} from 'node:fs'
import {previewHTTP} from './preview-http.mjs'
process.loadEnvFile('.env.supabase-dev.local')
const secret=Buffer.from(process.env.SUPABASE_DEV_SECRET_KEY)
for(const path of ['/','/admin','/projets','/projets/rhom-city']){
 const r=await previewHTTP(path);assert.equal(r.status,200,path);assert(/text\/html/.test(r.headers['content-type']));assert(/noindex/.test(r.headers['x-robots-tag']||''),'Preview non indexable');console.log('OK route et noindex '+path)
}
for(const path of ['/api/admin?action=session','/api/admin?action=projects','/api/admin?action=site']){
 const r=await previewHTTP(path);assert.equal(r.status,401);assert(/no-store/.test(r.cache));assert(!JSON.stringify(r.data).includes('sb_'));console.log('OK refus anonyme privé '+path)
}
const unknown=await previewHTTP('/api/inconnue');assert(!/text\/html.*index/i.test(unknown.data.toString()));assert(unknown.status>=400);console.log('OK API inconnue non capturée par la SPA')
for(const name of readdirSync('dist/assets').filter(n=>/\.(js|css)$/.test(n))){
 const r=await previewHTTP('/assets/'+name);assert.equal(r.status,200);assert(!r.data.includes(secret),'Secret serveur dans un asset');assert(r.data.equals(readFileSync('dist/assets/'+name)),'Asset distant différent du build local');console.log('OK asset client identique et sans clé privilégiée '+name)
}
for(const path of process.argv.includes('--smoke')?[]:['/images/portraits/kevin-kilongo-chemise-bleue.webp','/images/portraits/kevin-kilongo-chemise-jaune.webp','/documents/portfolio-kevin-kilongo-munganga.pdf']){
 const r=await previewHTTP(path);assert.equal(r.status,200);assert(r.data.equals(readFileSync('public'+path)));console.log('OK média public inchangé '+path)
}
console.log('Contrôles HTTP de Preview terminés (ne constituent pas un contrôle visuel).')
