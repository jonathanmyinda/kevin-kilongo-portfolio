import { useCallback, useEffect, useRef, useState } from 'react'
import './admin.css'
import ProjectWorkspace from './ProjectWorkspace'
import Icon from './AdminIcon'
import SiteEditor from './SiteEditor'
import { endAdminSession, watchAdminSession } from './idle-session.mjs'
const labels = { title: 'Titre', description: 'Description', category: 'Catégorie', location: 'Localisation', mission: 'Mission de Kévin', agency: 'Agence et crédits du projet', context: 'Contexte' }
const editable = d => ({ slug: d.slug, ...Object.fromEntries(Object.keys(labels).map(k => [k, d[k] ?? ''])), images: d.images.map((i, position) => ({ id: i.id, alt: i.alt, caption: i.caption, credit: i.credit, cover: i.cover, position })) })
async function requestAdmin(action, body, id, signal) {
  let r, data
  try {
    r = await fetch(`/api/admin?action=${action}${id ? `&id=${encodeURIComponent(id)}` : ''}`, { signal, method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) })
    data = await r.json()
  } catch (error) {
    if (signal.aborted) throw error
    throw new Error('Connexion interrompue. Votre saisie est conservée. Actualisez la liste pour vérifier si la dernière opération a été enregistrée avant de réessayer.')
  }
  signal.throwIfAborted()
  if (!r.ok) { const e = new Error(data.error || 'La demande a échoué.'); e.status = r.status; throw e }
  return data
}
export default function AdminDashboard() {
  const [user, setUser] = useState(null), [checking, setChecking] = useState(true), [busy, setBusy] = useState(false)
  const [catalog, setCatalog] = useState(null), [selected, setSelected] = useState(null), [draft, setDraft] = useState(null), [saved, setSaved] = useState('')
  const [notice, setNotice] = useState(''), [error, setError] = useState(''), [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [view, setView] = useState('projects'), [siteDirty, setSiteDirty] = useState(false), [siteBusy, setSiteBusy] = useState(false)
  const [projectHistory,setProjectHistory]=useState([]),[historyRevision,setHistoryRevision]=useState('')
  const [showPassword,setShowPassword]=useState(false),[menuOpen,setMenuOpen]=useState(false)
  const menu=useRef(null)
  const requests = useRef(null), idleWatcher = useRef(null), warningDialog = useRef(null)
  const [idleWarning, setIdleWarning] = useState(false), [continuing, setContinuing] = useState(false)
  const api = useCallback((action, body, id) => {
    requests.current ??= new AbortController()
    return requestAdmin(action, body, id, requests.current.signal)
  }, [])
  const exit = useCallback(message => {
    requests.current?.abort()
    requests.current = null
    setUser(null); setCatalog(null); setSelected(null); setDraft(null); setSaved('')
    setPreview(null); setProjectHistory([]); setHistoryRevision(''); setView('projects')
    setSiteDirty(false); setSiteBusy(false); setUploading(false); setMenuOpen(false)
    setIdleWarning(false); setContinuing(false); setError(''); setNotice(message)
  }, [])
  const handleError = useCallback(e => {
    if (e.name === 'AbortError') return
    if (e.status === 401 || e.status === 403) exit(e.message)
    else setError(e.message)
  }, [exit])
  useEffect(() => {
    if (!user) return
    const watcher = watchAdminSession({
      session: user,
      touch: () => api('activity', {}),
      onWarning: setIdleWarning,
      onEnd: () => exit('Votre session est terminée. Reconnectez-vous pour poursuivre.'),
    })
    idleWatcher.current = watcher
    return () => { watcher.dispose(); idleWatcher.current = null }
  }, [user, api, exit])
  useEffect(() => {
    const dialog = warningDialog.current
    if (idleWarning && dialog && !dialog.open) dialog.showModal()
    else if (!idleWarning && dialog?.open) dialog.close()
  }, [idleWarning])
  async function continueSession() {
    setContinuing(true)
    try { await idleWatcher.current?.extend() } finally { setContinuing(false) }
  }
  const dirty = draft != null && JSON.stringify(draft) !== saved
  useEffect(()=>{if(!user||!selected?.id)return;let active=true;api('project-history',undefined,selected.id).then(h=>{if(active)setProjectHistory(h)}).catch(handleError);return()=>{active=false}},[user,selected?.id,catalog?.version,handleError,api])
  async function reload() { const data = await api('projects'); setCatalog(data); return data }
  useEffect(() => {
    let active = true
    api('session').then(async u => { const c = await api('projects'); if (active) { setUser(u); setCatalog(c) } }).catch(e => { if (active && e.status !== 401) setError(e.message) }).finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [api])
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
    try { await fn() } catch (e) { handleError(e) } finally { setBusy(false) }
  }
  function open(p) {
    if (!abandon()) return
    setProjectHistory([]);setHistoryRevision('');const data = editable(p.data); setSelected(p); setDraft(data); setSaved(JSON.stringify(data)); setPreview(null); setError(''); setNotice('')
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
    if (!window.confirm('Publier cette version dans le portfolio de cet environnement ?')) return
    await operation(async () => { await api('publish', { projectId: selected.id, revisionId: selected.revisionId, siteId: catalog.siteId, expectedVersion: catalog.version }); const c = await reload(); setSelected(c.projects.find(p => p.id === selected.id) || selected); setNotice('Version publiée dans cet environnement.') })
  }
  async function changePublication(revisionId){
    if(!window.confirm(revisionId?'Restaurer cette version publiée ? Le brouillon courant sera conservé.':'Dépublier ce projet du portfolio de cet environnement ? Les fichiers et les versions seront conservés.'))return
    await operation(async()=>{await api(revisionId?'restore-project':'unpublish',{projectId:selected.id,revisionId,expectedVersion:catalog.version});const c=await reload();setSelected(c.projects.find(p=>p.id===selected.id)||selected);setNotice(revisionId?'Version publiée restaurée.':'Projet dépublié. Le portfolio dynamique se met à jour sous 30 secondes environ.')})
  }
  function move(index, offset) {
    const images = [...draft.images]; [images[index], images[index + offset]] = [images[index + offset], images[index]]; field('images', images.map((m, position) => ({ ...m, position })))
  }

  const locked=busy||uploading||siteBusy
  function closeMenu(){menu.current?.close();setMenuOpen(false)}
  function menuKey(e){if(e.key!=='Tab')return;const nodes=[...e.currentTarget.querySelectorAll('button:not(:disabled)')].filter(n=>n.getClientRects().length);if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
  function navigate(id){if(view!==id&&abandon()){setView(id);setDraft(null);setSelected(null);setSiteDirty(false)}closeMenu()}
  function logout(){if(abandon())operation(async()=>{await api('logout',{});endAdminSession(user.sessionId);exit('Vous êtes déconnecté.')})}
  const brand=<div className="admin-brand"><span className="admin-monogram">KK<span>·</span></span><div><strong>Kevin Kilongo</strong><span>Gestion du portfolio</span></div></div>
  const navigation=<nav aria-label="Rubriques de l’administration">{[['projects','Projets','projects'],['site','Contenu du site','site']].map(([id,label,icon])=><button key={id} disabled={locked} aria-current={view===id?'page':undefined} onClick={()=>navigate(id)}><Icon name={icon}/>{label}</button>)}</nav>
  if(checking)return <main className="admin-shell"><div className="admin-login-page"><div className="admin-login-card"><Icon name="lock"/><p role="status">Vérification de la session…</p></div></div></main>
  const login= <div className="admin-login-page"><div className="admin-login-card">{brand}<div className="admin-login-title"><span className="admin-login-symbol"><Icon name="lock"/></span><p className="admin-eyebrow">Gestion du portfolio</p><h1>Connexion</h1><p>Connectez-vous pour gérer vos projets et vos contenus.</p></div>{notice&&<p role="status" className="admin-success">{notice}</p>}<form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);operation(async()=>{const u=await api('login',{email:f.get('email'),password:f.get('password')});setUser(u);await reload()})}} aria-describedby={error?'admin-login-error':undefined}><label>Adresse e-mail<input name="email" type="email" autoComplete="username" required maxLength={254}/></label><label>Mot de passe<div className="admin-password"><input name="password" type={showPassword?'text':'password'} autoComplete="current-password" required maxLength={256}/><button type="button" aria-pressed={showPassword} aria-label={showPassword?'Masquer le mot de passe':'Afficher le mot de passe'} onClick={()=>setShowPassword(v=>!v)}>{showPassword?'Masquer':'Afficher'}</button></div></label>{error&&<p id="admin-login-error" role="alert" className="admin-error">{error}</p>}<button className="admin-primary admin-login-submit" disabled={locked}>{busy?'Connexion…':'Se connecter'}<Icon name="back" className="admin-arrow-forward"/></button>{dirty&&<p>Votre saisie est conservée dans cet onglet. Reconnectez-vous pour poursuivre.</p>}</form><p className="admin-login-footnote">Accès réservé aux administrateurs autorisés.</p><span className="admin-dev-badge">Administration</span></div></div>
  return <main className={`admin-shell ${user?'admin-authenticated':''}`} id="main-content">
   {user&&<dialog ref={warningDialog} className="admin-idle-dialog" aria-labelledby="admin-idle-title" onCancel={e=>e.preventDefault()}>
    <h2 id="admin-idle-title">Votre session va expirer</h2>
    <p>Vous serez déconnecté après 30 minutes d’inactivité.</p>
    <button type="button" className="admin-primary" disabled={continuing} onClick={continueSession}>Continuer ma session</button>
   </dialog>}
   {!user?login:<><aside className="admin-sidebar">{brand}{navigation}<div className="admin-sidebar-bottom"><p>Votre espace de travail</p><button disabled={locked} onClick={logout}><Icon name="logout"/>Se déconnecter</button></div></aside><div className="admin-main"><header className="admin-topbar"><button className="admin-mobile-menu" aria-label="Ouvrir la navigation" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={()=>{menu.current.showModal();setMenuOpen(true)}}><Icon name="menu"/></button><h1>{view==='projects'?'Projets':'Contenu du site'}</h1><span className="admin-dev-badge">Administration</span></header><div className="admin-main-content"><p className="admin-environment"><span/>Les publications concernent la base de cet environnement.</p>{error&&<p role="alert" className="admin-error">{error}</p>}{notice&&<p role="status" className="admin-success">{notice}</p>}{view==='projects'&&<ProjectWorkspace projectHistory={projectHistory} historyRevision={historyRevision} setHistoryRevision={setHistoryRevision} changePublication={changePublication} catalog={catalog} draft={draft} selected={selected} dirty={dirty} locked={locked} create={create} open={open} back={()=>{if(abandon()){setDraft(null);setSelected(null);setPreview(null);setError('');setNotice('')}}} refresh={()=>operation(async()=>{await reload();setNotice('Liste actualisée.')})} field={field} save={save} publish={publish} move={move} addImage={addImage} removeImage={removeImage} setUploading={setUploading} handleError={handleError} api={api} preview={preview} showPreview={()=>operation(async()=>setPreview(await api('preview',undefined,selected.revisionId)))}/>}</div></div><dialog ref={menu} className="admin-menu-dialog" onKeyDown={menuKey} aria-labelledby="admin-menu-title" onClose={()=>setMenuOpen(false)}><div className="admin-menu-head"><h2 id="admin-menu-title">Navigation</h2><button aria-label="Fermer la navigation" onClick={closeMenu}><Icon name="close"/></button></div>{brand}{navigation}<button disabled={locked} onClick={logout}><Icon name="logout"/>Se déconnecter</button></dialog></>}
   {view==='site'&&<div className="admin-site-content" hidden={!user}><SiteEditor api={api} authenticated={!!user} onError={handleError} onDirty={setSiteDirty} onBusy={setSiteBusy}/></div>}
  </main>
}
