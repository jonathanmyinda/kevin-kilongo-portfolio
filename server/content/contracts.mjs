// Server/domain module, deliberately not imported by the portfolio React app.
export const limits = Object.freeze({ image: 10 * 1024 ** 2, pdf: 20 * 1024 ** 2, pixels: 30_000_000 })
export const projectFields = ['title', 'description', 'category', 'location', 'mission', 'agency', 'context']
export function validateProject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Projet invalide')
  const allowed = new Set([...projectFields, 'id', 'slug', 'images'])
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new Error(`Champ non autorisé : ${key}`)
  for (const key of ['title', 'description', 'category', 'mission']) if (typeof input[key] !== 'string' || !input[key].trim()) throw new Error(`Champ obligatoire : ${key}`)
  for (const key of ['location','agency','context']) if (input[key] != null && (typeof input[key] !== 'string' || input[key].length > 1000)) throw new Error(`Champ invalide : ${key}`)
  if (input.title.length > 180 || input.description.length > 10000 || input.mission.length > 5000) throw new Error('Texte trop long')
  if (input.category.length > 180 || input.slug.length > 180) throw new Error('Texte trop long')
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug)) throw new Error('Slug invalide')
  if (!Array.isArray(input.images) || input.images.length === 0 || input.images.length > 100 || input.images.filter(i => i?.cover === true).length !== 1) throw new Error('Une couverture obligatoire')
  const ids = new Set()
  input.images.forEach((image, position) => {
    if (!image || typeof image.id !== 'string' || ids.has(image.id) || typeof image.alt !== 'string' || !image.alt.trim() || image.alt.length > 1000 || typeof image.cover !== 'boolean' || image.position !== position) throw new Error('Galerie invalide')
    for (const key of ['caption','credit']) if (image[key] != null && (typeof image[key] !== 'string' || image[key].length > 2000)) throw new Error('Légende ou crédit invalide')
    ids.add(image.id)
    for (const key of Object.keys(image)) if (!['id','alt','caption','credit','cover','position'].includes(key)) throw new Error('Champ média non autorisé')
  })
  return input
}
export function validateFile(bytes, mime, dimensions) {
  if (!Buffer.isBuffer(bytes) || !bytes.length) throw new Error('Fichier vide')
  const pdf = mime === 'application/pdf'
  if (!['image/jpeg','image/png','image/webp','application/pdf'].includes(mime)) throw new Error('Format interdit')
  if (bytes.length > (pdf ? limits.pdf : limits.image)) throw new Error('Fichier trop lourd')
  const signature = pdf ? bytes.subarray(0,5).toString() === '%PDF-'
    : mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : mime === 'image/png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
        : bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP'
  if (!signature) throw new Error('Signature incompatible')
  if (!pdf && (!Number.isInteger(dimensions?.width) || !Number.isInteger(dimensions?.height) || dimensions.width <= 0 || dimensions.height <= 0 || dimensions.width * dimensions.height > limits.pixels)) throw new Error('Dimensions invalides')
  // Preliminary gate only: NOT proof of successful image decoding/PDF sanitization.
  return { preliminary: true, requiresServerValidation: true }
}
