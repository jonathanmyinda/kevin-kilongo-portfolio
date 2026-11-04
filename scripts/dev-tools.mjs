import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { devConfig, DEV_REF } from '../server/admin/supabase.mjs'
process.loadEnvFile('.env.supabase-dev.local')
devConfig()
const dir = 'node_modules/.cache/admin-workflow'
mkdirSync(dir, { recursive: true })
export function cli(args) {
  for (let attempt=0;attempt<3;attempt++) {
    const r = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', ...args, '--output', 'json'], { encoding: 'utf8', maxBuffer: 8000000 })
    if (r.status === 0) return JSON.parse(r.stdout)
    const diagnostic=r.stdout+r.stderr
    // Retry only a failure BEFORE SQL is sent. Never replay a potentially
    // committed business mutation after an ambiguous response.
    if(attempt<2&&/failed to initialise login role|failed to connect as temp role/.test(diagnostic)){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,2000);continue}
    writeFileSync(`${dir}/failure.local.txt`,diagnostic);throw new Error('Commande DEV refusée. Diagnostic local privé : node_modules/.cache/admin-workflow/failure.local.txt')
  }
}
export function verifyTarget() {
  const p = cli(['projects', 'list']).find(p => p.id === DEV_REF)
  if (p?.name !== 'kevin-portfolio-dev' || p.region !== 'eu-west-1' || p.status !== 'ACTIVE_HEALTHY') throw new Error('Cible distante DEV non vérifiée')
  console.log('Cible vérifiée : kevin-portfolio-dev / pahbwurduwagdglpslos / eu-west-1')
}
export function sql(query) {
  const path = `${dir}/query-${randomUUID()}.sql`; writeFileSync(path, query)
  return cli(['db', 'query', '--linked', '--project-ref', DEV_REF, '--file', path]).rows
}
export const quote = value => "'" + String(value).replaceAll("'", "''") + "'"
