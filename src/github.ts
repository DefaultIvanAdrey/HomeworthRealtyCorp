export interface GhCfg { owner: string; repo: string; branch: string }
export interface FileOut { path: string; content: string; base64?: boolean }
const api = (c: GhCfg, p: string) => `https://api.github.com/repos/${c.owner}/${c.repo}${p}`
const H = (t: string, accept = 'application/vnd.github+json') => ({ Authorization: `Bearer ${t}`, Accept: accept })

async function check(r: Response) {
  if (r.ok) return r.json()
  if (r.status === 401 || r.status === 403) throw new Error('GitHub rejected the token. It needs Contents: read and write on this repository.')
  if (r.status === 404) throw new Error('Repository, branch or file not found. Check the owner, repository and branch.')
  if (r.status === 422) throw new Error('The branch changed while publishing. Reload this page and try again.')
  throw new Error(`GitHub returned ${r.status}.`)
}
export async function pull(c: GhCfg, t: string) {
  const r = await fetch(api(c, `/contents/public/data/listings.json?ref=${c.branch}`), { headers: H(t, 'application/vnd.github.raw+json') })
  if (!r.ok) await check(r)
  return JSON.parse(await r.text())
}
/** Writes all files (listings.json plus new photos) in ONE commit, so only one deploy runs. */
export async function commit(c: GhCfg, t: string, files: FileOut[], message: string) {
  const post = (p: string, body: unknown, method = 'POST') => fetch(api(c, p), { method, headers: H(t), body: JSON.stringify(body) }).then(check)
  const head = (await check(await fetch(api(c, `/git/ref/heads/${c.branch}`), { headers: H(t) }))).object.sha
  const base = (await check(await fetch(api(c, `/git/commits/${head}`), { headers: H(t) }))).tree.sha
  const tree = await Promise.all(files.map(async f => ({ path: f.path, mode: '100644', type: 'blob', sha: (await post('/git/blobs', { content: f.content, encoding: f.base64 ? 'base64' : 'utf-8' })).sha })))
  const t2 = await post('/git/trees', { base_tree: base, tree })
  const nc = await post('/git/commits', { message, tree: t2.sha, parents: [head] })
  await post(`/git/refs/heads/${c.branch}`, { sha: nc.sha }, 'PATCH')
}
