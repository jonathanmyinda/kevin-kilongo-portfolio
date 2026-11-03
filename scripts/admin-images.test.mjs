import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { validateImage } from '../server/admin/images.mjs'

test('décode entièrement, oriente et retire les métadonnées', async () => {
  const bytes = await sharp({ create: { width: 80, height: 40, channels: 3, background: '#359c83' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer()
  const result = await validateImage(bytes, 'image/jpeg', bytes.length)
  assert.equal(result.width, 40); assert.equal(result.height, 80)
  const m = await sharp(result.bytes).metadata()
  assert.equal(m.format, 'webp'); assert.equal(m.exif, undefined); assert.equal(m.xmp, undefined)
})
test('contenu différent, image tronquée, mauvais poids et dimensions refusés', async () => {
  const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#aabbcc' } }).png().toBuffer()
  await assert.rejects(validateImage(png, 'image/jpeg', png.length), { status: 422 })
  const truncated = png.subarray(0, Math.floor(png.length * .6))
  await assert.rejects(validateImage(truncated, 'image/png', truncated.length), { status: 422 })
  await assert.rejects(validateImage(png, 'image/png', png.length + 1), { status: 422 })
  const wide = await sharp({ create: { width: 6001, height: 1, channels: 3, background: 'white' } }).png().toBuffer()
  await assert.rejects(validateImage(wide, 'image/png', wide.length), { status: 422 })
  await assert.rejects(validateImage(Buffer.alloc(6291457), 'image/png', 6291457), { status: 413 })
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')
  await assert.rejects(validateImage(svg, 'image/png', svg.length), { status: 422 })
})
test('WebP entrant identifié et entièrement décodé', async () => {
  const bytes = await sharp({ create: { width: 12, height: 8, channels: 3, background: 'white' } }).webp().toBuffer()
  const result = await validateImage(bytes, 'image/webp', bytes.length)
  assert.equal(result.width, 12); assert.equal(result.height, 8)
})
test('transparence PNG préservée après réencodage WebP', async () => {
  const png = await sharp({ create: { width: 20, height: 20, channels: 4, background: { r: 20, g: 50, b: 80, alpha: .4 } } }).png().toBuffer()
  const result = await validateImage(png, 'image/png', png.length)
  assert.equal((await sharp(result.bytes).metadata()).hasAlpha, true)
})
test('APNG réellement animé refusé, même si le décodeur ne lit que la première frame', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACGFjVEwAAAACAAAAAPONk3AAAAAaZmNUTAAAAAAAAAAIAAAACAAAAAAAAAAAAAEACgAA8k66YgAAABZJREFUeJxj/M/A8J8BD2DCJzl8FAAAElsCDh9KSV0AAAAaZmNUTAAAAAEAAAAIAAAACAAAAAAAAAAAAAEACgAAaT1QtgAAABpmZEFUAAAAAnicY2Rg+P+fAQ9gwic5fBQAABBdAg7EQ+AwAAAAAElFTkSuQmCC', 'base64')
  await assert.rejects(validateImage(png, 'image/png', png.length), { status: 422 })
})
