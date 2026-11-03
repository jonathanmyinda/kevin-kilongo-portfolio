// Offline configuration check only: does NOT authenticate, migrate or link.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const file=resolve(import.meta.dirname,'../.env.supabase-dev.local')
let text
try {text=await readFile(file,'utf8')}catch{throw new Error('Créer .env.supabase-dev.local selon docs/admin-dashboard-remote-dev.md (sans secrets dans la conversation).')}
const values={}
for(const line of text.split(/\r?\n/)){
  const m=line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
  if(m)values[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2')
}
const ref=values.SUPABASE_DEV_PROJECT_REF
if(!/^[a-z]{20}$/.test(ref??''))throw new Error('Identifiant de projet réel requis ; placeholder refusé.')
if(values.SUPABASE_DEV_PROJECT_NAME!=='kevin-portfolio-dev')throw new Error('Nom de développement attendu : kevin-portfolio-dev. Vérifier dans le Dashboard.')
let url
try{url=new URL(values.SUPABASE_DEV_URL)}catch{throw new Error('URL de développement invalide')}
if(url.origin!==`https://${ref}.supabase.co`||url.pathname!=='/'||url.username||url.password||url.search||url.hash)throw new Error('URL et identifiant de développement incompatibles')
if(!values.SUPABASE_DEV_REGION||values.SUPABASE_DEV_REGION.includes('YOUR_'))throw new Error('Région réellement sélectionnée requise')
console.log(JSON.stringify({projectRef:ref,name:values.SUPABASE_DEV_PROJECT_NAME,region:values.SUPABASE_DEV_REGION,url:url.origin,scope:'développement déclaré',verifiedRemotely:false,next:'Confirmer ces valeurs dans le Dashboard. Ce contrôle local seul ne prouve ni le nom distant ni l’isolation de la production.'},null,2))
