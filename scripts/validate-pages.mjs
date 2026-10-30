import assert from 'node:assert/strict'
import { readFile, stat, mkdir, writeFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { build } from 'vite'
import react from '@vitejs/plugin-react'

// This checks actual React route output, not browser layout or interactions.
const cache = new URL('../node_modules/.cache/portfolio-page-check/', import.meta.url)
assert(fileURLToPath(cache).startsWith(fileURLToPath(new URL('../node_modules/.cache/', import.meta.url))))
await mkdir(cache, { recursive: true })
const sourcePath = (path) => fileURLToPath(new URL(`../src/${path}`, import.meta.url)).replaceAll('\\', '/')
const entry = new URL('entry.jsx', cache)
await writeFile(entry, `export { PortfolioRoutes } from ${JSON.stringify(sourcePath('App.jsx'))};\nexport * from ${JSON.stringify(sourcePath('data/catalog.js'))};\n`)
try {
  const result = await build({ configFile: false, plugins: [react()], logLevel: 'error', build: { ssr: fileURLToPath(entry), write: false, minify: false }, ssr: { external: ['react', 'react-dom', 'react-router'] } })
  const output = result.output.find((item) => item.type === 'chunk' && item.isEntry)
  const compiled = new URL('compiled.mjs', cache)
  await writeFile(compiled, output.code)
  const { PortfolioRoutes, projects, featuredProjects, filters, filterProjects, contactLinks, profile, serviceImages, perspectives } = await import(compiled.href)
  const render = (path) => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(PortfolioRoutes)))
  const unescape = (text) => text.replaceAll('&amp;', '&').replaceAll('&#x27;', "'")
  const countCards = (html) => [...html.matchAll(/<article class="project-card/g)].length
  const checkPage = async (html) => {
    assert.equal([...html.matchAll(/<h1(?:\s|>)/g)].length, 1, 'Un seul h1 attendu')
    assert(html.includes('id="main-content"'))
    assert(!/(?:issu(?:e)? du site|extraite? du PDF|selon (?:le document|le portfolio)|contenu vérifié|média identifié|Source\s*:|Référence\s*:|composition originale|complémentaires attribuées)/i.test(html), 'Note de fabrication dans les textes ou alternatives publics')
    assert(!/<p\b[^>]*>\s*<\/p>/.test(html), 'Paragraphe vide après nettoyage')
    assert(!/en cours¹|En cours.*selon le portfolio/.test(html), 'Statut actuel non confirmé')
    assert(!html.includes(profile.contact.address), 'Adresse résidentielle exposée')
    assert(!html.includes('tiktok.com'), 'Aucune URL TikTok documentée')
    for (const tag of html.matchAll(/<img\b[^>]*>/g)) {
      assert(/alt="[^"]+"/.test(tag[0]), 'Alternative manquante')
      assert(/width="\d+"/.test(tag[0]) && /height="\d+"/.test(tag[0]), 'Dimensions manquantes')
      const src = tag[0].match(/src="([^"]+)"/)[1]
      await stat(new URL(`../public${src}`, import.meta.url))
    }
    for (const match of html.matchAll(/href="([^"]+)"/g)) {
      const href = unescape(match[1])
      assert.notEqual(href, '#')
      if (href.startsWith('/projets/')) assert(projects.some((p) => href === `/projets/${p.slug}`), `Fiche inconnue : ${href}`)
      if (href.startsWith('/#')) assert(['/#contact', '/#a-propos', '/#expertises', '/#perspectives'].includes(href))
    }
  }
  const home = render('/')
  assert(!/<form\b/.test(home), 'Le formulaire de contact est temporairement masqué')
  await checkPage(home)
  const perspectivesLocation = render('/#perspectives')
  assert(/<a\b[^>]*aria-current="location"[^>]*>Perspectives<\/a>/.test(perspectivesLocation), 'Perspectives doit indiquer la section courante')
  assert(!/<a\b[^>]*aria-current="location"[^>]*>Perspectives<\/a>/.test(home), 'Perspectives ne doit pas rester actif hors de son ancre')
  assert(/<a\b[^>]*aria-current="page"[^>]*>Projets<\/a>/.test(render('/projets')), 'Une route active doit indiquer aria-current=page')
  const homeText = unescape(home.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ')
  for (const signature of ['Architecture de sens, héritage en mouvement', 'Patrimoine & modernité : une même architecture']) assert.equal(homeText.split(signature).length - 1, 1)
  assert.equal(countCards(home), 6)
  for (const item of featuredProjects) assert(home.includes(`/projets/${item.slug}`))
  for (const id of ['expertises', 'a-propos', 'contact', 'selection', 'perspectives']) assert(home.includes(`id="${id}"`))
  for (const href of Object.values(contactLinks)) assert(home.includes(`href="${href}"`))
  assert.equal(contactLinks.whatsapp, 'https://wa.me/message/6SE5RNJA3PEJM1')
  for (const social of profile.socials) assert(home.includes(`href="${social.url}"`))
  assert(!home.includes('500 $') && !home.includes('8h00'))
  assert(!/<video\b/.test(home), 'Pas de vidéo à charger')
  assert.equal(perspectives.length, 4)
  for (const item of perspectives) assert(!featuredProjects.some((project) => project.coverImage === item.image.src), 'Perspective répétant une couverture de sélection')
  assert(home.includes(`download="${profile.portfolio.downloadName}"`))
  assert(home.includes(`href="${profile.portfolio.src}"`))
  const allCategories = new Set(projects.map((p) => p.category))
  const assignedCategories = filters.slice(1).flatMap((filter) => filter.categories)
  assert.deepEqual(new Set(assignedCategories), allCategories)
  assert.equal(assignedCategories.length, allCategories.size)
  for (const filter of filters) {
    const path = filter.id === 'tous' ? '/projets' : `/projets?categorie=${filter.id}`
    const html = render(path)
    await checkPage(html)
    assert.equal(countCards(html), filterProjects(filter.id).length)
    assert(filter.id === 'tous' || filterProjects(filter.id).length > 1)
    assert.equal([...html.matchAll(/aria-pressed="true"/g)].length, 1)
  }
  assert.equal(countCards(render('/projets?categorie=inconnue')), 18)
  for (const project of projects) {
    const html = render(`/projets/${project.slug}`)
    await checkPage(html)
    for (const image of project.images) assert(html.includes(`src="${image.src}"`), image.src)
    assert(html.includes('Ma mission'))
    assert(html.includes(project.publicRole), 'Rôle exact absent de la fiche')
    if (project.agency) assert(html.includes(project.agency))
    assert(!/non précisés|à confirmer|>null</.test(html))
    if (project.number === 5) assert(html.includes('Projet académique — TFE'))
    if (project.number === 9) assert(!html.includes('chantier indiqué en cours'))
    if (project.number === 17) assert(!html.includes('attachements techniques'))
  }
  for (const path of ['/inconnue', '/projets/slug-inconnu', '/projets/rhom-city/inconnue']) {
    const html = render(path)
    await checkPage(html)
    assert(html.includes('404 / Page introuvable'))
    assert(html.includes('href="/projets"'))
  }
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
  assert(css.includes('prefers-reduced-motion'))
  console.log('Routes React validées : accueil, 18 fiches, 4 filtres, filtre inconnu et 3 URL inconnues. Médias, contacts, téléchargement et attributions contrôlés.')
  const httpArg = process.argv.find((arg) => arg.startsWith('--http='))
  if (httpArg) {
    const base = new URL(httpArg.slice(7))
    assert(['localhost', '127.0.0.1'].includes(base.hostname), 'Contrôle HTTP réservé au serveur local')
    const pagePaths = ['/', '/projets', ...projects.map((p) => `/projets/${p.slug}`), '/projets/slug-inconnu', '/inconnue']
    for (const path of pagePaths) {
      const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15000) })
      assert.equal(response.status, 200, path)
      assert((await response.text()).includes('<div id="root"></div>'), path)
    }
    const mainImages = [...projects.flatMap((p) => p.images), profile.portrait, profile.heroPortrait, ...Object.values(serviceImages)]
    const images = mainImages.flatMap((image) => [image, ...(image.variants || [])])
    for (const path of [...images.map((im) => im.src), profile.portfolio.src]) {
      const response = await fetch(new URL(path, base), { method: 'HEAD', signal: AbortSignal.timeout(15000) })
      assert.equal(response.status, 200, path)
      assert(response.headers.get('content-type')?.startsWith(path.endsWith('.pdf') ? 'application/pdf' : 'image/'), path)
    }
    const dependencies = new Set()
    for (const path of ['/src/main.jsx', '/src/App.jsx', '/src/index.css']) {
      const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15000) })
      assert.equal(response.status, 200, path)
      const code = await response.text()
      assert(!code.includes('vite-error-overlay'), path)
      for (const match of code.matchAll(/["'](\/node_modules\/\.vite\/deps\/[^"']+)["']/g)) dependencies.add(new URL(match[1], base).href)
    }
    for (const path of ['/fonts/oswald-latin.woff2', '/fonts/oswald-latin-ext.woff2']) {
      const response = await fetch(new URL(path, base), { method: 'HEAD', signal: AbortSignal.timeout(15000) })
      assert.equal(response.status, 200, path)
      assert(/font|woff/.test(response.headers.get('content-type') || ''), path)
    }
    // HTML/JS entry points can return 200 while Vite's optimized React modules
    // return 504 (Outdated Optimize Dep), leaving the client unable to mount.
    assert(dependencies.size > 0, 'Aucune dépendance de développement trouvée')
    const checkedDependencies = new Set()
    for (const url of dependencies) {
      if (checkedDependencies.has(url)) continue
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
      assert.equal(response.status, 200, `Dépendance Vite indisponible : ${url}`)
      assert(/javascript/.test(response.headers.get('content-type') || ''), url)
      const code = await response.text()
      for (const match of code.matchAll(/["'](\.\/[^"']+\.js(?:\?[^"']*)?)["']/g)) dependencies.add(new URL(match[1], url).href)
      checkedDependencies.add(url)
    }
    console.log(`HTTP local validé : ${pagePaths.length} URL, ${images.length} images, le PDF, les modules d’entrée et ${checkedDependencies.size} modules de dépendances Vite.`)
  }
  console.log('Limite : rendu statique ; affichage mobile, focus, clavier, visionneuse et console restent à tester dans un navigateur.')
} finally {
  await rm(cache, { recursive: true, force: true })
}

