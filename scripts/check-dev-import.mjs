import assert from 'node:assert/strict'
import { prepareImport } from './admin-import.mjs'
import { verifyTarget, sql, quote } from './dev-tools.mjs'
verifyTarget()
const prepared = await prepareImport()
const source = JSON.parse(await (await import('node:fs/promises')).readFile('src/data/projects.json', 'utf8'))
const rows = sql(`select p.legacy_id,p.slug,r.id as revision_id,r.mission,r.agency,
 (select jsonb_agg(jsonb_build_object('id',g.media_id,'credit',g.credit,'alt',g.alt,'position',g.position,'cover',g.cover) order by g.position) from portfolio.revision_media g where g.revision_id=r.id) as images
 from portfolio.projects p join portfolio.project_revisions r on r.id=portfolio.working_revision(p.id) where p.legacy_id is not null order by p.legacy_id`)
assert.equal(rows.length, 18)
for (const p of source) {
  const actual = rows.find(r => r.legacy_id === p.id)
  assert.equal(actual.slug, p.slug); assert.equal(actual.mission, p.publicRole || p.role); assert.equal(actual.agency, p.agency ?? null)
  assert(prepared.candidate.revisionIds.includes(actual.revision_id), 'Révision importée identique')
}
const assets = JSON.parse(await (await import('node:fs/promises')).readFile('src/data/published-media.json', 'utf8'))
for (const row of rows) {
  const expected = assets.projects[row.legacy_id]
  assert.equal(row.images.length, expected.images.length)
  row.images.forEach((image, i) => { assert.equal(image.credit, expected.images[i].credit ?? null); assert.equal(image.alt, expected.images[i].alt); assert.equal(image.cover, expected.images[i].src === expected.coverImage); assert.equal(image.position, i) })
}
const ids = prepared.files.map(f => quote(f.id)).join(',')
const summary = sql(`select (select count(*) from portfolio.projects) as projects,(select count(*) from portfolio.project_revisions) as revisions,
 (select count(*) from portfolio.media where id in(${ids}) and validated) as validated_media,
 (select count(*) from storage.objects o join portfolio.media m on m.object_key=o.name where o.bucket_id='portfolio-private' and m.id in(${ids})) as stored_media,
 (select count(*) from auth.users) as auth_users,(select count(*) from portfolio.admin_members) as admins,
 (select count(*) from portfolio.releases) as releases,active_release_id,version from portfolio.site_state`)[0]
// Dedicated manual projects and their retained revisions are legitimate additions.
// The 18 imported identities/revisions were checked individually above.
assert(Number(summary.projects)>=18); assert(Number(summary.revisions)>=18)
assert.equal(Number(summary.validated_media),127); assert.equal(Number(summary.stored_media),127)
console.log('Correspondance vérifiée : 18 slugs, missions et agences ; toutes les galeries, couvertures, textes alternatifs et crédits.')
console.log(JSON.stringify(summary))
