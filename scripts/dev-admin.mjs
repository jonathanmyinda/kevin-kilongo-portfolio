import { createServer } from 'vite'
import { supabaseConfig } from '../server/admin/supabase.mjs'
import handler from '../server/admin/handler.mjs'
import publicHandler from '../server/content/public.mjs'
const target = process.argv.includes('--prod') ? 'prod' : 'dev'
process.loadEnvFile(`.env.supabase-${target}.local`)
process.env.SUPABASE_TARGET = target
supabaseConfig()
const port = target === 'prod' ? 5174 : 5173
process.env.ADMIN_ORIGIN = `http://127.0.0.1:${port}`
const server = await createServer({ server: { host: '127.0.0.1', port, strictPort: true }, plugins: [{
  name: 'local-admin-api', configureServer(vite) {
    vite.middlewares.use((req, res, next) => {
      if (new URL(req.url, 'http://localhost').pathname === '/api/admin') void handler(req, res)
      else if(['/api/content','/api/media'].includes(new URL(req.url,'http://localhost').pathname))void publicHandler(req,res)
      else next()
    })
  },
}] })
await server.listen(); server.printUrls()
console.log(`Administration ${target.toUpperCase()} : http://127.0.0.1:${port}/admin`)
