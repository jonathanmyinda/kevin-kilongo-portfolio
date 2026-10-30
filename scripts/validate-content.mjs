import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'))
const projects = await readJson('src/data/projects.json')
const profile = await readJson('src/data/profile.json')
const selection = await readJson('src/data/homepage-selection.json')
const manifest = await readJson('docs/content/image-manifest.json')
const summary = await readJson('docs/content/extraction-summary.json')
const sourceLocations = await readJson('docs/content/pdf-source-locations.json')
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')

assert.equal(projects.length, 18)
assert.equal(new Set(projects.map((p) => p.id)).size, 18)
assert.equal(new Set(projects.map((p) => p.slug)).size, 18)
assert.equal(selection.length, 6)
assert.equal(new Set(selection.map((p) => p.projectId)).size, 6)
for (const item of selection) assert(projects.some((p) => p.id === item.projectId))
const images = [...projects.flatMap((p) => p.images), profile.portrait]
assert.deepEqual(manifest, images)
assert.equal(images.length, summary.totalImages)
assert.equal(new Set(images.map((im) => im.src)).size, images.length)
for (const project of projects) {
  assert(project.images.some((im) => im.src === project.coverImage))
  for (const im of project.images) {
    assert(project.sourcePages.includes(im.sourcePage))
    assert(im.src.startsWith(`/images/${project.slug}/`))
    assert(im.alt.startsWith(project.title))
  }
}
let total = 0
for (const im of images) {
  assert(im.src.startsWith('/images/') && !im.src.includes('..'))
  const bytes = await readFile(new URL(sourceLocations[im.src] || `public${im.src}`, root))
  assert.equal(bytes.length, im.bytes, im.src)
  assert.equal(hash(bytes), im.sha256, im.src)
  assert(im.alt && im.width > 0 && im.height > 0)
  total += bytes.length
}
assert.equal(total, summary.totalImageBytes)
const pdf = await readFile(new URL(`public${profile.portfolio.src}`, root))
assert.equal(hash(pdf), profile.portfolio.sha256)
assert.equal(pdf.length, profile.portfolio.bytes)
// Optional original PDF: verifies the unchanged download and every native image
// against the source through the separate Python audit performed during extraction.
if (process.argv[2]) {
  const original = await readFile(process.argv[2])
  assert.equal(hash(original), hash(pdf), 'La copie PDF diffère de la source')
}
assert((await stat(fileURLToPath(root))).isDirectory())
console.log(`Sources valides : ${projects.length} projets, ${images.length} images originales archivées, ${total} octets ; PDF et sélection vérifiés.`)
