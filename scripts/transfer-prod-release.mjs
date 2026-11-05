import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { readdirSync, readFileSync } from 'node:fs'
import { DEV_REF, devConfig, supabaseConfig, supabaseRequest } from '../server/admin/supabase.mjs'

process.loadEnvFile('.env.supabase-prod.local')
process.loadEnvFile('.env.supabase-dev.local')
const env = process.env
const prod = supabaseConfig({ ...env, SUPABASE_TARGET: 'prod' })
const dev = devConfig()
const prodRef = env.SUPABASE_PROD_PROJECT_REF
const apply = process.argv[2] === '--apply'
assert(process.argv.length === 2 || (apply && process.argv[3] === prodRef && process.argv.length === 4),
  'Usage : node scripts/transfer-prod-release.mjs [--apply RÉFÉRENCE_PROD]')
assert(env.SUPABASE_ACCESS_TOKEN && env.SUPABASE_DEV_SECRET_KEY?.startsWith('sb_secret_'),
  'Jeton Management API et clé Storage DEV requis dans les fichiers locaux ignorés')

async function management(path, body) {
  const response = await fetch('https://api.supabase.com/v1' + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + env.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(90000),
  })
  if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(`Management API HTTP ${response.status}: ${String(error.message ?? "").split("\n")[0]}`) }
  return response.json()
}
const projects = await management('/projects')
for (const [ref, name] of [[DEV_REF, 'kevin-portfolio-dev'], [prodRef, 'kevin-portfolio-prod']]) {
  assert(projects.some(project => project.ref === ref && project.name === name), `Projet attendu absent : ${name} (${ref})`)
}
function sql(ref, query, readOnly = true, parameters) {
  assert(readOnly || (apply && ref === prodRef), 'Écriture interdite hors de la cible PROD confirmée')
  return management(`/projects/${ref}/database/query`, { query, read_only: readOnly, parameters })
}
const expectedVersions = readdirSync(new URL('../supabase/migrations/', import.meta.url))
  .filter(file => /^\d{12}_.+\.sql$/.test(file)).map(file => file.slice(0, 12)).sort()
const history = await sql(prodRef, 'select version from supabase_migrations.schema_migrations order by version')
assert.deepEqual(history.map(row => row.version), expectedVersions, 'Historique PROD différent des migrations du dépôt')
const [state] = await sql(prodRef, `select active_release_id is null and version=0
  and not exists(select 1 from portfolio.projects)
  and not exists(select 1 from portfolio.site_revisions)
  and not exists(select 1 from portfolio.media)
  and not exists(select 1 from portfolio.releases) as empty from portfolio.site_state where singleton`)
assert(state.empty, 'Le transfert initial exige un catalogue PROD vide')
if (apply) {
  const [access] = await sql(prodRef, "select current_setting('transaction_read_only') as read_only", false)
  assert.equal(access.read_only, 'off', 'Le jeton SQL PROD est en lecture seule : aucun fichier ne sera copié')
}
const query = readFileSync(new URL('./export-prod-release.sql', import.meta.url), 'utf8')
async function exportRelease() {
  const snapshot = await supabaseRequest('/rest/v1/rpc/read_portfolio', { method: 'POST', body: {} }, dev)
  assert(snapshot.status === 200 && snapshot.data, 'Publication active DEV indisponible')
  const [{ release }] = await sql(DEV_REF, query, true, [JSON.stringify(snapshot.data)])
  assert.equal(release.project_revisions?.length, 18, 'La publication DEV a changé pendant la lecture')
  return release
}
const release = await exportRelease()
const reference = JSON.parse(readFileSync(new URL('../src/data/projects.json', import.meta.url)))
const expected = new Map(reference.map(p => [p.id, p.slug]))
assert.equal(expected.size, 18)
assert.equal(release.projects.length, 18)
assert.equal(release.snapshot.projects.length, 18)
assert.equal(release.releases.length, 1)
assert.equal(release.site_revisions.length, 1)
assert.equal(release.services.length, 4)
assert.equal(release.media.filter(m => m.kind === 'pdf').length, 1)
for (const project of release.projects) {
  assert(expected.has(project.legacy_id) && expected.get(project.legacy_id) === project.slug && !project.archived,
    'Projet hors liste ou slug modifié')
}
assert(release.snapshot.projects.every(p => !/^(test|fixture)\b/i.test(p.title)), 'Projet de test publié')
for (const file of release.media) {
  assert(file.validated && !file.deleting && /^[a-f0-9]{64}$/.test(file.sha256), 'Média source non validé')
  assert(file.object_key.split('/').every(segment => segment && segment !== '..' && segment !== '.'), 'Clé Storage invalide')
}

