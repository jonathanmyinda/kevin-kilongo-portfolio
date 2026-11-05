import https from 'node:https'

export const DEV_REF = 'pahbwurduwagdglpslos'
export function devConfig(env = process.env) {
  if (env.SUPABASE_DEV_PROJECT_REF !== DEV_REF || env.SUPABASE_DEV_PROJECT_NAME !== 'kevin-portfolio-dev' || env.SUPABASE_DEV_REGION !== 'eu-west-1' || env.SUPABASE_DEV_URL !== `https://${DEV_REF}.supabase.co`) throw new Error('Configuration Supabase DEV non vérifiée')
  if (!env.SUPABASE_DEV_PUBLISHABLE_KEY) throw new Error('Clé publique DEV manquante')
  return { url: env.SUPABASE_DEV_URL, key: env.SUPABASE_DEV_PUBLISHABLE_KEY }
}
// IPv4 also works on Windows networks where the IPv6 route is unavailable.
export function supabaseConfig(env = process.env) {
  if (env.SUPABASE_TARGET === 'prod') {
    if (env.VERCEL_ENV && !(
      env.VERCEL_ENV === 'preview' && env.VERCEL_GIT_COMMIT_REF === 'feat/admin-dashboard' ||
      env.VERCEL_ENV === 'production' && env.VERCEL_GIT_COMMIT_REF === 'main'
    )) throw new Error('Branche Supabase PROD non autorisée')
    const ref = env.SUPABASE_PROD_PROJECT_REF
    const url = env.SUPABASE_PROD_URL
    if (!/^[a-z0-9]{20}$/.test(ref ?? '') || ref === DEV_REF || url !== `https://${ref}.supabase.co`) {
      throw new Error('Référence Supabase PROD non vérifiée')
    }
    if (!env.SUPABASE_PROD_PUBLISHABLE_KEY?.startsWith('sb_publishable_') ||
        !env.SUPABASE_PROD_SECRET_KEY?.startsWith('sb_secret_')) {
      throw new Error('Clés Supabase PROD manquantes')
    }
    return { url, key: env.SUPABASE_PROD_PUBLISHABLE_KEY }
  }
  if (env.SUPABASE_TARGET && env.SUPABASE_TARGET !== 'dev') throw new Error('Cible Supabase inconnue')
  if (env.VERCEL_ENV === 'production') throw new Error('Supabase DEV interdit en production')
  return devConfig(env)
}

export function supabaseSecret(env = process.env) {
  if (env.SUPABASE_TARGET === 'prod') {
    supabaseConfig(env)
    return env.SUPABASE_PROD_SECRET_KEY
  }
  return env.SUPABASE_DEV_SECRET_KEY
}

export function supabaseRequest(path, { method = 'GET', token, body, key, binary = false, mime, maxBytes = 11 * 1024 ** 2 } = {}, config = supabaseConfig()) {
  return new Promise((resolve, reject) => {
    const bytes = body == null ? null : Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body))
    const req = https.request(new URL(path, config.url), { method, family: 4, headers: {
      apikey: key || config.key, ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(bytes ? { 'Content-Type': mime || (Buffer.isBuffer(body) ? 'application/octet-stream' : 'application/json'), 'Content-Length': bytes.length } : {}),
    } }, res => {
      const chunks = []; let size = 0
      res.on('data', b => { size += b.length; if (size > maxBytes) req.destroy(new Error('Réponse trop volumineuse')); else chunks.push(b) })
      res.on('end', () => {
        const raw = Buffer.concat(chunks); let data = null
        if (binary) data = raw
        else { try { data = JSON.parse(raw.toString()) } catch { /* No response body. */ } }
        resolve({ status: res.statusCode, data, type: res.headers['content-type'] })
      })
      res.on('error', reject)
    })
    req.setTimeout(20000, () => req.destroy(new Error('Délai du service dépassé')))
    req.on('error', reject); if (bytes) req.write(bytes); req.end()
  })
}
