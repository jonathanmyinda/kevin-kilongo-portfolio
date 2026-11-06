async function run() {
  const response = await fetch('/api/content', { cache: 'no-store' })
  const { source, version, content } = await response.json()
  if (response.status !== 200 || source !== 'supabase-prod' || version !== 1) {
    return { status: response.status, source, version }
  }

  const paths = new Map()
  function add(image, owner) {
    if (!image) return
    const variants = (image.srcSet || '').split(', ').filter(Boolean)
    for (const path of [image.src, ...variants.map(value => value.split(' ')[0])]) {
      if (!path.startsWith('/api/media?')) throw new Error('Chemin média inattendu')
      if (!paths.has(path)) paths.set(path, new Set())
      paths.get(path).add(owner)
    }
  }
  add(content.profile.heroPortrait, 'Portrait accueil')
  add(content.profile.portrait, 'Portrait à propos')
  for (const project of content.projects) {
    for (const image of project.images) add(image, project.slug)
  }
  for (const service of content.services) add(service.image, service.title)
  for (const perspective of content.perspectives) add(perspective.image, perspective.project.slug)

  const failures = []
  const entries = [...paths]
  for (let offset = 0; offset < entries.length; offset += 8) {
    await Promise.all(entries.slice(offset, offset + 8).map(async ([path, owners]) => {
      try {
        const image = await fetch(path, { signal: AbortSignal.timeout(25000) })
        const type = image.headers.get('content-type')?.split(';')[0] ?? null
        if (image.status !== 200 || !type?.startsWith('image/')) {
          failures.push({ owners: [...owners], status: image.status, type })
        }
        await image.body?.cancel()
      } catch {
        failures.push({ owners: [...owners], error: 'Requête interrompue ou expirée' })
      }
    }))
  }

  const pdfPath = content.profile.portfolio.src
  if (!pdfPath.startsWith('/api/media?')) throw new Error('Chemin PDF inattendu')
  let pdf
  try {
    const file = await fetch(pdfPath, { signal: AbortSignal.timeout(45000) })
    const bytes = new Uint8Array(await file.arrayBuffer())
    pdf = {
      status: file.status,
      type: file.headers.get('content-type')?.split(';')[0],
      bytes: bytes.length,
      signature: new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-',
    }
  } catch {
    pdf = { error: 'Requête interrompue ou expirée' }
  }
  return { status: response.status, source, version, projects: content.projects.length, images: paths.size, failures, pdf }
}

run().then(result => {
  document.querySelector('#result').textContent = JSON.stringify(result, null, 2)
}).catch(() => {
  document.querySelector('#result').textContent = 'Contrôle interrompu'
})