const tables = ['projects', 'media', 'project_revisions', 'revision_media', 'site_revisions',
  'services', 'social_links', 'media_derivatives', 'releases', 'release_projects']
const literal = value => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb"
const lock = `do $$ begin
  if not exists(select 1 from portfolio.site_state where singleton and active_release_id is null and version=0 for update)
     or exists(select 1 from portfolio.projects) or exists(select 1 from portfolio.media)
     or exists(select 1 from portfolio.site_revisions) or exists(select 1 from portfolio.releases) then
    raise exception 'La cible a changé depuis le contrôle';
  end if;
end $$;`
const snapshot = literal(release.snapshot)
function importSql() {
  const block = '$verify_' + createHash('sha256').update(snapshot).digest('hex') + '$'
  assert(!snapshot.includes(block))
  return `begin;
set local standard_conforming_strings = on;
${lock}
${tables.map(table => `insert into portfolio.${table} select * from jsonb_populate_recordset(null::portfolio.${table}, ${literal(release[table])});`).join('\n')}
insert into portfolio.project_workspaces(project_id, revision_id) select project_id, revision_id from portfolio.release_projects;
update portfolio.site_workspace set revision_id = (select site_revision_id from portfolio.releases), baseline_revision_id = (select site_revision_id from portfolio.releases) where singleton;
update portfolio.site_state set active_release_id = (select id from portfolio.releases), version = 1 where singleton;
do ${block} begin
  if (public.read_portfolio() - 'version') is distinct from ${snapshot} then
    raise exception 'La projection PROD diffère de la publication source';
  end if;
end ${block};
commit;`
}

function storage(config, key, objectKey, options = {}) {
  const path = objectKey.split('/').map(encodeURIComponent).join('/')
  const method = options.body ? 'POST' : 'GET'
  return supabaseRequest(`/storage/v1/object/${method === 'GET' ? 'authenticated/' : ''}portfolio-private/${path}`,
    { ...options, method, key, binary: method === 'GET', maxBytes: 21 * 1024 ** 2 }, config)
}
const digest = data => createHash('sha256').update(data).digest('hex')
function checkFile(file, response) {
  assert(response.status === 200 && response.data.length === Number(file.bytes) && digest(response.data) === file.sha256,
    `Fichier absent ou différent : ${file.id}`)
}
async function readStorage(config, key, objectKey) {
  for (let attempt = 0; ; attempt++) {
    try { return await storage(config, key, objectKey) }
    catch (error) {
      if (attempt >= 2 || !['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(error.code)) throw error
      await delay(1000 * (attempt + 1))
    }
  }
}
async function transferFile(file) {
  const source = await readStorage(dev, env.SUPABASE_DEV_SECRET_KEY, file.object_key)
  checkFile(file, source)
  if (!apply) return
  // Keys in PROD identify the media, not the DEV account that originally uploaded it.
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }[file.mime]
  assert(ext, 'Type de fichier non pris en charge')
  const targetKey = `import/${file.id}.${ext}`
  let target = await readStorage(prod, env.SUPABASE_PROD_SECRET_KEY, targetKey)
  for (let attempt = 0; target.status !== 200; attempt++) {
    assert([400, 404].includes(target.status), `Lecture Storage PROD HTTP ${target.status}`)
    try {
      const upload = await storage(prod, env.SUPABASE_PROD_SECRET_KEY, targetKey, { body: source.data, mime: file.mime })
      assert(upload.status >= 200 && upload.status < 300, `Copie Storage PROD HTTP ${upload.status}`)
    } catch (error) {
      if (attempt >= 2 || !['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(error.code)) throw error
      await delay(1000 * (attempt + 1))
    }
    target = await readStorage(prod, env.SUPABASE_PROD_SECRET_KEY, targetKey)
    if (attempt >= 2) break
  }
  checkFile(file, target)
  file.object_key = targetKey
}
for (let offset = 0; offset < release.media.length; offset += 5) {
  const results = await Promise.allSettled(release.media.slice(offset, offset + 5).map(transferFile))
  const failed = results.find(result => result.status === 'rejected')
  if (failed) throw failed.reason
  if (apply && (offset + 5) % 20 === 0) console.log(`${offset + 5}/${release.media.length} fichiers contrôlés en PROD`)
}
console.log(`18 slugs, 4 services et ${release.media.length} fichiers vérifiés par taille et SHA-256.`)
if (apply) {
  const latest = await exportRelease()
  assert.deepEqual(latest.snapshot, release.snapshot, 'La publication DEV a changé pendant le transfert')
  await sql(prodRef, importSql(), false)
  console.log('Publication PROD initialisée. La projection publique a été comparée dans la transaction.')
}
