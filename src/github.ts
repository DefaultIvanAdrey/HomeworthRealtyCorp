export interface GhCfg { owner: string; repo: string; branch: string }
const PATH = 'public/data/listings.json'
const url = (c: GhCfg) => `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${PATH}`
const head = (t: string) => ({ Authorization: `Bearer ${t}`, Accept: 'application/vnd.github+json' })
const enc = (s: string) => { let b = ''; new TextEncoder().encode(s).forEach(x => (b += String.fromCharCode(x))); return btoa(b) }
const dec = (b: string) => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\n/g, '')), c => c.charCodeAt(0)))

async function check(r: Response) {
  if (r.ok) return r.json()
  if (r.status === 401 || r.status === 403) throw new Error('GitHub rejected the token. It needs Contents: read and write on this repository.')
  if (r.status === 404) throw new Error('Repository or file not found. Check the owner, repository and branch.')
  throw new Error(`GitHub returned ${r.status}.`)
}
export async function pull(c: GhCfg, token: string) {
  const j = await check(await fetch(`${url(c)}?ref=${c.branch}`, { headers: head(token) }))
  return { sha: j.sha as string, data: JSON.parse(dec(j.content)) }
}
export async function push(c: GhCfg, token: string, data: unknown, sha: string, message: string) {
  const j = await check(await fetch(url(c), { method: 'PUT', headers: head(token), body: JSON.stringify({ message, content: enc(JSON.stringify(data, null, 2) + '\n'), sha, branch: c.branch }) }))
  return j.content.sha as string
}
