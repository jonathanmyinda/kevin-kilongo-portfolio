import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve, relative } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const media = JSON.parse(await readFile(resolve(root, 'src/data/published-media.json'), 'utf8'))
const expected = new Set(['favicon.svg', 'documents/portfolio-kevin-kilongo-munganga.pdf', 'fonts/OFL-Oswald.txt', 'fonts/oswald-latin.woff2', 'fonts/oswald-latin-ext.woff2'])
function collect(value) {
  if (!value || typeof value !== 'object') return
  if (typeof value.src === 'string' && value.src.startsWith('/images/')) expected.add(value.src.slice(1))
  for (const child of Object.values(value)) collect(child)
}
collect(media)
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? files(resolve(dir, entry.name)) : resolve(dir, entry.name)))).flat()
}
const publicFiles = (await files(resolve(root, 'public'))).map((file) => relative(resolve(root, 'public'), file).replaceAll('\\', '/'))
assert.deepEqual(new Set(publicFiles), expected, 'public doit contenir uniquement les médias et fichiers utilisés')
for (const file of publicFiles) assert.equal((await stat(resolve(root, 'dist', file))).size, (await stat(resolve(root, 'public', file))).size, file)
assert(!((await files(resolve(root, 'dist'))).some((file) => /\.(?:md|mp4|env|log)$/.test(file))), 'Fichier interne dans dist')
const vercel = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'))
assert.equal(vercel.framework, 'vite')
assert.equal(vercel.buildCommand, 'npm run build')
assert.equal(vercel.outputDirectory, 'dist')
assert.deepEqual(vercel.rewrites, [{ source: '/(.*)', destination: '/index.html' }])
const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)
const forbidden = /(?:^|\/)(?:node_modules|dist|\.vercel|__pycache__)(?:\/|$)|(?:^|\/)\.env(?!\.example$)|\.pyc$|^docs\/content\/(?:pdf-media-originals\/|site-reference\/(?:media|source|review)\/|step7-media-review\.jpg)/
for (const path of paths) {
  assert(!forbidden.test(path), `Fichier local destiné au commit : ${path}`)
  if (!/\.(?:js|jsx|mjs|json|md|txt|example|ya?ml)$/.test(path)) continue
  const text = await readFile(resolve(root, path), 'utf8')
  const secret = /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/
  assert(!secret.test(text), `Secret potentiel : ${path}`)
}
console.log(`Publication vérifiée : ${publicFiles.length} fichiers publics utilisés, configuration SPA et ${paths.length} fichiers candidats sans secret détecté.`)
