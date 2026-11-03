export function createContentRepository({ url, publishableKey, getAccessToken, fetchImpl = fetch }) {
  if (!url || !publishableKey) throw new Error('Configuration Supabase absente')
  async function rpc(name, args, admin = false) {
    const token = admin ? await getAccessToken?.() : null
    if (admin && !token) throw new Error('Connexion requise')
    const response = await fetchImpl(new URL(`/rest/v1/rpc/${name}`, url), {
      method: 'POST', headers: { apikey: publishableKey, ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      body: JSON.stringify(args), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error(`Opération refusée (${response.status})`)
    return response.status === 204 ? null : response.json()
  }
  return {
    readPublished: () => rpc('read_portfolio', {}),
    previewProject: revisionId => rpc('preview_project', { p_revision: revisionId }, true),
    publish: ({ revisionIds, siteRevisionId, featuredProjectIds, expectedVersion }) => rpc('publish_portfolio', {
      p_revisions: revisionIds, p_site: siteRevisionId, p_featured: featuredProjectIds, p_expected: expectedVersion,
    }, true),
    restore: (releaseId, expectedVersion) => rpc('restore_portfolio', { p_release: releaseId, p_expected: expectedVersion }, true),
  }
}
