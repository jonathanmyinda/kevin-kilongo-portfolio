// Vercel Node function. DEV credentials stay in the server environment only.
import handler from '../server/admin/handler.mjs'
import { isProdDiagnostic } from '../server/admin/supabase.mjs'

export default function admin(req, res) {
  if (isProdDiagnostic()) {
    res.statusCode = 404
    return res.end()
  }
  return handler(req, res)
}
