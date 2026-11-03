// Official Vercel CLI, pinned existing project. Values travel only through stdin.
import {spawnSync} from 'node:child_process'
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
const cli=process.argv[2],action=process.argv[3]
if(!cli)throw Error('Chemin de la CLI officielle requis')
const project='prj_ZfJF5jsU9F3OUlfR0AtDSdLkqoKI',team='team_bx88N2nIylCPGUpguoQdugcf',branch='feat/admin-dashboard'
export function run(args,input){const r=spawnSync(process.execPath,[cli,...args],{input,encoding:'utf8',timeout:180000,maxBuffer:8000000});if(r.status!==0){let detail=(r.stderr||'')+(r.stdout||'');for(const [k,v]of Object.entries(process.env))if(/KEY|TOKEN|PASSWORD|SECRET/.test(k)&&v?.length>8)detail=detail.replaceAll(v,'[masqué]');throw Error('Commande Vercel refusée : '+args.slice(0,3).join(' ')+' ('+r.status+'/'+(r.error?.code||r.signal||'')+') '+detail.slice(-1500))}return r.stdout}
function api(path){return JSON.parse(run(['api',path+(path.includes('?')?'&':'?')+'teamId='+team,'--raw']))}
mkdirSync('node_modules/.cache/admin-preview',{recursive:true})
if(action==='inspect'){
 const p=api('/v9/projects/'+project),env=api('/v9/projects/'+project+'/env')
 const production=(env.envs||[]).filter(x=>x.target?.includes('production')).map(x=>({key:x.key,id:x.id,valueHash:createHash('sha256').update(x.value||'').digest('hex'),updatedAt:x.updatedAt})).sort((a,b)=>a.key.localeCompare(b.key))
 writeFileSync('node_modules/.cache/admin-preview/production-baseline.local.json',JSON.stringify({production,productionDeployment:p.targets?.production?.id,productionBranch:p.link?.productionBranch}))
 console.log(JSON.stringify({project:p.name,repo:p.link?.org+'/'+p.link?.repo,productionBranch:p.link?.productionBranch,productionDeployment:p.targets?.production?.id,protection:p.ssoProtection,env:(env.envs||[]).map(x=>({key:x.key,target:x.target,branch:x.gitBranch}))},null,2))
}else if(action==='configure'){
 process.loadEnvFile('.env.supabase-dev.local')
 const {devConfig}=await import('../server/admin/supabase.mjs');devConfig()
 const existing=api('/v9/projects/'+project+'/env').envs||[]
 for(const name of ['SUPABASE_DEV_PROJECT_REF','SUPABASE_DEV_PROJECT_NAME','SUPABASE_DEV_REGION','SUPABASE_DEV_URL','SUPABASE_DEV_PUBLISHABLE_KEY','SUPABASE_DEV_SECRET_KEY']){
  if(existing.some(x=>x.key===name&&x.gitBranch===branch&&x.target.includes('preview')))throw Error('Variable déjà présente ; vérifier avant remplacement : '+name)
  const value=process.env[name];if(!value)throw Error('Paramètre local manquant : '+name)
  run(['env','add',name,'--environment','preview','--git-branch',branch,'--yes',name.endsWith('_KEY')?'--sensitive':'--no-sensitive'],value+'\n')
  console.log(name+' configuré uniquement pour Preview / '+branch)
 }
}else if(action==='deployments'){
 const result=api('/v6/deployments?projectId='+project+'&limit=10')
 console.log(JSON.stringify(result.deployments.map(d=>({id:d.uid,url:d.url,state:d.state,target:d.target,sha:d.meta?.githubCommitSha,branch:d.meta?.githubCommitRef})),null,2))
}else if(action==='verify'){
 const baseline=JSON.parse(readFileSync('node_modules/.cache/admin-preview/production-baseline.local.json','utf8'))
 const p=api('/v9/projects/'+project),env=api('/v9/projects/'+project+'/env').envs||[]
 const production=env.filter(x=>x.target?.includes('production')).map(x=>({key:x.key,id:x.id,valueHash:createHash('sha256').update(x.value||'').digest('hex'),updatedAt:x.updatedAt})).sort((a,b)=>a.key.localeCompare(b.key))
 if(JSON.stringify(production)!==JSON.stringify(baseline.production)||p.targets?.production?.id!==baseline.productionDeployment||p.link?.productionBranch!==baseline.productionBranch)throw Error('État de production différent du contrôle initial')
 const dev=env.filter(x=>x.key.startsWith('SUPABASE_DEV_'))
 if(dev.length!==6||dev.some(x=>x.gitBranch!==branch||JSON.stringify(x.target)!==JSON.stringify(['preview'])))throw Error('Périmètre des variables DEV incorrect')
 console.log('Production et ses variables inchangées ; 6 paramètres DEV limités à Preview / '+branch)
}else if(action==='logs'){
 process.loadEnvFile('.env.supabase-dev.local')
 const raw=run(['logs','--deployment',process.argv[4],'--environment','preview','--since','1h','--limit','200','--json'])
 const sensitive=Object.entries(process.env).filter(([k,v])=>/KEY|TOKEN|PASSWORD|SECRET/.test(k)&&v?.length>12).some(([,v])=>raw.includes(v))
 if(sensitive||/Texte privé non publié|portfolio_access=|portfolio_refresh=|"password"\s*:/.test(raw))throw Error('Journal potentiellement sensible : contrôler localement sans le publier')
 const records=raw.split('\n').filter(Boolean).map(x=>{try{return JSON.parse(x)}catch{return {}}})
 console.log(JSON.stringify({logRecords:records.length,sensitiveValueDetected:false,errorRecords:records.filter(x=>['error','fatal'].includes(x.level)||['error','fatal'].includes(x.log?.level)).length}))
}else throw Error('Action inconnue')
