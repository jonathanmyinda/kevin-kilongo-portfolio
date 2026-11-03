import { useCallback, useEffect, useState } from 'react'
import './admin.css'
import ProjectImages from './ProjectImages'
import SiteEditor from './SiteEditor'
const labels = { title: 'Titre', description: 'Description', category: 'Catégorie', location: 'Localisation', mission: 'Mission de Kévin', agency: 'Agence et crédits du projet', context: 'Contexte' }
const states = { draft: 'Brouillon', published: 'Publié', changed: 'Modifications non publiées' }
const editable = d => ({ slug: d.slug, ...Object.fromEntries(Object.keys(labels).map(k => [k, d[k] ?? ''])), images: d.images.map((i, position) => ({ id: i.id, alt: i.alt, caption: i.caption, credit: i.credit, cover: i.cover, position })) })
async function api(action, body, id) {
  let r, data
  try {
    r = await fetch(`/api/admin?action=${action}${id ? `&id=${encodeURIComponent(id)}` : ''}`, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) })
    data = await r.json()
  } catch { throw new Error('Connexion interrompue. Votre saisie est conservée. Actualisez la liste pour vérifier si la dernière opération a été enregistrée avant de réessayer.') }
  if (!r.ok) { const e = new Error(data.error || 'La demande a échoué.'); e.status = r.status; throw e }
  return data
}
export default function AdminDashboard() {
  const [user, setUser] = useState(null), [checking, setChecking] = useState(true), [busy, setBusy] = useState(false)
  const [catalog, setCatalog] = useState(null), [selected, setSelected] = useState(null), [draft, setDraft] = useState(null), [saved, setSaved] = useState('')
  const [notice, setNotice] = useState(''), [error, setError] = useState(''), [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [view, setView] = useState('projects'), [siteDirty, setSiteDirty] = useState(false), [siteBusy, setSiteBusy] = useState(false)
  const handleError = useCallback(e => { setError(e.message); if (e.status === 401 || e.status === 403) setUser(null) }, [])
  const dirty = draft != null && JSON.stringify(draft) !== saved
  async function reload() { const data = await api('projects'); setCatalog(data); return data }
  useEffect(() => {
    let active = true
    api('session').then(async u => { const c = await api('projects'); if (active) { setUser(u); setCatalog(c) } }).catch(e => { if (active && e.status !== 401) setError(e.message) }).finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!dirty && !uploading && !siteDirty && !siteBusy) return
    const warn = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, uploading, siteDirty, siteBusy])
  useEffect(() => {
    const old = document.title; document.title = 'Administration — Kevin Kilongo'
    const meta = document.createElement('meta'); meta.name = 'robots'; meta.content = 'noindex, nofollow'; document.head.append(meta)
    return () => { document.title = old; meta.remove() }
  }, [])
  const abandon = () => !(view === 'site' ? siteDirty : dirty) || window.confirm('Quitter sans enregistrer les modifications ?')
  async function operation(fn) {
    setBusy(true); setError(''); setNotice('')
    try { await fn() } catch (e) { setError(e.message); if (e.status === 401 || e.status === 403) setUser(null) } finally { setBusy(false) }
  }
  function open(p) {
    if (!abandon()) return
    const data = editable(p.data); setSelected(p); setDraft(data); setSaved(JSON.stringify(data)); setPreview(null); setError(''); setNotice('')
  }
  function create() {
    if (!abandon()) return
    setSelected({ id: null, revisionId: null }); setDraft({ title: '', description: '', category: '', location: '', mission: '', agency: '', context: '', slug: '', images: [] }); setSaved(''); setPreview(null); setError(''); setNotice('')
  }
  function field(key, value) { setDraft(d => ({ ...d, [key]: value })); setPreview(null) }
  function addImage(image) {
    setDraft(d => !d || d.images.some(i => i.id === image.id) || d.images.length >= 100 ? d : ({ ...d, images: [...d.images, { id: image.id, position: d.images.length, alt: image.defaults?.alt ?? '', caption: image.defaults?.caption ?? null, credit: image.defaults?.credit ?? null, cover: !d.images.length }] }))
    setPreview(null)
  }
  function removeImage(id) {
    setDraft(d => {
      const images = d.images.filter(i => i.id !== id).map((i, position) => ({ ...i, position }))
      if (images.length && !images.some(i => i.cover)) images[0] = { ...images[0], cover: true }
      return { ...d, images }
    }); setPreview(null)
  }
  async function save(e) {
    e.preventDefault()
    await operation(async () => {
      const result = await api('save', { projectId: selected.id, expectedRevision: selected.revisionId, data: draft })
      setSaved(JSON.stringify(draft)); setSelected(p => ({ ...p, revisionId: result.revisionId }))
      const c = await reload(); const latest = c.projects.find(p => p.data.slug === draft.slug)
      setSelected({ ...(latest || selected), revisionId: result.revisionId, status: latest?.revisionId === result.revisionId ? latest.status : 'changed' })
      setNotice('Brouillon enregistré. La version publiée reste inchangée.')
    })
  }
  async function publish() {
    if (!window.confirm('Publier cette version dans Supabase DEV ? Le site en ligne restera inchangé.')) return
    await operation(async () => { await api('publish', { projectId: selected.id, revisionId: selected.revisionId, siteId: catalog.siteId, expectedVersion: catalog.version }); const c = await reload(); setSelected(c.projects.find(p => p.id === selected.id) || selected); setNotice('Version publiée dans Supabase DEV. Le site public conserve sa source actuelle.') })
  }
  function move(index, offset) {
    const images = [...draft.images]; [images[index], images[index + offset]] = [images[index + offset], images[index]]; field('images', images.map((m, position) => ({ ...m, position })))
  }
  if (checking) return <main className="admin-shell"><p role="status">Vérification de la session…</p></main>
  return <main className="admin-shell" id="main-content">
    <header className="admin-top"><div><p>Kevin Kilongo · Développement</p><h1>Administration du portfolio</h1></div>{user && <button disabled={busy || uploading || siteBusy} onClick={() => { if (abandon()) operation(async () => { await api('logout', {}); setUser(null); setView('projects'); setSiteDirty(false); setDraft(null); setSelected(null); setNotice('Vous êtes déconnecté.') }) }}>Se déconnecter</button>}</header>
    <p className="admin-environment">Espace de développement. Les publications ne modifient pas le site en ligne.</p>
    {user && <nav className="admin-section-nav" aria-label="Rubriques de l’administration">{[['projects','Projets'],['site','Profil, services et PDF']].map(([id,label]) => <button key={id} disabled={busy || uploading || siteBusy} aria-current={view === id ? 'page' : undefined} onClick={() => { if(view !== id && abandon()){ setView(id); setDraft(null); setSelected(null); setSiteDirty(false); } }}>{label}</button>)}</nav>}
    {error && <p role="alert" className="admin-error">{error}</p>}{notice && <p role="status" className="admin-success">{notice}</p>}
    {!user ? <form className="admin-login" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); operation(async () => { const u = await api('login', { email: f.get('email'), password: f.get('password') }); setUser(u); await reload() }) }}>
      <h2>Connexion administrateur</h2><p>Accès réservé aux comptes autorisés.</p>
      <label>Adresse e-mail<input name="email" type="email" autoComplete="username" required maxLength={254} /></label>
      <label>Mot de passe<input name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>
      <button disabled={busy || uploading || siteBusy}>{busy ? 'Connexion…' : 'Se connecter'}</button>{dirty && <p>Votre saisie est conservée dans cet onglet. Reconnectez-vous pour poursuivre.</p>}
    </form> : view === 'projects' ? <div className="admin-workspace"><aside aria-label="Projets"><h2>Projets</h2><div className="admin-actions"><button disabled={busy || uploading || siteBusy} onClick={create}>Ajouter un projet</button><button disabled={busy || uploading || siteBusy} onClick={() => operation(async () => { await reload(); setNotice('Liste actualisée. Votre saisie est conservée.') })}>Actualiser la liste</button></div><ul className="admin-projects">{catalog?.projects.map(p => <li key={p.id}><button disabled={busy || uploading || siteBusy} aria-current={selected?.id === p.id ? 'true' : undefined} onClick={() => open(p)}><strong>{p.data.title}</strong><span>{states[p.status]}</span></button></li>)}</ul></aside>
      <section aria-label="Édition du projet">{draft ? <><h2>{selected.id ? 'Modifier le projet' : 'Nouveau projet'}</h2><p>{dirty ? 'Modifications non enregistrées' : 'Brouillon enregistré'}{selected.status ? ` · ${states[selected.status]}` : ''}</p><form onSubmit={save}>
        <fieldset disabled={busy || uploading || siteBusy}><legend>Informations du projet</legend><label>Adresse du projet (slug)<input value={draft.slug} onChange={e => field('slug', e.target.value)} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={180} readOnly={!!selected.id} /><small>{selected.id ? 'Adresse conservée pour préserver les liens existants.' : 'Lettres minuscules, chiffres et tirets.'}</small></label>
          {Object.entries(labels).map(([k, label]) => <label key={k}>{label}{['title', 'description', 'category', 'mission'].includes(k) ? ' *' : ''}{['description', 'mission', 'context'].includes(k) ? <textarea rows={k === 'description' ? 5 : 3} value={draft[k]} required={k !== 'context'} maxLength={k === 'description' ? 10000 : k === 'mission' ? 5000 : 1000} onChange={e => field(k, e.target.value)} /> : <input value={draft[k]} required={['title', 'category'].includes(k)} maxLength={['title', 'category'].includes(k) ? 180 : 1000} onChange={e => field(k, e.target.value)} />}</label>)}
        </fieldset><fieldset disabled={busy || uploading || siteBusy}><legend>Images et crédits</legend><ProjectImages key={selected.id || 'new'} images={draft.images} onAdd={addImage} onRemove={removeImage} api={api} onBusy={setUploading} onError={handleError} />
          {!selected.id && <label>Reprendre les médias existants d’un projet<select value="" onChange={e => { const p = catalog.projects.find(p => p.id === e.target.value); if (p) field('images', editable(p.data).images) }}><option value="">Choisir un projet…</option>{catalog.projects.map(p => <option key={p.id} value={p.id}>{p.data.title}</option>)}</select><small>Seules les images sont reprises. Vérifiez leur pertinence et conservez les crédits.</small></label>}
          {draft.images.map((image, index) => <div className="admin-image" key={image.id}><img src={`/api/admin?action=media&id=${image.id}`} alt={image.alt} loading="lazy" /><div><label><input type="radio" name="cover" checked={image.cover} onChange={() => field('images', draft.images.map((m, i) => ({ ...m, cover: i === index })))} /> Couverture</label>{['alt', 'caption', 'credit'].map(k => <label key={k}>{{ alt: 'Texte alternatif', caption: 'Légende', credit: 'Crédit' }[k]}<input value={image[k] ?? ''} required={k === 'alt'} maxLength={k === 'alt' ? 1000 : 2000} onChange={e => field('images', draft.images.map((m, i) => i === index ? { ...m, [k]: e.target.value } : m))} /></label>)}<div className="admin-actions"><button type="button" aria-label={`Retirer l’image ${index + 1} du brouillon`} onClick={() => removeImage(image.id)}>Retirer du brouillon</button><button type="button" aria-label={`Monter l’image ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}>Monter</button><button type="button" aria-label={`Descendre l’image ${index + 1}`} disabled={index === draft.images.length - 1} onClick={() => move(index, 1)}>Descendre</button></div></div></div>)}
        </fieldset><div className="admin-actions"><button disabled={busy || uploading || siteBusy || !dirty || !draft.images.length} type="submit">{busy ? 'Veuillez patienter…' : 'Enregistrer le brouillon'}</button><button disabled={busy || uploading || siteBusy || dirty || !selected.revisionId} type="button" onClick={() => operation(async () => setPreview(await api('preview', undefined, selected.revisionId)))}>Prévisualiser</button><button disabled={busy || uploading || siteBusy || dirty || !selected.revisionId || selected.status === 'published'} type="button" onClick={publish}>Publier</button></div>{dirty && <p>Enregistrez le brouillon avant de le prévisualiser ou de le publier.</p>}</form>
        {preview && <section className="admin-preview" aria-label="Aperçu privé"><h2>Aperçu privé</h2><h3>{preview.title}</h3><p>{preview.category}{preview.location ? ` · ${preview.location}` : ''}</p><p>{preview.description}</p><p><strong>Mission :</strong> {preview.mission}</p>{preview.agency && <p><strong>Agence :</strong> {preview.agency}</p>}{preview.context && <p>{preview.context}</p>}{preview.images.map(i => <figure key={i.id}><img src={`/api/admin?action=media&id=${i.id}`} alt={i.alt} loading="lazy" />{(i.caption || i.credit) && <figcaption>{[i.caption, i.credit].filter(Boolean).join(' · ')}</figcaption>}</figure>)}</section>}</> : <p>Sélectionnez un projet pour modifier son brouillon.</p>}</section>
    </div> : null}
    {view === 'site' && <div hidden={!user}><SiteEditor api={api} authenticated={!!user} onError={handleError} onDirty={setSiteDirty} onBusy={setSiteBusy} /></div>}
  </main>
}
