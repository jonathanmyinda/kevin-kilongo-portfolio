import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { devConfig } from './supabase.mjs'
export const imageLimits = Object.freeze({ input: 6291456, output: 3145728, pixels: 20000000, side: 6000 })
const types = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }
function animatedContainer(bytes, format) {
  // libpng may expose only frame 1 of APNG. Inspect actual container chunks too,
  // never search for an arbitrary substring inside compressed pixel data.
  let position = format === 'png' ? 8 : 12
  while ((format === 'png' || format === 'webp') && position + (format === 'png' ? 12 : 8) <= bytes.length) {
    const png = format === 'png', length = png ? bytes.readUInt32BE(position) : bytes.readUInt32LE(position + 4)
    const tag = bytes.subarray(position + (png ? 4 : 0), position + (png ? 8 : 4)).toString('ascii')
    if (tag === 'acTL' || tag === 'ANIM' || tag === 'ANMF') return true
    const step = png ? length + 12 : length + 8 + length % 2
    if (step > bytes.length - position) break
    position += step
  }
  return false
}
export class ImageError extends Error { constructor(status, message) { super(message); this.status = status } }
export async function validateImage(bytes, mime, size) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > imageLimits.input) throw new ImageError(413, 'L’image doit peser au maximum 6 Mio.')
  if (!types[mime] || bytes.length !== size) throw new ImageError(422, 'Le fichier reçu ne correspond pas au format ou au poids annoncé.')
  const signature = mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
  // Do not even invoke a decoder for SVG/PDF/other unsupported containers.
  if (!signature) throw new ImageError(422, 'Le contenu ne correspond pas au format JPEG, PNG ou WebP annoncé.')
  try {
    const input = sharp(bytes, { failOn: 'warning', limitInputPixels: imageLimits.pixels, sequentialRead: true })
    const m = await input.metadata()
    if (m.format !== types[mime] || animatedContainer(bytes, m.format) || (m.pages || 1) !== 1 || !m.width || !m.height || m.width > 6000 || m.height > 6000 || m.width * m.height > imageLimits.pixels) throw Error('Format ou dimensions')
    // Decode ALL pixels, honour orientation, convert colour, strip EXIF/XMP.
    const { data, info } = await input.rotate().toColourspace('srgb').webp({ quality: 90, effort: 4 }).toBuffer({ resolveWithObject: true })
    if (data.length > imageLimits.output) throw new ImageError(413, 'L’image traitée dépasse 3 Mio. Réduisez ses dimensions puis réessayez.')
    return { bytes: data, width: info.width, height: info.height, sha: createHash('sha256').update(data).digest('hex') }
  } catch (e) {
    if (e instanceof ImageError) throw e
    throw new ImageError(422, 'Image refusée : contenu illisible, format différent, animation ou dimensions excessives (6 000 px par côté, 20 mégapixels).')
  }
}
const validId = id => typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
export async function imageAction({ action, body, token, actor, request, rpc }) {
  const key = process.env.SUPABASE_DEV_SECRET_KEY
  if (!key?.startsWith('sb_secret_')) throw new ImageError(503, 'Validation des images non configurée côté serveur.')
  const service = async (name, args) => {
    const r = await request('/rest/v1/rpc/' + name, { method: 'POST', key, body: { ...args, p_actor: actor } })
    if (r.status >= 400) {
      if (r.status === 403) throw new ImageError(403, 'Accès administrateur refusé.')
      if (r.status === 409 && name === 'service_image_delete_claim') {
        let titles = []; try { titles = JSON.parse(r.data.details).versions.map(v => v.title) } catch { /* Generic message remains accurate. */ }
        throw new ImageError(409, 'Suppression refusée : fichier encore référencé par une publication, une version conservée ou un autre contenu.' + (titles.length ? ' Projets : ' + [...new Set(titles)].slice(0, 3).join(', ') + '.' : ''))
      }
      if (r.status === 409) throw new ImageError(409, 'Validation en cours ou interrompue. Réessayez dans une minute.')
      if (r.status < 500) throw new ImageError(400, 'Import expiré, supprimé ou non autorisé. Choisissez à nouveau le fichier si nécessaire.')
      throw new ImageError(503, 'Service des images indisponible. Réessayez.')
    }
    return r.data
  }
  const removeObject = async (bucket, path) => {
    const r = await request('/storage/v1/object/' + bucket, { method: 'DELETE', key, body: { prefixes: [path] } })
    if (r.status >= 300) throw new ImageError(503, 'Nettoyage interrompu. Le fichier reste protégé ; réessayez.')
    const check = await request(`/storage/v1/object/authenticated/${bucket}/${path}`, { key, binary: true })
    let missing = check.status === 404
    if (check.status === 400) {
      try { const error = JSON.parse(check.data.toString()); missing = error.error === 'not_found' || String(error.statusCode) === '404' } catch { /* An unreadable response is not proof of deletion. */ }
    }
    if (!missing) throw new ImageError(503, 'Suppression non confirmée. Réessayez.')
  }
  const result = async id => {
    const list = await rpc('admin_image_library', {}, token), image = list.find(i => i.id === id)
    if (!image || image.deleting) throw new ImageError(409, 'Image indisponible ou en cours de suppression.')
    return image
  }
  if (action === 'images') return rpc('admin_image_library', {}, token)
  if (action === 'image-begin') {
    if (typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 180 || !types[body.mime] || !Number.isInteger(body.bytes) || body.bytes < 1 || body.bytes > imageLimits.input) throw new ImageError(413, 'Choisissez un JPEG, PNG ou WebP de 6 Mio maximum.')
    const i = await rpc('admin_begin_image', { p_name: body.name, p_mime: body.mime, p_bytes: body.bytes }, token)
    const signed = await request('/storage/v1/object/upload/sign/portfolio-incoming/' + i.incomingKey, { method: 'POST', key, body: {} })
    if (signed.status >= 300 || !signed.data?.url) throw new ImageError(503, 'Autorisation d’import indisponible. Réessayez.')
    const url = new URL('/storage/v1' + signed.data.url, devConfig().url)
    if (url.origin !== devConfig().url || !url.pathname.includes('/portfolio-incoming/' + i.incomingKey)) throw new ImageError(503, 'Autorisation invalide.')
    return { id: i.id, uploadUrl: url.href }
  }
  if (action === 'image-cleanup') {
    const entries = await service('service_image_cleanup', {}); let cleaned = 0
    for (const i of entries) {
      await removeObject('portfolio-incoming', i.incomingKey)
      if (i.finalKey) await removeObject('portfolio-private', i.finalKey)
      await service('service_image_cleanup_finish', { p_id: i.id }); cleaned++
    }
    return { cleaned }
  }
  if (!validId(body.id)) throw new ImageError(400, 'Identifiant d’image invalide.')
  if (action === 'image-delete') {
    if (body.confirm !== true) throw new ImageError(400, 'Confirmation de suppression requise.')
    const deletion = await service('service_image_delete_claim', { p_media: body.id })
    await removeObject('portfolio-private', deletion.key)
    await service('service_image_delete_finish', { p_media: body.id })
    return { deleted: true }
  }
  const i = await service('service_image_claim', { p_id: body.id })
  if (i.state === 'ready') return result(i.media_id)
  try {
    const raw = await request('/storage/v1/object/authenticated/portfolio-incoming/' + i.incoming_key, { key, binary: true })
    if (raw.status !== 200) throw new ImageError(503, 'Transfert absent ou incomplet. Réessayez l’import sans fermer votre brouillon.')
    const image = await validateImage(raw.data, i.declared_mime, i.declared_bytes)
    const uploaded = await request('/storage/v1/object/portfolio-private/' + i.final_key, { method: 'POST', key, mime: 'image/webp', body: image.bytes })
    if (uploaded.status >= 300) {
      // Retry after a lost response: never overwrite; require identical bytes.
      const previous = await request('/storage/v1/object/authenticated/portfolio-private/' + i.final_key, { key, binary: true })
      if (previous.status !== 200 || createHash('sha256').update(previous.data).digest('hex') !== image.sha) throw new ImageError(503, 'Enregistrement de l’image interrompu. Réessayez.')
    }
    const id = await service('service_image_finish', { p_id: body.id, p_bytes: image.bytes.length, p_width: image.width, p_height: image.height, p_sha: image.sha })
    return result(id)
  } catch (e) {
    try { await service('service_image_fail', { p_id: body.id, p_reject: e.status === 422 || e.status === 413 }) } catch { /* Lease expiry allows recovery without exposing pending bytes. */ }
    throw e
  }
}
