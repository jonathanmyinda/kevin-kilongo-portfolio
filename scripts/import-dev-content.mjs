import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { prepareImport } from './admin-import.mjs'
import { verifyTarget, sql, quote } from './dev-tools.mjs'
import { supabaseRequest } from '../server/admin/supabase.mjs'
verifyTarget()
const prepared = await prepareImport()
if (prepared.report.errors.length) throw new Error(prepared.report.errors.join('\n'))
console.log(JSON.stringify({ projects: prepared.report.projects, files: prepared.files.length, errors: prepared.report.errors.length, warnings: prepared.report.warnings.length }))
const path = 'node_modules/.cache/admin-workflow/import-manifest.local.json'
writeFileSync(path, JSON.stringify(prepared))
if (!process.argv.includes('--apply') && !process.argv.includes('--validate-files')) { console.log('Simulation uniquement. Ajouter --validate-files pour décoder, --apply pour importer sur la cible DEV vérifiée.'); process.exit(0) }
const python = process.env.PORTFOLIO_PYTHON
if (!python) throw new Error('Définir PORTFOLIO_PYTHON vers Python avec Pillow et pypdf pour vérifier les fichiers existants.')
const validation = spawnSync(python, ['scripts/validate-legacy-media.py', path], { encoding: 'utf8' })
if (validation.status !== 0) throw new Error('Décodage des médias existants refusé : ' + validation.stderr)
console.log(validation.stdout.trim())
if (!process.argv.includes('--apply')) process.exit(0)
// Idempotent INSERTs preserve previously edited revisions and published content.
sql(prepared.sql)
const key = process.env.SUPABASE_DEV_SECRET_KEY
if (!key?.startsWith('sb_secret_')) throw new Error('Clé serveur DEV locale requise')
let completed = 0
async function transfer(file) {
  const bytes = readFileSync(file.source)
  if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error('Source modifiée après contrôle')
  const existing = await supabaseRequest('/storage/v1/object/authenticated/portfolio-private/' + file.objectKey, { key, binary: true })
  if (existing.status === 200) {
    if (createHash('sha256').update(existing.data).digest('hex') !== file.sha256) throw new Error('Objet distant différent : aucun écrasement autorisé')
  } else {
    if (existing.status >= 500) throw new Error('Storage indisponible')
    const r = await supabaseRequest('/storage/v1/object/portfolio-private/' + file.objectKey, { method: 'POST', key, mime: file.mime, body: bytes })
    if (r.status >= 300) throw new Error('Import Storage refusé : ' + r.status)
  }
  if (++completed % 10 === 0) console.log(`${completed}/${prepared.files.length} médias vérifiés/importés`)
}
// Small bounded batches; every in-flight transfer settles before reporting failure.
for (let i = 0; i < prepared.files.length; i += 3) {
  const batch = await Promise.allSettled(prepared.files.slice(i, i + 3).map(transfer))
  const failed = batch.find(result => result.status === 'rejected')
  if (failed) throw failed.reason
}
sql(`update portfolio.media m set validated=true from (values ${prepared.files.map(f => `(${quote(f.id)}::uuid,${quote(f.sha256)})`).join(',')}) checked(id,sha) where m.id=checked.id and m.sha256=checked.sha and not m.validated;`)
console.log('Import DEV terminé : 18 projets en brouillon, fichiers contrôlés en stockage privé. Aucune publication automatique.')
