import './prepare-dev-pgtap.mjs'
import {spawnSync} from 'node:child_process'
import {readFileSync,writeFileSync} from 'node:fs'
const env=readFileSync('.env.supabase-dev.local','utf8')
if(!/^SUPABASE_DEV_PROJECT_REF=pahbwurduwagdglpslos\s*$/m.test(env)||!/^SUPABASE_DEV_REGION=eu-west-1\s*$/m.test(env))throw Error('Cible dev incorrecte')
const r=spawnSync(process.execPath,['node_modules/supabase/dist/supabase.js','db','query','--linked','--project-ref','pahbwurduwagdglpslos','--file','node_modules/.cache/admin-dev-tests/pgtap.sql','--output','json'],{encoding:'utf8',maxBuffer:3000000})
const raw=r.stdout+r.stderr
writeFileSync('node_modules/.cache/admin-dev-tests/pgtap-output.local.txt',raw)
const m=raw.match(/PORTFOLIO_TAP_REPORT_BASE64:([A-Za-z0-9+/=]+)/)
if(!m)throw Error('Rapport TAP absent ; vérifier le diagnostic local, sans le publier aveuglément')
const result=JSON.parse(Buffer.from(m[1],'base64').toString())
console.log(result.join('\n'))
if(result[0]!=='1..19'||result.filter(x=>/^ok \d+$/.test(x)).length!==19||result.some(x=>/^not ok|^#/.test(x)))process.exitCode=1
