// Real image lifecycle against DEV only. Never edits an imported/manual project.
import assert from 'node:assert/strict'
import { createServer, request as http } from 'node:http'
import https from 'node:https'
import { randomUUID, randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { verifyTarget, sql, quote } from './dev-tools.mjs'
import { supabaseRequest } from '../server/admin/supabase.mjs'
import handler from '../server/admin/handler.mjs'
import {previewOrigin,previewHTTP} from './preview-http.mjs'
verifyTarget()
const run = randomUUID(), slug = 'images-fixture-' + run, users = [], intents = [], releases = [], checks = []
const key = process.env.SUPABASE_DEV_SECRET_KEY
const fingerprintQuery = `select jsonb_build_object('projects',(select jsonb_agg(to_jsonb(p) order by p.id) from portfolio.projects p where legacy_id is not null),'revisions',(select jsonb_agg(to_jsonb(r) order by r.id) from portfolio.project_revisions r join portfolio.projects p on p.id=r.project_id where p.legacy_id is not null),'gallery',(select jsonb_agg(to_jsonb(g) order by g.revision_id,g.position) from portfolio.revision_media g join portfolio.project_revisions r on r.id=g.revision_id join portfolio.projects p on p.id=r.project_id where p.legacy_id is not null)) as content`
const fingerprint = JSON.stringify(sql(fingerprintQuery)[0].content)
const baseline = sql('select active_release_id,version from portfolio.site_state')[0]
const manifest = 'node_modules/.cache/admin-workflow/images-' + run + '.local.json'
const persist = () => writeFileSync(manifest, JSON.stringify({ run, slug, users: users.map(u => u.id), intents: intents.map(i => i.id), releases, checks }, null, 2))
const server = createServer(handler); await new Promise(r => server.listen(0, '127.0.0.1', r))
const origin = previewOrigin || `http://127.0.0.1:${server.address().port}`
let cookie = '', otherCookie = '', projectId, revisionId
function api(action, body, id, jar = cookie) {
  if(previewOrigin)return previewHTTP('/api/admin?action='+action+(id?'&id='+id:''),{method:body===undefined?'GET':'POST',headers:{Origin:origin,Cookie:jar,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)}).then(r=>{if(jar===cookie&&r.cookies.length)cookie=r.cookies.map(c=>c.split(';')[0]).join('; ');return r})
  return new Promise((resolve, reject) => {
    const bytes = body === undefined ? null : Buffer.from(JSON.stringify(body))
    const req = http(origin + '/api/admin?action=' + action + (id ? '&id=' + id : ''), { method: bytes ? 'POST' : 'GET', agent: false, headers: { Origin: origin, Cookie: jar, ...(bytes ? { 'Content-Type': 'application/json', 'Content-Length': bytes.length } : {}) } }, res => {
      const chunks = []; res.on('data', b => chunks.push(b)); res.on('end', () => {
        if (jar === cookie && res.headers['set-cookie']) cookie = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ')
        const raw = Buffer.concat(chunks)
        resolve({ status: res.statusCode, data: res.headers['content-type']?.includes('application/json') ? JSON.parse(raw.toString()) : raw })
      })
    })
    req.setTimeout(90000, () => req.destroy(Error('Délai local dépassé'))); req.on('error', reject); if (bytes) req.write(bytes); req.end()
  })
}
function upload(url, bytes, mime) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'PUT', family: 4, agent: false, headers: { 'Content-Type': mime, 'Content-Length': bytes.length } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)) })
    req.setTimeout(45000, () => req.destroy(Error('Transfert interrompu'))); req.on('error', () => reject(Error('Connexion Storage interrompue'))); req.end(bytes)
  })
}
const check = (name, condition) => { assert(condition, name); checks.push(name); console.log('OK ' + name); persist() }
async function begin(bytes, mime = 'image/png', name = 'fixture.png') {
  const r = await api('image-begin', { name, mime, bytes: bytes.length }); assert.equal(r.status, 200, 'Autorisation limitée')
  intents.push(r.data); persist(); return r.data
}
const rpc = (name, body = {}, token) => supabaseRequest('/rest/v1/rpc/' + name, { method: 'POST', body, token })
try {
  check('API images anonyme refusée', (await api('images')).status === 401)
  check('autorisation upload anonyme refusée', (await api('image-begin', { name: 'x.png', mime: 'image/png', bytes: 100 })).status === 401)
  for (const role of ['admin', 'nonadmin']) {
    const email = `images-${role}-${run}@example.invalid`, password = randomBytes(24).toString('hex')
    const r = await supabaseRequest('/auth/v1/admin/users', { method: 'POST', key, body: { email, password, email_confirm: true } })
    assert.equal(r.status, 200); users.push({ id: r.data.id, email, password }); persist()
  }
  sql(`insert into portfolio.admin_members(user_id) values(${quote(users[0].id)});`)
  const signedOther = await supabaseRequest('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: users[1].email, password: users[1].password } })
  otherCookie = 'portfolio_access=' + signedOther.data.access_token
  check('autorisation upload non administrateur refusée', (await api('image-begin', { name: 'x.png', mime: 'image/png', bytes: 100 }, undefined, otherCookie)).status === 403)
  check('validation non administrateur refusée', (await api('image-finish', { id: randomUUID() }, undefined, otherCookie)).status === 403)
  check('fonction privilégiée inaccessible au JWT utilisateur', (await rpc('service_image_finish', { p_id: randomUUID(), p_actor: users[1].id, p_bytes: 100, p_width: 1, p_height: 1, p_sha: 'a'.repeat(64) }, signedOther.data.access_token)).status >= 400)
  assert.equal((await api('login', { email: users[0].email, password: users[0].password })).status, 200)
  const png = previewOrigin ? await sharp(randomBytes(1400*1200*3),{raw:{width:1400,height:1200,channels:3}}).png({compressionLevel:0}).toBuffer() : await sharp({ create: { width: 160, height: 100, channels: 3, background: '#359c83' } }).png().toBuffer()
  if(previewOrigin)check('image réelle dépassant 4,5 Mo pour transfert direct',png.length>4500000&&png.length<6*1024**2)
  check('écriture directe administrateur dans le bucket final refusée', (await supabaseRequest('/storage/v1/object/portfolio-private/uploads/' + users[0].id + '/' + randomUUID() + '.png', { method: 'POST', body: png, mime: 'image/png', token: cookie.match(/portfolio_access=([^;]+)/)[1] })).status >= 400)
  const jpeg = await sharp(png).jpeg().toBuffer()
  check('poids déclaré excessif refusé par API', (await api('image-begin', { name: 'large.png', mime: 'image/png', bytes: 6291457 })).status === 413)
  const tooBig = await begin(png)
  check('poids réel excessif refusé par Storage', await upload(tooBig.uploadUrl, Buffer.alloc(6291457, 1), 'image/png') >= 400)
  const a = await begin(png)
  const path = new URL(a.uploadUrl).pathname.split('/portfolio-incoming/')[1]
  check('upload direct sans autorisation refusé', (await supabaseRequest('/storage/v1/object/portfolio-incoming/' + path, { method: 'POST', mime: 'image/png', body: png })).status >= 400)
  assert(await upload(a.uploadUrl, png, 'image/png') < 300, 'Transfert signé valide')
  check('quarantaine non accessible anonymement', (await supabaseRequest('/storage/v1/object/public/portfolio-incoming/' + path)).status >= 400)
  check('quarantaine non lisible par administrateur avant validation', (await supabaseRequest('/storage/v1/object/authenticated/portfolio-incoming/' + path, { token: cookie.match(/portfolio_access=([^;]+)/)[1], binary: true })).status >= 400)
  const listBefore = (await api('images')).data
  check('image en attente absente de la bibliothèque', !listBefore.some(i => i.id === a.id))
  const doneA = await api('image-finish', { id: a.id }); assert.equal(doneA.status, 200, 'Validation réelle PNG')
  const imageA = doneA.data
  check('image validée disponible', imageA.id === a.id && imageA.width === 160 && imageA.height === 100)
  check('finalisation répétée idempotente', (await api('image-finish', { id: a.id })).data.id === a.id)
  const displayed = await api('media', undefined, a.id)
  check('binaire privé réellement décodable', displayed.status === 200 && (await sharp(displayed.data).metadata()).format === 'webp')
  check('image validée illisible anonymement', (await api('media', undefined, a.id, '')).status === 401)
  check('aucun écrasement de la quarantaine', await upload(a.uploadUrl, jpeg, 'image/jpeg') >= 400)
  const b = await begin(jpeg, 'image/jpeg', 'fixture.jpg'); assert(await upload(b.uploadUrl, jpeg, 'image/jpeg') < 300)
  check('JPEG décodé et validé', (await api('image-finish', { id: b.id })).status === 200)
  const webp = await sharp(png).webp().toBuffer(), unused = await begin(webp, 'image/webp', 'unused.webp')
  assert(await upload(unused.uploadUrl, webp, 'image/webp') < 300)
  check('WebP décodé et validé', (await api('image-finish', { id: unused.id })).status === 200)
  check('suppression sans confirmation refusée', (await api('image-delete', { id: unused.id })).status === 400)
  check('suppression orpheline confirmée', (await api('image-delete', { id: unused.id, confirm: true })).status === 200 && (await api('media', undefined, unused.id)).status === 404)
  const images = [{ id: a.id, alt: 'A test', caption: 'Légende A', credit: 'Crédit fictif A', cover: true, position: 0 }, { id: b.id, alt: 'B test', caption: 'Légende B', credit: 'Crédit fictif B', cover: false, position: 1 }]
  const data = { slug, title: 'TEST images ' + run, description: 'Contenu fictif', category: 'Test', location: null, mission: 'Test technique', agency: null, context: 'Fixture jetable', images }
  const created = await api('save', { projectId: null, expectedRevision: null, data }); assert.equal(created.status, 200); revisionId = created.data.revisionId
  let catalog = (await api('projects')).data; projectId = catalog.projects.find(p => p.revisionId === revisionId).id
  const reversed = { ...data, images: [{ ...images[1], position: 0, cover: true }, { ...images[0], position: 1, cover: false }] }
  const saved = await api('save', { projectId, expectedRevision: revisionId, data: reversed }); assert.equal(saved.status, 200); revisionId = saved.data.revisionId
  catalog = (await api('projects')).data
  const stored = catalog.projects.find(p => p.id === projectId).data
  check('ordre couverture légendes crédits conservés après rechargement', stored.images[0].id === b.id && stored.images[0].cover && stored.images[1].id === a.id && stored.images[0].caption === 'Légende B' && stored.images[1].credit === 'Crédit fictif A')
  const reusable = (await api('images')).data.find(i => i.id === a.id)
  check('réutilisation avec crédits et légendes préremplis', reusable.defaults.credit === 'Crédit fictif A' && reusable.defaults.caption === 'Légende A')
  check('aperçu privé utilise les images validées', (await api('preview', undefined, revisionId)).data.images[0].id === b.id)
  const pub = await api('publish', { projectId, revisionId, siteId: catalog.siteId, expectedVersion: catalog.version }); assert.equal(pub.status, 200); releases.push(pub.data.releaseId); persist()
  const edited = { ...reversed, title: 'Brouillon après publication', images: [{ ...reversed.images[0], position: 0 }] }
  const edit = await api('save', { projectId, expectedRevision: revisionId, data: edited }); assert.equal(edit.status, 200); revisionId = edit.data.revisionId
  check('version publiée inchangée pendant retrait et édition', (await rpc('read_portfolio')).data.projects.find(p => p.slug === slug).images.length === 2)
  check('suppression refusée si une version conservée référence le fichier', (await api('image-delete', { id: a.id, confirm: true })).status === 409)
  const stateBeforeFailure = (await api('preview', undefined, revisionId)).data
  const mismatch = await begin(jpeg, 'image/png', 'mismatch.png'); assert(await upload(mismatch.uploadUrl, jpeg, 'image/png') < 300)
  check('contenu JPEG annoncé PNG réellement refusé', (await api('image-finish', { id: mismatch.id })).status === 422)
  const invalid = Buffer.from('<html>ceci n’est pas une image</html>'), bad = await begin(invalid)
  assert(await upload(bad.uploadUrl, invalid, 'image/png') < 300)
  check('faux fichier image refusé après décodage', (await api('image-finish', { id: bad.id })).status === 422)
  const wide = await sharp({ create: { width: 6001, height: 2, channels: 3, background: 'white' } }).png().toBuffer(), dimensions = await begin(wide)
  assert(await upload(dimensions.uploadUrl, wide, 'image/png') < 300)
  check('dimensions réelles excessives refusées', (await api('image-finish', { id: dimensions.id })).status === 422)
  const missing = await begin(png)
  check('transfert absent échoue sans confirmation fictive', (await api('image-finish', { id: missing.id })).status === 503)
  const pendingImage = { ...edited, images: [{ ...images[0], id: missing.id, position: 0, cover: true }] }
  check('réutilisation d’un import en attente refusée', (await api('save', { projectId, expectedRevision: revisionId, data: pendingImage })).status === 400)
  check('échecs d’import sans altération du brouillon', JSON.stringify((await api('preview', undefined, revisionId)).data) === JSON.stringify(stateBeforeFailure))
  // Expire our own abandoned intent only, never someone else's import.
  sql(`update portfolio.image_imports set expires_at=now()-interval '1 minute' where id=${quote(bad.id)};`)
  const candidates = await supabaseRequest('/rest/v1/rpc/service_image_cleanup', { method: 'POST', key, body: { p_actor: users[0].id, p_id: bad.id } })
  assert.equal(candidates.status, 200); assert.equal(candidates.data.length, 1)
  // Use the same storage deletes as the API but pin this fixture, so no other stale imports are cleaned by tests.
  const cleaned = await supabaseRequest('/storage/v1/object/portfolio-incoming', { method: 'DELETE', key, body: { prefixes: [candidates.data[0].incomingKey] } }); assert(cleaned.status < 300)
  await supabaseRequest('/rest/v1/rpc/service_image_cleanup_finish', { method: 'POST', key, body: { p_actor: users[0].id, p_id: bad.id } })
  check('nettoyage ciblé d’un import refusé expiré', (await supabaseRequest('/storage/v1/object/authenticated/portfolio-incoming/' + candidates.data[0].incomingKey, { key, binary: true })).status >= 400)
} finally {
  await new Promise(r => server.close(r))
  const ownReleases = releases.length ? releases.map(quote).join(',') : 'null', ownIds = intents.length ? intents.map(i => quote(i.id)).join(',') : 'null'
  sql(`begin;
  do $$ begin if (select active_release_id from portfolio.site_state) is distinct from ${baseline.active_release_id ? quote(baseline.active_release_id) + '::uuid' : 'null::uuid'} and not exists(select 1 from portfolio.site_state where active_release_id in(${ownReleases})) then raise exception 'Publication tierce : nettoyage arrêté'; end if; end $$;
  update portfolio.site_state set active_release_id=${baseline.active_release_id ? quote(baseline.active_release_id) : 'null'},version=${Number(baseline.version)} where active_release_id in(${ownReleases});
  delete from portfolio.publication_events where release_id in(${ownReleases}); delete from portfolio.release_projects where release_id in(${ownReleases}); delete from portfolio.releases where id in(${ownReleases});
  delete from portfolio.project_workspaces where project_id in(select id from portfolio.projects where slug=${quote(slug)});
  delete from portfolio.revision_media where revision_id in(select r.id from portfolio.project_revisions r join portfolio.projects p on p.id=r.project_id where p.slug=${quote(slug)});
  delete from portfolio.project_revisions where project_id in(select id from portfolio.projects where slug=${quote(slug)}); delete from portfolio.projects where slug=${quote(slug)};
  delete from portfolio.image_imports where id in(${ownIds}); delete from portfolio.media where id in(${ownIds}); commit;`)
  for (const bucket of ['portfolio-incoming', 'portfolio-private']) {
    const paths = bucket === 'portfolio-incoming' ? intents.map(i => new URL(i.uploadUrl).pathname.split('/portfolio-incoming/')[1]) : intents.map(i => `uploads/${i.id}/${i.id}.webp`)
    if (paths.length) assert((await supabaseRequest('/storage/v1/object/' + bucket, { method: 'DELETE', key, body: { prefixes: paths } })).status < 300)
  }
  for (const u of users) { sql(`delete from portfolio.admin_members where user_id=${quote(u.id)};`); assert((await supabaseRequest('/auth/v1/admin/users/' + u.id, { method: 'DELETE', key })).status < 300) }
  const residue = sql(`select (select count(*) from portfolio.projects where slug=${quote(slug)})+(select count(*) from portfolio.image_imports where id in(${ownIds}))+(select count(*) from portfolio.media where id in(${ownIds}))+(select count(*) from auth.users where id in(${users.length ? users.map(u => quote(u.id)).join(',') : 'null'})) as remaining`)[0]
  assert.equal(Number(residue.remaining), 0, 'Aucune fixture restante')
  assert.equal(JSON.stringify(sql(fingerprintQuery)[0].content), fingerprint, '18 projets importés inchangés')
  persist(); console.log('Nettoyage ciblé terminé ; 18 projets importés inchangés, publication initiale restaurée, compte personnel préservé.')
}
console.log(`${checks.length} contrôles réels du parcours images réussis.`)
