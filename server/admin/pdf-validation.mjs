import { PDFDocument, PDFDict, PDFArray, PDFName, PDFString, PDFHexString, PDFRef, PDFStream } from 'pdf-lib'
import { createHash } from 'node:crypto'
import { SiteError } from './site.mjs'
export const PDF_LIMIT = 20 * 1024 ** 2
export async function validatePDF(bytes, announcedSize) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > PDF_LIMIT) throw new SiteError(413, 'Le PDF doit peser au maximum 20 Mio.')
  if (bytes.length !== announcedSize || !/^%PDF-1\.[0-9]|^%PDF-2\.0/.test(bytes.subarray(0, 9).toString('ascii')) || !bytes.subarray(-2048).includes(Buffer.from('%%EOF'))) throw new SiteError(422, 'Le contenu reçu n’est pas un PDF complet conforme.')
  let task, timer
  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false, throwOnInvalidObject: true })
    if (pdf.isEncrypted || pdf.getPageCount() < 1 || pdf.getPageCount() > 100) throw Error('Pages ou chiffrement')
    const objects = pdf.context.enumerateIndirectObjects()
    if (objects.length > 30000) throw Error('Trop d’objets')
    const seen = new Set()
    function inspect(object, depth = 0) {
      if (depth > 100) throw Error('Structure trop profonde')
      if (object instanceof PDFRef) return
      if (seen.has(object)) return; seen.add(object)
      if (object instanceof PDFStream) return inspect(object.dict, depth + 1)
      if (object instanceof PDFArray) { for (const value of object.asArray()) inspect(value,depth+1); return }
      if (!(object instanceof PDFDict)) return
      for (const [key, value] of object.entries()) {
        const name = key.decodeText()
        if (['JS','JavaScript','AA','OpenAction','AcroForm','XFA','EmbeddedFile','EmbeddedFiles','RichMedia'].includes(name)) throw Error('Contenu actif ou fichier joint')
        if (name === 'Type' && value instanceof PDFName && ['EmbeddedFile','Filespec','RichMedia'].includes(value.decodeText())) throw Error('Fichier joint ou contenu actif')
        if (name === 'S' && value instanceof PDFName && ['JavaScript','Launch','SubmitForm','ImportData','GoToR','GoToE','Rendition','Movie','Sound'].includes(value.decodeText())) throw Error('Action active')
        if (name === 'URI') {
          const resolved = pdf.context.lookup(value)
          if (!(resolved instanceof PDFString || resolved instanceof PDFHexString)) throw Error('URI invalide')
          const uri = resolved.decodeText(), url = new URL(uri)
          if (!['https:','http:','mailto:','tel:'].includes(url.protocol) || /[\r\n]/.test(uri)) throw Error('Protocole interdit')
        }
        inspect(value,depth+1)
      }
    }
    for (const [, object] of objects) inspect(object)
    for (const page of pdf.getPages()) { const { width, height } = page.getSize(); if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > 20000 || height > 20000) throw Error('Page hors limites') }
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    task = getDocument({ data: new Uint8Array(bytes), stopAtErrors: true, isEvalSupported: false, useWorkerFetch: false, disableFontFace: true, useSystemFonts: true, maxImageSize: 30000000, verbosity: 0 })
    const parse = async () => {
      const document = await task.promise
      if (document.numPages !== pdf.getPageCount() || (await document.getJSActions())?.size || (await document.getAttachments())?.size) throw Error('Document actif ou incohérent')
      let operators = 0
      for (let n = 1; n <= document.numPages; n++) {
        const page = await document.getPage(n), list = await page.getOperatorList()
        operators += list.fnArray.length
        if (list.fnArray.length > 200000 || operators > 2000000) throw Error('Document trop complexe')
        page.cleanup()
      }
      return document.numPages
    }
    const pages = await Promise.race([parse(), new Promise((_, reject) => { timer = setTimeout(() => reject(new SiteError(422,'PDF trop complexe : validation limitée à 45 secondes.')),45000) })])
    return { pages, sha: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length }
  } catch (e) {
    if (e instanceof SiteError) throw e
    throw new SiteError(422, 'PDF refusé : structure/pages illisibles, chiffrement, contenu actif, formulaire ou pièce jointe. Maximum 100 pages.')
  } finally { clearTimeout(timer); if (task) await task.destroy().catch(() => {}) }
}
