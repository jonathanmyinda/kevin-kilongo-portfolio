import { validateProject } from '../content/contracts.mjs'
import { supabaseRequest } from './supabase.mjs'
import { imageAction } from './images.mjs'
import { validateSite, contactURLs } from './site.mjs'
import { pdfAction } from './pdfs.mjs'

class HttpError extends Error { constructor(status, message) { super(message); this.status = status } }
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
const loginAttempts = new Map()
function cookieValues(req) {
  try { return Object.fromEntries((req.headers.cookie || '').split(';').map(p => p.trim().split(/=(.*)/s).slice(0, 2))) } catch { return {} }
}
function cookies(res, tokens, secure) {
  const options = `Path=/api/admin; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`
  res.setHeader('Set-Cookie', [
    `portfolio_access=${tokens?.access_token || ''}; ${options}; Max-Age=${tokens ? 3600 : 0}`,
    `portfolio_refresh=${tokens?.refresh_token || ''}; ${options}; Max-Age=${tokens ? 2592000 : 0}`,
  ])
}
async function readBody(req, limit = 100000) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'Format de requête invalide.')
  if (req.body != null) {
    if (Buffer.byteLength(JSON.stringify(req.body)) > limit) throw new HttpError(413, 'Requête trop volumineuse.')
    if (typeof req.body === 'object') return req.body
    try { return JSON.parse(req.body) } catch { throw new HttpError(400, 'Requête invalide.') }
  }
  let data = ''
  for await (const chunk of req) { data += chunk; if (Buffer.byteLength(data) > limit) throw new HttpError(413, 'Requête trop volumineuse.') }
  try { return JSON.parse(data) } catch { throw new HttpError(400, 'Requête invalide.') }
}
export function createAdminHandler(request = supabaseRequest) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0')
    res.setHeader('CDN-Cache-Control', 'no-store')
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
    res.setHeader('Vary', 'Cookie')
    const secure = process.env.NODE_ENV === 'production'
    const reply = (status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(data)) }
    const rpc = async (name, body, token) => {
      const r = await request('/rest/v1/rpc/' + name, { method: 'POST', body, token })
      if (r.status >= 400) {
        if (r.status === 409) throw new HttpError(409, 'Le contenu a changé ailleurs. Rechargez la liste avant de réessayer ; votre saisie est conservée.')
        if (r.status === 429) throw new HttpError(429, 'Trop d’imports. Nettoyez les anciens essais ou réessayez plus tard.')
        if (r.status === 401) throw new HttpError(401, 'Votre session a expiré. Reconnectez-vous.')
        if (r.status === 403) throw new HttpError(403, 'Accès réservé aux administrateurs autorisés.')
        if (r.status < 500) throw new HttpError(400, 'Opération refusée. Vérifiez les champs, les médias et les crédits.')
        throw new HttpError(502, 'Le service est momentanément indisponible. Réessayez.')
      }
      return r.data
    }
    try {
      const url = new URL(req.url, 'http://localhost'), action = url.searchParams.get('action') || 'session'
      const methods = { session: 'GET', projects: 'GET', preview: 'GET', media: 'GET', login: 'POST', logout: 'POST', save: 'POST', publish: 'POST', images: 'GET', 'image-begin': 'POST', 'image-finish': 'POST', 'image-delete': 'POST', 'image-cleanup': 'POST', site: 'GET', 'site-preview':'GET','site-save':'POST','site-publish':'POST','site-restore':'POST',pdfs:'GET','pdf-begin':'POST','pdf-finish':'POST','pdf-link':'POST','pdf-delete':'POST','pdf-cleanup':'POST' }
      Object.assign(methods,{'project-history':'GET',unpublish:'POST','restore-project':'POST'})
      if (!methods[action]) throw new HttpError(404, 'Action inconnue.')
      if (req.method !== methods[action]) { res.setHeader('Allow', methods[action]); throw new HttpError(405, 'Méthode refusée.') }
      if (req.method === 'POST') {
        const origin = process.env.ADMIN_ORIGIN || `${secure ? 'https' : 'http'}://${req.headers.host}`
        if (req.headers.origin !== origin || req.headers['sec-fetch-site'] === 'cross-site') throw new HttpError(403, 'Origine de la demande refusée.')
      }
      const body = req.method === 'POST' ? await readBody(req, action === 'site-save' ? 1048576 : 100000) : {}
      if (action === 'login') {
        if (typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || typeof body.password !== 'string' || body.password.length < 1 || body.password.length > 256) throw new HttpError(400, 'Renseignez votre adresse e-mail et votre mot de passe.')
        // Additional per-process defence; Supabase Auth remains the durable service-side rate limiter.
        const ip = req.socket?.remoteAddress || 'unknown', now = Date.now()
        for (const [k, v] of loginAttempts) if (v.until < now) loginAttempts.delete(k)
        const attempts = loginAttempts.get(ip) || { count: 0, until: now + 60000 }
        if (++attempts.count > 10) throw new HttpError(429, 'Trop de tentatives. Attendez une minute.')
        loginAttempts.set(ip, attempts)
        const r = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: body.email, password: body.password } })
        if (r.status >= 400) throw new HttpError(r.status === 429 ? 429 : 401, 'Connexion refusée. Vérifiez vos identifiants ou réessayez plus tard.')
        if (!await rpc('admin_session', {}, r.data.access_token)) {
          await request('/auth/v1/logout?scope=local', { method: 'POST', token: r.data.access_token })
          throw new HttpError(403, 'Ce compte ne dispose pas d’un accès administrateur.')
        }
        cookies(res, r.data, secure); return reply(200, { email: r.data.user.email })
      }
      const c = cookieValues(req); let token = c.portfolio_access
      let user = token ? await request('/auth/v1/user', { token }) : { status: 401 }
      if (user.status === 401 || user.status === 403) {
        if (c.portfolio_refresh) {
          const refreshed = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: c.portfolio_refresh } })
          if (refreshed.status < 300) { token = refreshed.data.access_token; cookies(res, refreshed.data, secure); user = await request('/auth/v1/user', { token }) }
          else if (refreshed.status >= 500) throw new HttpError(502, 'Connexion au service interrompue. Réessayez.')
        }
      }
      if (user.status >= 500) throw new HttpError(502, 'Connexion au service interrompue. Réessayez.')
      if (user.status !== 200) { cookies(res, null, secure); throw new HttpError(401, 'Votre session a expiré. Reconnectez-vous.') }
      if (action === 'logout') {
        const r = await request('/auth/v1/logout?scope=local', { method: 'POST', token })
        if (r.status >= 500) throw new HttpError(502, 'Déconnexion impossible pour le moment. Réessayez.')
        cookies(res, null, secure); return reply(200, { ok: true })
      }
      if (!await rpc('admin_session', {}, token)) { cookies(res, null, secure); throw new HttpError(403, 'Accès réservé aux administrateurs autorisés.') }
      if (action === 'session') return reply(200, { email: user.data.email })
      if(action==='project-history'){
        const id=url.searchParams.get('id');if(!uuid(id))throw new HttpError(400,'Projet invalide.')
        return reply(200,await rpc('admin_project_history',{p_project:id},token))
      }
      if(action==='unpublish'||action==='restore-project'){
        if(!uuid(body.projectId)||!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0||action==='restore-project'&&!uuid(body.revisionId))throw new HttpError(400,'Publication invalide.')
        return reply(200,{releaseId:await rpc('admin_project_publication',{p_project:body.projectId,p_revision:action==='unpublish'?null:body.revisionId,p_expected:body.expectedVersion},token)})
      }
      if (action === 'images' || action.startsWith('image-')) return reply(200, await imageAction({ action, body, token, actor: user.data.id, request, rpc }))
      if (action === 'pdfs' || action.startsWith('pdf-')) return reply(200, await pdfAction({ action,body,token,actor:user.data.id,request,rpc }))
      if (action === 'site') return reply(200,await rpc('admin_site',{},token))
      if (action === 'site-preview') {
        const id=url.searchParams.get('id');if(!uuid(id))throw new HttpError(400,'Version invalide.')
        const data=await rpc('admin_site_preview',{p_revision:id},token);if(!data)throw new HttpError(404,'Version introuvable.')
        return reply(200,{...data,contactLinks:contactURLs(data.email,data.phone)})
      }
      if (action === 'site-save') {
        if(!uuid(body.expectedRevision))throw new HttpError(400,'Version invalide.')
        return reply(200,{revisionId:await rpc('admin_save_site',{p_expected:body.expectedRevision,p_data:validateSite(body.data)},token)})
      }
      if(action==='site-publish'||action==='site-restore'){
        if(!uuid(body.revisionId)||!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0)throw new HttpError(400,'Publication invalide.')
        return reply(200,{releaseId:await rpc('admin_publish_site',{p_revision:body.revisionId,p_expected:body.expectedVersion,p_restore:action==='site-restore'},token)})
      }
      if (action === 'projects') return reply(200, await rpc('admin_projects', {}, token))
      if (action === 'preview') {
        const id = url.searchParams.get('id'); if (!uuid(id)) throw new HttpError(400, 'Version invalide.')
        const data = await rpc('preview_project', { p_revision: id }, token)
        if (!data) throw new HttpError(404, 'Version introuvable.')
        return reply(200, data)
      }
      if (action === 'media') {
        const id = url.searchParams.get('id'); if (!uuid(id)) throw new HttpError(400, 'Média invalide.')
        const key = await rpc('admin_media', { p_media: id }, token)
        if (!key) throw new HttpError(404, 'Média introuvable.')
        const r = await request('/storage/v1/object/authenticated/portfolio-private/' + key, { token, binary: true })
        if (r.status !== 200) throw new HttpError(404, 'Média indisponible.')
        res.statusCode = 200; res.setHeader('Content-Type', r.type || 'application/octet-stream'); return res.end(r.data)
      }
      if (action === 'save') {
        if (body.projectId != null && !uuid(body.projectId) || body.expectedRevision != null && !uuid(body.expectedRevision)) throw new HttpError(400, 'Version invalide.')
        try { validateProject(body.data) } catch (e) { throw new HttpError(400, e.message) }
        return reply(200, { revisionId: await rpc('admin_save_project', { p_project: body.projectId || null, p_expected: body.expectedRevision || null, p_data: body.data }, token) })
      }
      if (!uuid(body.projectId) || !uuid(body.revisionId) || !uuid(body.siteId) || !Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0) throw new HttpError(400, 'Publication invalide.')
      return reply(200, { releaseId: await rpc('admin_publish_project', { p_project: body.projectId, p_revision: body.revisionId, p_site: body.siteId, p_expected: body.expectedVersion }, token) })
    } catch (error) {
      // No message bodies, passwords, tokens or raw upstream diagnostics are logged.
      reply(error.status || 503, { error: error.status ? error.message : 'Service indisponible. Réessayez sans fermer votre brouillon.' })
    }
  }
}
export default createAdminHandler()
