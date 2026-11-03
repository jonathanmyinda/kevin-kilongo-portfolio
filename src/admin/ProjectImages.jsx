import { useEffect, useState } from 'react'
import './project-images.css'

const MAX = 6 * 1024 ** 2
function transfer(url, file, mime, progress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url); xhr.setRequestHeader('Content-Type', mime); xhr.timeout = 120000
    xhr.upload.onprogress = e => { if (e.lengthComputable) progress(Math.round(e.loaded * 100 / e.total)) }
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Transfert refusé ou déjà effectué. Réessayez pour vérifier le fichier reçu.'))
    xhr.onerror = xhr.ontimeout = () => reject(new Error('Transfert interrompu. Votre brouillon est conservé. Réessayez cet import.'))
    xhr.send(file)
  })
}
export default function ProjectImages({ images, onAdd, onRemove, api, onBusy, onError, single = false }) {
  const [uploads, setUploads] = useState([]), [library, setLibrary] = useState([]), [working, setWorking] = useState(false), [notice, setNotice] = useState('')
  useEffect(() => { let active = true; api('images').then(list => { if (active) setLibrary(list) }).catch(onError); return () => { active = false } }, [api, onError])
  const update = (id, value) => setUploads(list => list.map(item => item.key === id ? { ...item, ...value } : item))
  async function run(items) {
    setWorking(true); onBusy(true); setNotice('')
    try {
      for (const item of items) {
        try {
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(item.mime) || item.file.size < 1 || item.file.size > MAX) throw new Error('Choisissez un JPEG, PNG ou WebP de 6 Mio maximum.')
          let intent = item.intent
          if (!intent) {
            update(item.key, { state: 'Autorisation…', failed: false })
            intent = await api('image-begin', { name: item.file.name.slice(0, 180), mime: item.mime, bytes: item.file.size })
            update(item.key, { intent })
          }
          // On retry, finalize first: a lost response may hide a successful transfer.
          let ready
          if (item.intent) {
            try { ready = await api('image-finish', { id: intent.id }) } catch (e) { if (![400, 503].includes(e.status)) throw e }
          }
          if (!ready) {
            update(item.key, { state: 'Transfert', progress: 0, failed: false })
            await transfer(intent.uploadUrl, item.file, item.mime, progress => update(item.key, { progress }))
            update(item.key, { state: 'Validation côté serveur…', progress: 100 })
            ready = await api('image-finish', { id: intent.id })
          }
          onAdd(ready); update(item.key, { state: 'Validée et ajoutée au brouillon', failed: false, done: true, progress: 100 })
        } catch (e) {
          // A rejected/expired intent cannot be reused: the retry gets a new path.
          update(item.key, { state: e.message, failed: true, ...([400, 413, 422].includes(e.status) ? { intent: null } : {}) })
          if (e.status === 401 || e.status === 403) { onError(e); break }
        }
      }
      setLibrary(await api('images'))
    } catch (e) { onError(e) } finally { setWorking(false); onBusy(false) }
  }
  async function remove(image) {
    if (!window.confirm(`Supprimer définitivement « ${image.name} » ? Cette action est irréversible. Elle sera refusée si une version conservée utilise le fichier.`)) return
    setWorking(true); onBusy(true); setNotice('')
    try { await api('image-delete', { id: image.id, confirm: true }); onRemove(image.id); setLibrary(await api('images')); setNotice('Fichier supprimé définitivement.') } catch (e) { onError(e) } finally { setWorking(false); onBusy(false) }
  }
  async function cleanup() {
    if (!window.confirm('Nettoyer les fichiers temporaires expirés ? Les images validées et les fichiers référencés seront conservés.')) return
    setWorking(true); onBusy(true)
    try { const r = await api('image-cleanup', {}); setNotice(`${r.cleaned} import(s) temporaire(s) nettoyé(s). Les autorisations récentes expirent après un délai de sécurité de 2 h 15.`) } catch (e) { onError(e) } finally { setWorking(false); onBusy(false) }
  }
  return <div className="admin-imports">
    <label>{single ? 'Importer une image' : 'Importer des images'}<input type="file" accept="image/jpeg,image/png,image/webp" multiple={!single} disabled={working || !single && images.length >= 100} onChange={e => {
      const files = [...e.target.files].slice(0, single ? 1 : Math.max(0, 100 - images.length))
      const items = files.map(file => ({ key: crypto.randomUUID(), file, mime: file.type || ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[file.name.split('.').pop().toLowerCase()]), state: 'En attente', progress: 0 }))
      e.target.value = ''; setUploads(list => [...list, ...items]); void run(items)
    }} /><small>JPEG, PNG ou WebP · 6 Mio maximum · 6 000 px par côté · 20 mégapixels · images fixes.{single ? '' : ' Jusqu’à 100 images par projet.'}</small></label>
    <p>Chaque image reste en attente jusqu’à sa validation. Après ajout, renseignez son texte alternatif et ses crédits, puis enregistrez le brouillon.</p>
    <ul className="admin-upload-list">{uploads.map(u => <li key={u.key}><strong>{u.file.name}</strong><p role="status">{u.state}</p>{!u.failed && !u.done && <progress aria-label={`Transfert de ${u.file.name}`} value={u.progress} max="100">{u.progress} %</progress>}{u.failed && <button type="button" disabled={working} onClick={() => run([u])}>Réessayer cet import</button>}</li>)}</ul>
    <details><summary>Images importées disponibles et suppressions</summary><p>Retirer une image du brouillon conserve ses versions précédentes. Un fichier encore référencé ne peut pas être supprimé définitivement.</p>
      <button type="button" disabled={working} onClick={cleanup}>Nettoyer les imports temporaires expirés</button>
      <ul className="admin-media-library">{library.map(image => <li key={image.id}>{!image.deleting && <img src={`/api/admin?action=media&id=${image.id}`} alt="" loading="lazy" />}<strong>{image.name}</strong><span>{image.width} × {image.height} px · {image.dependencies.versions.length} version(s) conservée(s)</span><div className="admin-actions"><button type="button" disabled={working || image.deleting || images.length >= 100 || images.some(i => i.id === image.id)} onClick={() => onAdd(image)}>Ajouter au brouillon</button><button type="button" disabled={working} onClick={() => remove(image)}>{image.deleting ? 'Reprendre la suppression' : 'Supprimer définitivement'}</button></div></li>)}</ul>
      {!library.length && <p>Aucune nouvelle image validée.</p>}
    </details>{notice && <p role="status">{notice}</p>}
  </div>
}
