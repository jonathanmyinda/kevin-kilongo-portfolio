// Read-only guard before staging and after build. Never prints secret values.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
process.loadEnvFile('.env.supabase-dev.local')
const files = [...new Set(execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard']).toString().split('\0').filter(Boolean))]
const secrets = Object.entries(process.env).filter(([name,value])=>/SECRET|PASSWORD|ACCESS_TOKEN/.test(name)&&value?.length>=12).map(([,value])=>Buffer.from(value))
const forbidden = /(^|\/)(node_modules|dist|\.vercel|\.temp|__pycache__)(\/|$)|(^|\/)\.env(?!\.example$)|\.local(?:\.|$)/
for (const file of files) {
  assert(!forbidden.test(file),'Fichier local candidat interdit : '+file)
  const bytes=readFileSync(file)
  assert(!secrets.some(value=>bytes.includes(value)),'Secret local détecté dans '+file)
  assert(!/sb_secret_(?!EXAMPLE)[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(bytes.toString()),'Secret potentiel dans '+file)
}
function walk(path){return readdirSync(path,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(join(path,x.name)):[join(path,x.name)])}
for(const file of walk('dist'))assert(!secrets.some(value=>readFileSync(file).includes(value)),'Secret dans le bundle : '+file)
const v=JSON.parse(readFileSync('vercel.json','utf8'))
const route=new RegExp('^'+v.rewrites[0].source+'$')
for(const path of ['/api','/api/admin','/api/inconnue'])assert(!route.test(path),'API capturée par la SPA')
for(const path of ['/','/admin','/projets/test'])assert(route.test(path),'Route SPA non couverte')
console.log(`${files.length} fichiers candidats et bundle contrôlés : aucun secret local détecté, aucun fichier local interdit ; réécritures API/SPA vérifiées.`)
