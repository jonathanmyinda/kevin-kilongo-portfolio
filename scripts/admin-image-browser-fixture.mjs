// Reproducible setup/cleanup for a manual browser check. No auth changes.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { verifyTarget, sql, quote } from './dev-tools.mjs'
import { supabaseRequest } from '../server/admin/supabase.mjs'
verifyTarget()
const file = 'node_modules/.cache/admin-image-browser/manifest.local.json'
if (process.argv.includes('--prepare')) {
  if (existsSync(file) && !JSON.parse(readFileSync(file, 'utf8')).cleaned) throw Error('Ancienne recette non nettoyée')
  const actor = process.argv[process.argv.indexOf('--actor') + 1]
  assert(/^[a-f0-9-]{36}$/.test(actor), 'UID administrateur requis')
  assert.equal(sql(`select count(*) n from portfolio.admin_members where user_id=${quote(actor)} and active;`)[0].n, 1)
  const slug = 'test-images-interface-20261103-9e21'
  assert.equal(sql(`select count(*) n from portfolio.projects where slug=${quote(slug)};`)[0].n, 0)
  const imports = sql(`select id from portfolio.image_imports where actor=${quote(actor)};`)
  writeFileSync(file, JSON.stringify({ actor, slug, previousImports: imports.map(i => i.id), names: ['test-vert.png', 'test-bronze.jpg', 'faux-format.png'], cleaned: false }, null, 2))
  console.log('Fixture navigateur réservée : ' + slug)
} else if (process.argv.includes('--cleanup')) {
  const manifest = JSON.parse(readFileSync(file, 'utf8'))
  assert(!manifest.cleaned)
  const candidates = sql(`select id,incoming_key,final_key from portfolio.image_imports where actor=${quote(manifest.actor)} and original_name in(${manifest.names.map(quote).join(',')});`).filter(i => !manifest.previousImports.includes(i.id))
  const ids = candidates.length ? candidates.map(i => quote(i.id)).join(',') : 'null'
  const slug = quote(manifest.slug)
  sql(`begin;
  do $$ begin if exists(select 1 from portfolio.projects p join portfolio.release_projects r on r.project_id=p.id where p.slug=${slug}) then raise exception 'Fixture publiée : nettoyage automatique refusé'; end if; if exists(select 1 from portfolio.projects where slug=${slug} and legacy_id is not null) then raise exception 'Projet importé : refus'; end if; end $$;
  delete from portfolio.project_workspaces where project_id in(select id from portfolio.projects where slug=${slug});
  delete from portfolio.revision_media where revision_id in(select r.id from portfolio.project_revisions r join portfolio.projects p on p.id=r.project_id where p.slug=${slug});
  delete from portfolio.project_revisions where project_id in(select id from portfolio.projects where slug=${slug});
  delete from portfolio.projects where slug=${slug};
  delete from portfolio.image_imports where id in(${ids}); delete from portfolio.media where id in(${ids}); commit;`)
  for (const [bucket, column] of [['portfolio-incoming', 'incoming_key'], ['portfolio-private', 'final_key']]) {
    if (candidates.length) assert((await supabaseRequest('/storage/v1/object/' + bucket, { method: 'DELETE', key: process.env.SUPABASE_DEV_SECRET_KEY, body: { prefixes: candidates.map(i => i[column]) } })).status < 300)
  }
  writeFileSync(file, JSON.stringify({ ...manifest, cleaned: true }, null, 2)); console.log('Seuls le projet et les imports de la recette navigateur sont nettoyés.')
} else throw Error('Choisir --prepare --actor UID ou --cleanup')
