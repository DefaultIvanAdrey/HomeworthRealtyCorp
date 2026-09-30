import { useEffect, useState } from 'react'
import { blank, type Listing } from './types'
import { headline, slug, where } from './format'
import { mergeListings, parseListingsCsv, type ParsedRow } from './csv'
import { pull, push, type GhCfg } from './github'

const TEXT: [keyof Listing, string][] = [['title', 'Project / listing name'], ['category', 'Category'], ['availability', 'Availability'], ['condition', 'Condition'], ['unit', 'Unit / house no. & tower'], ['street', 'Street / village / project'], ['district', 'District'], ['municipality', 'Municipality'], ['availableFrom', 'Available from']]
const NUM: [keyof Listing, string][] = [['salePrice', 'Sale price (₱)'], ['monthlyRent', 'Monthly rent (₱)'], ['leasePrice', 'Lease price (₱)'], ['floorArea', 'Floor area (sqm)'], ['lotArea', 'Lot area (sqm)'], ['bedrooms', 'Bedrooms'], ['bathrooms', 'Bathrooms'], ['parking', 'Parking'], ['storey', 'Storey']]

export default function Admin() {
  const [cfg, setCfg] = useState<GhCfg>(() => JSON.parse(localStorage.getItem('hw-gh') || '{"owner":"","repo":"","branch":"main"}'))
  const [token, setToken] = useState(sessionStorage.getItem('hw-token') || '')
  const [list, setList] = useState<Listing[]>([])
  const [base, setBase] = useState('[]')
  const [sha, setSha] = useState('')
  const [tab, setTab] = useState<'listings' | 'import' | 'edit'>('listings')
  const [draft, setDraft] = useState<Listing>(blank())
  const [preview, setPreview] = useState<ParsedRow[] | null>(null)
  const [q, setQ] = useState('')
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const dirty = JSON.stringify(list) !== base
  const ready = !!(cfg.owner && cfg.repo && token)
  const say = (text: string, ok = true) => setNote({ ok, text })

  const load = async () => {
    try {
      if (ready) { const r = await pull(cfg, token); setList(r.data); setBase(JSON.stringify(r.data)); setSha(r.sha); say(`Loaded ${r.data.length} listings from GitHub.`) }
      else { const d = await (await fetch('data/listings.json?' + Date.now())).json(); setList(d); setBase(JSON.stringify(d)) }
    } catch (e) { say((e as Error).message, false) }
  }
  useEffect(() => { load() }, []) // eslint-disable-line
  useEffect(() => { const b = (e: BeforeUnloadEvent) => dirty && e.preventDefault(); addEventListener('beforeunload', b); return () => removeEventListener('beforeunload', b) }, [dirty])

  const connect = () => { localStorage.setItem('hw-gh', JSON.stringify(cfg)); sessionStorage.setItem('hw-token', token); load() }
  const publish = async () => {
    try {
      const n = await push(cfg, token, list, sha, `Update listings (${list.length})`)
      setSha(n); setBase(JSON.stringify(list)); say('Published. GitHub Pages rebuilds the site in about a minute.')
    } catch (e) { say((e as Error).message, false) }
  }
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' })); a.download = 'listings.json'; a.click() }

  const onFile = async (file?: File) => {
    if (!file) return
    try { setPreview(parseListingsCsv(await file.text())); setNote(null) } catch (e) { setPreview(null); say((e as Error).message, false) }
  }
  const applyImport = () => {
    const r = mergeListings(list, preview!.map(p => p.listing))
    setList(r.list); setPreview(null); setTab('listings'); say(`Added ${r.added}, updated ${r.updated}. Publish to put them on the site.`)
  }
  const save = () => {
    if (!draft.title.trim()) return say('Add a listing name before saving.', false)
    const l = { ...draft, id: draft.id || slug(draft.title), updatedAt: new Date().toISOString() }
    setList(x => (x.some(i => i.id === l.id) ? x.map(i => (i.id === l.id ? l : i)) : [l, ...x])); setTab('listings'); say(`Saved “${l.title}”. Publish to put it on the site.`)
  }
  const set = (k: keyof Listing, v: unknown) => setDraft(d => ({ ...d, [k]: v }))
  const rows = list.filter(l => (l.title + where(l)).toLowerCase().includes(q.toLowerCase()))

  return (<div className="admin">
    <header><a href="#/">← View site</a><h1>Listings manager</h1></header>

    <details className="panel" open={!ready}><summary>GitHub connection {ready ? '· connected' : '· not connected'}</summary>
      <div className="row">
        <label>Owner<input value={cfg.owner} onChange={e => setCfg({ ...cfg, owner: e.target.value })} /></label>
        <label>Repository<input value={cfg.repo} onChange={e => setCfg({ ...cfg, repo: e.target.value })} /></label>
        <label>Branch<input value={cfg.branch} onChange={e => setCfg({ ...cfg, branch: e.target.value })} /></label>
        <label>Access token<input type="password" value={token} onChange={e => setToken(e.target.value)} /></label>
        <button className="btn" onClick={connect}>Connect</button>
      </div>
      <p className="muted">Use a fine-grained token limited to this repository with Contents: read and write. It stays in this browser tab only.</p>
    </details>

    {note && <p className={note.ok ? 'note ok' : 'note bad'} role="status">{note.text}</p>}

    <div className="tabs">{(['listings', 'import', 'edit'] as const).map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => { if (t === 'edit') setDraft(blank()); setTab(t) }}>{{ listings: `Listings (${list.length})`, import: 'Import CSV', edit: 'Add listing' }[t]}</button>)}</div>

    {tab === 'listings' && <section>
      <input className="search-in" placeholder="Search by name or location" value={q} onChange={e => setQ(e.target.value)} />
      {rows.length === 0 ? <p className="empty">No listings yet. Import a CSV or add one by hand.</p> :
        <table><thead><tr><th>Listing</th><th>Location</th><th>Price</th><th>On site</th><th></th></tr></thead><tbody>{rows.map(l => <tr key={l.id}>
          <td>{l.title}</td><td>{where(l)}</td><td>{headline(l)}</td>
          <td><input type="checkbox" checked={l.published} aria-label={`Show ${l.title} on the site`} onChange={e => setList(x => x.map(i => (i.id === l.id ? { ...i, published: e.target.checked } : i)))} /></td>
          <td className="acts"><button onClick={() => { setDraft(l); setTab('edit') }}>Edit</button><button onClick={() => confirm(`Delete “${l.title}”?`) && setList(x => x.filter(i => i.id !== l.id))}>Delete</button></td></tr>)}</tbody></table>}
    </section>}

    {tab === 'import' && <section>
      <label className="drop">Choose a CSV file or drop it here<input type="file" accept=".csv,text/csv" onChange={e => onFile(e.target.files?.[0])} /></label>
      <p className="muted">Export from Google Sheets with File → Download → CSV. Rows with the same web address or name update the existing listing instead of duplicating it.</p>
      {preview && <>
        <table><thead><tr><th>Listing</th><th>Location</th><th>Price</th><th>Status</th></tr></thead><tbody>{preview.map(({ listing: l, warnings }) => <tr key={l.id}>
          <td>{l.title}</td><td>{where(l)}</td><td>{headline(l)}</td>
          <td>{list.some(x => x.id === l.id) ? 'Will update' : 'New'}{warnings.length > 0 && <small className="warn"> · {warnings.join(', ')}</small>}</td></tr>)}</tbody></table>
        <button className="btn" onClick={applyImport}>Add {preview.length} {preview.length === 1 ? 'listing' : 'listings'} to draft</button>
      </>}
    </section>}

    {tab === 'edit' && <section className="form">
      {TEXT.map(([k, label]) => <label key={k}>{label}<input value={String(draft[k] ?? '')} onChange={e => set(k, e.target.value)} /></label>)}
      {NUM.map(([k, label]) => <label key={k}>{label}<input type="number" min="0" value={(draft[k] as number | undefined) ?? ''} onChange={e => set(k, e.target.value ? +e.target.value : undefined)} /></label>)}
      <label className="wide">Amenities (comma separated)<textarea defaultValue={draft.amenities.join(', ')} onBlur={e => set('amenities', e.target.value.split(',').map(a => a.trim()).filter(Boolean))} /></label>
      <label className="wide">Remarks<textarea defaultValue={draft.remarks} onBlur={e => set('remarks', e.target.value)} /></label>
      <label className="wide">Photo image links (one per line)<textarea defaultValue={draft.photos.join('\n')} onBlur={e => set('photos', e.target.value.split('\n').map(a => a.trim()).filter(Boolean))} /></label>
      <label className="wide">Photo album link (optional)<input value={draft.photosLink} onChange={e => set('photosLink', e.target.value)} /></label>
      <label className="check"><input type="checkbox" checked={draft.negotiable} onChange={e => set('negotiable', e.target.checked)} /> Price is negotiable</label>
      <label className="check"><input type="checkbox" checked={draft.published} onChange={e => set('published', e.target.checked)} /> Show on the site</label>
      <div className="wide"><button className="btn" onClick={save}>Save listing</button></div>
    </section>}

    <footer className="bar"><span>{dirty ? 'You have unpublished changes.' : 'Everything is published.'}</span>
      <button onClick={download}>Download JSON</button>
      <button className="btn" disabled={!dirty || !ready} onClick={publish}>Publish to site</button></footer>
  </div>)
}
