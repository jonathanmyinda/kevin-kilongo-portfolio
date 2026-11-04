import { createServer } from 'vite'
import { devConfig } from '../server/admin/supabase.mjs'
import handler from '../server/admin/handler.mjs'
import publicHandler from '../server/content/public.mjs'
process.loadEnvFile('.env.supabase-dev.local')
devConfig()
const server = await createServer({ server: { host: '127.0.0.1', port: 5173, strictPort: true }, plugins: [{
  name: 'local-admin-api', configureServer(vite) {
    vite.middlewares.use((req, res, next) => {
      if (new URL(req.url, 'http://localhost').pathname === '/api/admin') void handler(req, res)
      else if(['/api/content','/api/media'].includes(new URL(req.url,'http://localhost').pathname))void publicHandler(req,res)
      else next()
    })
  },
}] })
await server.listen(); server.printUrls()
console.log('Administration DEV : http://127.0.0.1:5173/admin')
