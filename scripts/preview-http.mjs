// Exercise the deployed handler through the official authenticated Vercel CLI.
// Cookies, passwords and capabilities stay in memory / stdin, never CLI args.
import {spawnSync} from 'node:child_process'
import assert from 'node:assert/strict'
import https from 'node:https'
export const previewOrigin=process.env.ADMIN_TEST_URL
let automationToken
if(previewOrigin&&!/^https:\/\/kevin-kilongo-portfolio-[a-z0-9]+-jonathan-myindas-projects\.vercel\.app$/.test(previewOrigin))throw Error('URL immuable de Preview attendue')
if(previewOrigin){
 const r=spawnSync(process.execPath,[process.env.VERCEL_TEST_CLI,'api','/v13/deployments/'+new URL(previewOrigin).hostname+'?teamId=team_bx88N2nIylCPGUpguoQdugcf','--raw'],{encoding:'utf8',timeout:60000,maxBuffer:3000000})
 assert.equal(r.status,0,'Identification du déploiement impossible')
 const d=JSON.parse(r.stdout);assert(d.projectId==='prj_ZfJF5jsU9F3OUlfR0AtDSdLkqoKI'&&d.target!=='production'&&d.meta?.githubCommitRef==='feat/admin-dashboard'&&d.readyState==='READY','Cible Preview non vérifiée')
 console.log('Runtime Preview vérifié : '+d.meta.githubCommitSha)
 // Reuse the official automation capability already obtained by `vercel curl`.
 // Do not create or persist another credential, and never forward it off target.
 const p=spawnSync(process.execPath,[process.env.VERCEL_TEST_CLI,'api','/v9/projects/prj_ZfJF5jsU9F3OUlfR0AtDSdLkqoKI?teamId=team_bx88N2nIylCPGUpguoQdugcf','--raw'],{encoding:'utf8',timeout:60000,maxBuffer:3000000})
 assert.equal(p.status,0,'Identification de la protection impossible')
 const project=JSON.parse(p.stdout)
 automationToken=Object.entries(project.protectionBypass||{}).find(([,v])=>v.scope==='automation-bypass')?.[0]
}
export async function previewHTTP(path,{method='GET',headers={},body,readAttempt=0}={}){
 if(!previewOrigin||!process.env.VERCEL_TEST_CLI)throw Error('Preview/CLI manquante')
 if(automationToken)return new Promise((resolve,reject)=>{
  assert(path.startsWith('/')&&!path.startsWith('//'),'Chemin relatif requis')
  const bytes=body==null?null:Buffer.from(body)
  const req=https.request(previewOrigin+path,{method,family:4,agent:false,headers:{...headers,'x-vercel-protection-bypass':automationToken,...(bytes?{'Content-Length':bytes.length}:{})}},res=>{
   const chunks=[];let size=0
   res.on('data',b=>{size+=b.length;if(size>30000000)req.destroy(Error('Réponse trop volumineuse'));else chunks.push(b)})
   res.on('end',()=>{const data=Buffer.concat(chunks);resolve({status:res.statusCode,data:res.headers['content-type']?.includes('application/json')?JSON.parse(data.toString()):data,cookies:res.headers['set-cookie']||[],cache:res.headers['cache-control'],headers:res.headers})});res.on('error',()=>reject(Error('Réponse Preview interrompue')))
  });req.setTimeout(150000,()=>req.destroy(Error('Délai Preview dépassé')));req.on('error',()=>reject(Error('Réseau Preview interrompu ; résultat de mutation à vérifier avant reprise.')));req.end(bytes)
 }).catch(async error=>{
  // Network-only retries for reads. Never replay a potentially committed POST.
  if(method==='GET'&&readAttempt<2){await new Promise(r=>setTimeout(r,500));return previewHTTP(path,{method,headers,body,readAttempt:readAttempt+1})}
  throw error
 })
 const lines=[`request = ${JSON.stringify(method)}`,...Object.entries(headers).filter(([,v])=>v!=null).map(([k,v])=>`header = ${JSON.stringify(k+': '+v)}`)]
 if(body!=null)lines.push('data-binary = '+JSON.stringify(body.toString()))
 const r=spawnSync(process.execPath,[process.env.VERCEL_TEST_CLI,'curl',path,'--deployment',previewOrigin,'--','--silent','--show-error','--include','--max-time','150','--config','-'],{input:lines.join('\n')+'\n',timeout:210000,maxBuffer:30000000})
 if(r.status!==0)throw Error('Accès CLI à la Preview interrompu ; aucune mutation rejouée automatiquement.')
 const raw=r.stdout;let offset=0,head,end
 do{end=raw.indexOf('\r\n\r\n',offset);if(end<0)throw Error('Réponse HTTP de Preview illisible');head=raw.subarray(offset,end).toString();offset=end+4}while(/^HTTP\/\S+ 100/.test(head))
 const status=Number(head.match(/^HTTP\/\S+ (\d+)/)?.[1]);if(!status)throw Error('Statut HTTP de Preview absent')
 const pairs=head.split('\r\n').slice(1).map(x=>{const i=x.indexOf(':');return[x.slice(0,i).toLowerCase(),x.slice(i+1).trim()]}),h=Object.fromEntries(pairs),bytes=raw.subarray(offset)
 return{status,data:h['content-type']?.includes('application/json')?JSON.parse(bytes.toString()):bytes,cookies:pairs.filter(([k])=>k==='set-cookie').map(([,v])=>v),cache:h['cache-control'],headers:h}
}
