import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAdminHandler } from '../server/admin/handler.mjs'
import { endAdminSession, watchAdminSession } from '../src/admin/idle-session.mjs'

test('l’API refuse un jeton encore valide à la limite, même pour une demande de prolongation', async () => {
  let now = 0, deadline = 30, refreshes = 0
  const touches = []
  const handler = createAdminHandler(async (path, options) => {
    if (path === '/auth/v1/user') return options.token === 'refresh-needed'
      ? { status: 401 } : { status: 200, data: { email: 'admin@example.test' } }
    if (path.includes('grant_type=refresh_token')) {
      refreshes++
      return { status: 200, data: { access_token: 'valid', refresh_token: 'valid-refresh' } }
    }
    if (path.endsWith('/admin_session')) return { status: 200, data: true }
    if (path.endsWith('/admin_idle_session')) {
      touches.push(options.body.p_touch)
      if (now >= deadline) return { status: 200, data: null }
      if (options.body.p_touch) deadline = now + 30
      return { status: 200, data: { sessionId: 'one', expiresAt: deadline, serverNow: now } }
    }
    if (path.endsWith('/admin_projects')) return { status: 200, data: [] }
    assert.fail(path)
  })
  async function request(action, token = 'valid') {
    const headers = new Map()
    let result
    const host = '127.0.0.1:5173'
    const res = { setHeader: (key, value) => headers.set(key, value), end: json => { result = JSON.parse(json) } }
    await handler({
      url: '/api/admin?action=' + action,
      method: action === 'activity' ? 'POST' : 'GET',
      body: {},
      headers: { host, origin: 'http://' + host, 'content-type': 'application/json', cookie: 'portfolio_access=' + token + '; portfolio_refresh=valid-refresh' },
    }, res)
    return { status: res.statusCode, result, headers }
  }

  now = 10
  assert.equal((await request('session', 'refresh-needed')).result.expiresAt, 30)
  assert.equal(refreshes, 1)
  assert.equal((await request('projects')).status, 200)
  now = 28
  assert.equal((await request('activity')).result.expiresAt, 58)
  now = 57
  assert.equal((await request('projects')).status, 200)
  now = 58
  const expired = await request('projects')
  assert.equal(expired.status, 401)
  assert(expired.headers.get('Set-Cookie').every(cookie => cookie.includes('Max-Age=0')))
  assert.equal((await request('activity')).status, 401)
  assert.deepEqual(touches, [false, false, true, false, false, true])
})

function tabs() {
  const data = new Map(), browsers = []
  return () => {
    const events = new EventTarget(), timers = new Map()
    const browser = {
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      emit(name, fields) { events.dispatchEvent(Object.assign(new Event(name), fields)) },
      setTimeout(callback, delay) { const id = Symbol(); timers.set(id, { callback, delay }); return id },
      clearTimeout(id) { timers.delete(id) },
      timer() { return [...timers.values()][0] },
      localStorage: {
        getItem: key => data.get(key) ?? null,
        setItem(key, value) {
          data.set(key, value)
          for (const other of browsers) if (other !== browser) other.emit('storage', { key })
        },
      },
    }
    browsers.push(browser)
    return browser
  }
}

test('avertissement, prolongation partagée et expiration au réveil sans exécuter les minuteurs suspendus', async () => {
  const newTab = tabs()
  const a = newTab(), b = newTab()
  let now = 0, calls = 0, warningA, warningB, endedA = 0, endedB = 0
  // Keep the real two-minute warning offset and shorten only the fixture lease.
  const lease = () => ({ sessionId: 'one', expiresAt: now + 120_100, serverNow: now })
  const start = { session: lease(), now: () => now, touch: async () => { calls++; return lease() } }
  const first = watchAdminSession({ ...start, browser: a, onWarning: value => { warningA = value }, onEnd: () => { endedA++ } })
  watchAdminSession({ ...start, browser: b, onWarning: value => { warningB = value }, onEnd: () => { endedB++ } })
  assert.equal(a.timer().delay, 100)
  a.emit('pointerdown')
  b.emit('focus')
  assert.equal(calls, 0)
  now = 100
  a.timer().callback()
  b.timer().callback()
  assert.equal(warningA, true)
  assert.equal(warningB, true)
  await first.extend()
  assert.equal(warningA, false)
  assert.equal(warningB, false)
  assert.equal(calls, 1)

  now = 120_201
  a.emit('pageshow')
  b.emit('visibilitychange')
  assert.equal(endedA, 1)
  assert.equal(endedB, 1)
  await first.extend()
  assert.equal(calls, 1)
})

test('une déconnexion dans un onglet ferme la session des autres onglets', () => {
  const newTab = tabs()
  const a = newTab(), b = newTab()
  let ended = false
  watchAdminSession({
    session: { sessionId: 'one', expiresAt: 120_100, serverNow: 0 },
    now: () => 0, browser: b, onWarning() {}, onEnd: () => { ended = true },
  })
  endAdminSession('one', a)
  assert.equal(ended, true)
  assert.equal(b.timer(), undefined)
})
