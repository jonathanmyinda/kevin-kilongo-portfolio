// Real HTTP -> application handler -> Supabase DEV. Own fixtures only.
import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { randomUUID, randomBytes } from 'node:crypto'
import { verifyTarget, sql, quote } from './dev-tools.mjs'
import { supabaseRequest } from '../server/admin/supabase.mjs'
import handler from '../server/admin/handler.mjs'
verifyTarget()
const run = randomUUID(), users = [], releases = [], checks = []
const key = process.env.SUPABASE_DEV_SECRET_KEY
const baseline = sql('select active_release_id,version,(select count(*) from portfolio.projects) as projects,(select count(*) from portfolio.release_projects where release_id=active_release_id) as published_projects from portfolio.site_state')[0]
const fixtureSlugs = ['fixture-' + run, 'fixture-secondary-' + run]
const server = createServer(handler); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
let cookie = '', projectId, revision, catalog
function local(path, options = {}) {
  return new Promise((resolve, reject) => {
    const bytes = options.body == null ? null : Buffer.from(options.body)
    const req = request(origin + path, { ...options, agent: false, headers: { ...options.headers, ...(bytes ? { 'Content-Length': bytes.length } : {}) } }, res => {
      const chunks = []; res.on('data', b => chunks.push(b)); res.on('end', () => resolve({ status: res.statusCode, data: res.headers['content-type']?.includes('application/json') ? JSON.parse(Buffer.concat(chunks).toString()) : Buffer.concat(chunks), cookies: res.headers['set-cookie'] || [], cache: res.headers['cache-control'] }))
    })
    req.setTimeout(60000, () => req.destroy(new Error('Délai local dépassé'))); req.on('error', reject); if (bytes) req.write(bytes); req.end()
  })
}
async function api(action, body, id, jar = cookie) {
  const r = await local(`/api/admin?action=${action}${id ? '&id=' + id : ''}`, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin, ...(jar ? { Cookie: jar } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const rawCookies = r.cookies
  if (rawCookies.length && jar === cookie) cookie = rawCookies.map(c => c.split(';')[0]).join('; ')
  return r
}
const check = (name, condition) => { assert(condition, name); checks.push(name); console.log('OK ' + name) }
const rpc = (name, body, token) => supabaseRequest('/rest/v1/rpc/' + name, { method: 'POST', body, token })
let auth
try {
  check('API anonyme refusée', (await api('projects')).status === 401)
  check('aperçu anonyme refusé', (await api('preview', undefined, randomUUID())).status === 401)
  for (const role of ['admin', 'nonadmin']) {
    const email = `workflow-${role}-${run}@example.invalid`, password = randomBytes(24).toString('hex')
    const created = await supabaseRequest('/auth/v1/admin/users', { method: 'POST', key, body: { email, password, email_confirm: true } })
    assert.equal(created.status, 200); users.push({ id: created.data.id, role, email, password })
  }
  const admin = users[0], other = users[1]
  sql(`insert into portfolio.admin_members(user_id) values(${quote(admin.id)});`)
  check('connexion non administrateur refusée', (await api('login', { email: other.email, password: other.password })).status === 403)
  const signedOther = await supabaseRequest('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: other.email, password: other.password } })
  const otherCookie = 'portfolio_access=' + signedOther.data.access_token
  check('API non administrateur refusée', (await api('projects', undefined, undefined, otherCookie)).status === 403)
  check('RPC directe non administrateur refusée', (await rpc('admin_projects', {}, signedOther.data.access_token)).status === 403)
  const login = await api('login', { email: admin.email, password: admin.password })
  check('connexion admin réelle, cookies HttpOnly sans token JSON', login.status === 200 && login.cookies.length === 2 && login.cookies.every(c => c.includes('HttpOnly') && c.includes('SameSite=Strict')) && !JSON.stringify(login.data).includes('token'))
  catalog = (await api('projects')).data
  check('18 projets importés présents', catalog.projects.length === Number(baseline.projects) && catalog.projects.length >= 18)
  const source = catalog.projects[0].data
  const images = source.images.map((i, position) => ({ id: i.id, alt: i.alt, caption: i.caption, credit: i.credit, cover: i.cover, position }))
  const data = { slug: 'fixture-' + run, title: 'Projet de test ' + run, description: 'Description fictive', category: 'Test', location: null, agency: 'Agence fictive — test', mission: 'Mission fictive', context: null, images }
  const created = await api('save', { projectId: null, expectedRevision: null, data }); assert.equal(created.status, 200)
  revision = created.data.revisionId
  catalog = (await api('projects')).data; projectId = catalog.projects.find(p => p.revisionId === revision)?.id
  check('création et rechargement du brouillon', !!projectId && catalog.projects.find(p => p.id === projectId).status === 'draft')
  check('aperçu privé réel', (await api('preview', undefined, revision)).data.title === data.title)
  check('aperçu non administrateur interdit', (await api('preview', undefined, revision, otherCookie)).status === 403)
  const privateResponse = await api('projects'); check('réponses privées non mises en cache', privateResponse.cache.includes('no-store'))
  check('média privé délivré par API autorisée', (await api('media', undefined, images[0].id)).status === 200)
  check('média privé interdit anonymement', (await api('media', undefined, images[0].id, '')).status === 401)
  check('écriture non administrateur refusée', (await api('save', { projectId, expectedRevision: revision, data }, undefined, otherCookie)).status === 403)
  const secondary = await api('save', { projectId: null, expectedRevision: null, data: { ...data, slug: fixtureSlugs[1], title: 'Autre projet fictif' } })
  assert.equal(secondary.status, 200)
  catalog = (await api('projects')).data
  const secondaryProject = catalog.projects.find(p => p.revisionId === secondary.data.revisionId)
  const secondaryPub = await api('publish', { projectId: secondaryProject.id, revisionId: secondaryProject.revisionId, siteId: catalog.siteId, expectedVersion: catalog.version })
  assert.equal(secondaryPub.status, 200); releases.push(secondaryPub.data.releaseId)
  catalog = (await api('projects')).data
  const command = { projectId, revisionId: revision, siteId: catalog.siteId, expectedVersion: catalog.version }
  const published = await api('publish', command); assert.equal(published.status, 200); releases.push(published.data.releaseId)
  const publicBefore = (await rpc('read_portfolio', {})).data
  check('publication atomique réelle dans DEV', publicBefore.projects.some(p => p.slug === data.slug && p.title === data.title))
  check('aucun autre brouillon publié implicitement', publicBefore.projects.length === Number(baseline.published_projects) + 2)
  const changed = { ...data, title: 'Brouillon modifié ' + run }
  const saved = await api('save', { projectId, expectedRevision: revision, data: changed }); assert.equal(saved.status, 200)
  check('ancienne publication conservée pendant édition', (await rpc('read_portfolio', {})).data.projects.find(p => p.slug === data.slug).title === data.title)
  const updatedCatalog = (await api('projects')).data
  check('état modifications non publiées', updatedCatalog.projects.find(p => p.id === projectId).status === 'changed')
  check('conflit de sauvegarde HTTP 409', (await api('save', { projectId, expectedRevision: revision, data: changed })).status === 409)
  check('conflit de publication HTTP 409', (await api('publish', { ...command, revisionId: saved.data.revisionId })).status === 409)
  check('ancienne révision ne peut être republiée par erreur', (await api('publish', { ...command, expectedVersion: updatedCatalog.version })).status === 409)
  const finalPublication = await api('publish', { ...command, revisionId: saved.data.revisionId, expectedVersion: updatedCatalog.version })
  assert.equal(finalPublication.status, 200); releases.push(finalPublication.data.releaseId)
  const publicAfter = (await rpc('read_portfolio', {})).data
  check('nouveau brouillon publié après confirmation de version', publicAfter.projects.find(p => p.slug === data.slug).title === changed.title)
  check('autres projets publiés préservés', JSON.stringify(publicAfter.projects.filter(p => p.slug !== data.slug)) === JSON.stringify(publicBefore.projects.filter(p => p.slug !== data.slug)))
  // Corrupt only the access cookie, retain valid refresh: exercise actual refresh-token rotation.
  cookie = cookie.replace(/portfolio_access=[^;]+/, 'portfolio_access=expired')
  check('renouvellement réel de session', (await api('session')).status === 200)
  auth = cookie
  check('session entièrement expirée refusée', (await api('session', undefined, undefined, 'portfolio_access=expired; portfolio_refresh=invalid')).status === 401)
  const csrf = await local('/api/admin?action=save', { method: 'POST', headers: { Origin: 'https://example.invalid', Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}' })
  check('origine étrangère refusée', csrf.status === 403)
  sql(`update portfolio.admin_members set active=false where user_id=${quote(admin.id)};`)
  check('révocation effective sur la session existante', (await api('projects')).status === 403)
  cookie = auth
  check('déconnexion réelle', (await api('logout', {})).status === 200)
} finally {
  await new Promise(resolve => server.close(resolve))
  // Restore only our own active release; never replace another administrator's publication.
  const releaseList = releases.length ? releases.map(quote).join(',') : 'null'
  sql(`begin;
  do $$ begin if (select active_release_id from portfolio.site_state) is distinct from ${baseline.active_release_id ? quote(baseline.active_release_id) + '::uuid' : 'null::uuid'} and not exists(select 1 from portfolio.site_state where active_release_id in(${releaseList})) then raise exception 'Autre publication : nettoyage interrompu'; end if; end $$;
  update portfolio.site_state set active_release_id=${baseline.active_release_id ? quote(baseline.active_release_id) : 'null'},version=${Number(baseline.version)} where active_release_id in(${releaseList});
  delete from portfolio.publication_events where release_id in(${releaseList});
  delete from portfolio.release_projects where release_id in(${releaseList});
  delete from portfolio.releases where id in(${releaseList});
  delete from portfolio.project_workspaces where project_id in(select id from portfolio.projects where slug in(${fixtureSlugs.map(quote).join(',')}));
  delete from portfolio.revision_media where revision_id in(select r.id from portfolio.project_revisions r join portfolio.projects p on p.id=r.project_id where p.slug in(${fixtureSlugs.map(quote).join(',')}));
  delete from portfolio.project_revisions where project_id in(select id from portfolio.projects where slug in(${fixtureSlugs.map(quote).join(',')}));
  delete from portfolio.projects where slug in(${fixtureSlugs.map(quote).join(',')});
  ${users.map(u => `delete from portfolio.admin_members where user_id=${quote(u.id)};`).join('\n')}
  commit;`)
  for (const u of users) assert((await supabaseRequest('/auth/v1/admin/users/' + u.id, { method: 'DELETE', key })).status < 300, 'Nettoyage compte fictif')
  console.log('Fixtures nettoyées, publication initiale et contenus importés préservés.')
}
console.log(`${checks.length} contrôles applicatifs réels réussis.`)
