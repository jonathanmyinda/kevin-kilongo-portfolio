const WARNING_MS = 2 * 60_000
const ACTIVITY_INTERVAL_MS = 15_000
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'input', 'wheel']
const RESUME_EVENTS = ['focus', 'pageshow', 'visibilitychange']
const storageKey = sessionId => `portfolio.admin.idle.${sessionId}`

export function endAdminSession(sessionId, browser = window) {
  try { browser.localStorage.setItem(storageKey(sessionId), '{"ended":true}') } catch { /* Storage can be disabled. */ }
}

export function watchAdminSession({ session, touch, onWarning, onEnd, browser = window, now = Date.now }) {
  const key = storageKey(session.sessionId)
  let lease, timer, pending, lastActivity = -Infinity, stopped = false

  function read() {
    try { return JSON.parse(browser.localStorage.getItem(key)) } catch { return null }
  }

  function accept(data) {
    const shared = read()
    if (shared?.ended || !data.sessionId || data.sessionId !== session.sessionId
        || !Number.isFinite(data.expiresAt) || !Number.isFinite(data.serverNow)) return stop(true)
    const newest = shared?.expiresAt >= (lease?.expiresAt ?? 0) ? shared : lease
    if (newest?.expiresAt >= data.expiresAt) lease = newest
    else {
      lease = { expiresAt: data.expiresAt, localDeadline: now() + data.expiresAt - data.serverNow }
      try { browser.localStorage.setItem(key, JSON.stringify(lease)) } catch { /* The current tab still has its deadline. */ }
    }
    check()
  }

  function check() {
    if (stopped) return
    browser.clearTimeout(timer)
    const shared = read()
    if (shared?.ended) return stop(true)
    if (shared?.expiresAt > lease.expiresAt) lease = shared
    const remaining = lease.localDeadline - now()
    if (remaining <= 0) return stop(true)
    onWarning(remaining <= WARNING_MS)
    timer = browser.setTimeout(check, remaining > WARNING_MS ? remaining - WARNING_MS : remaining)
  }

  function storage(event) {
    if (event.key === key) check()
  }

  async function extend() {
    check()
    if (stopped) return
    if (pending) return pending
    lastActivity = now()
    pending = touch().then(data => {
      if (!stopped) accept(data)
    }).catch(error => {
      if (!stopped && (error.status === 401 || error.status === 403)) stop(true)
    }).finally(() => { pending = undefined })
    return pending
  }

  function activity(event) {
    if (!event.isTrusted) return
    check()
    if (!stopped && lease.localDeadline - now() > WARNING_MS && now() - lastActivity >= ACTIVITY_INTERVAL_MS) void extend()
  }

  function stop(ended = false) {
    if (stopped) return
    stopped = true
    browser.clearTimeout(timer)
    browser.removeEventListener('storage', storage)
    for (const name of RESUME_EVENTS) browser.removeEventListener(name, check)
    for (const name of ACTIVITY_EVENTS) browser.removeEventListener(name, activity, true)
    if (ended) onEnd()
  }

  browser.addEventListener('storage', storage)
  for (const name of RESUME_EVENTS) browser.addEventListener(name, check)
  for (const name of ACTIVITY_EVENTS) browser.addEventListener(name, activity, { capture: true, passive: true })
  accept(session)
  return { extend, dispose: () => stop() }
}
