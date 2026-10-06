import { useEffect, useState } from 'react'
import { blank, type Listing } from './types'
import { cleanListing, KIND_LABEL, money, slug, sortedUnique, topPrice, where } from './format'
import { AVAILABILITY, CATEGORY, CONDITION, SUBTYPE } from './options'
import { mergeListings, parseListingsFile, type ParsedRow } from './import'
import { commit, pull, type FileOut, type GhCfg } from './github'

const TEXT: [keyof Listing, string][] = [['title', 'Project / listing name'], ['unit', 'Unit / house no. & tower'], ['street', 'Street / village / project'], ['district', 'District / project'], ['municipality', 'Municipality']]
const NUM: [keyof Listing, string][] = [['salePrice', 'Sale value (₱)'], ['monthlyRent', 'Monthly rent value (₱)'], ['leasePrice', 'Lease value (₱)'], ['floorArea', 'Floor area (sqm)'], ['lotArea', 'Lot area (sqm)'], ['bedrooms', 'Bedrooms'], ['bathrooms', 'Bathrooms'], ['parking', 'Parking'], ['storey', 'Storey']]
const SEL: [keyof Listing, string, string[]][] = [['category', 'Category', CATEGORY], ['subtype', 'Property subtype', SUBTYPE], ['availability', 'Availability', AVAILABILITY], ['condition', 'Condition', CONDITION]]

async function toJpeg(file: Blob) {
  const b = await createImageBitmap(file); const k = Math.min(1, 1600 / Math.max(b.width, b.height))
  const c = document.createElement('canvas'); c.width = Math.round(b.width * k); c.height = Math.round(b.height * k)
  c.getContext('2d')!.drawImage(b, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.82)
}

export default function Admin() {
  const [cfg, setCfg] = useState<GhCfg>(() => JSON.parse(localStorage.getItem('hw-gh') || '{"owner":"","repo":"","branch":"main"}'))
  const [token, setToken] = useState(sessionStorage.getItem('hw-token') || '')
  const [list, setList] = useState<Listing[]>([])
  const [base, setBase] = useState('[]')
  const [tab, setTab] = useState<'listings' | 'import' | 'edit'>('listings')
  const [draft, setDraft] = useState<Listing>(blank())
  const [preview, setPreview] = useState<ParsedRow[] | null>(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const dirty = JSON.stringify(list) !== base
  const ready = !!(cfg.owner && cfg.repo && token)
  const say = (text: string, ok = true) => setNote({ ok, text })

  const load = async () => {
    try {
      const d = ready ? await pull(cfg, token) : await (await fetch('data/listings.json?' + Date.now())).json()
      setList(d.map(cleanListing)); setBase(JSON.stringify(d)); if (ready) say(`Loaded ${d.length} listings from GitHub.`)
    } catch (e) { say((e as Error).message, false) }
  }
  useEffect(() => { load() }, []) // eslint-disable-line
  useEffect(() => { const b = (e: BeforeUnloadEvent) => dirty && e.preventDefault(); addEventListener('beforeunload', b); return () => removeEventListener('beforeunload', b) }, [dirty])

  const connect = () => { localStorage.setItem('hw-gh', JSON.stringify(cfg)); sessionStorage.setItem('hw-token', token); load() }
  const publish = async () => {
    if (list.length === 0 && JSON.parse(base).length > 0 && !confirm('This will publish ZERO listings and remove all current ones from the site. Continue?')) return
    setBusy(true)
    try {
      const files: FileOut[] = []; const stamp = Date.now().toString(36)
      const out = list.map(l => ({ ...l, amenities: sortedUnique(l.amenities), photos: l.photos.map((p, k) => {
        if (!p.startsWith('data:')) return p
        const name = `photos/${slug(l.id)}-${stamp}-${k}.jpg`   // pasted image becomes a file in the repo; the listing stores its path as text
        files.push({ path: 'public/' + name, content: p.split(',')[1], base64: true }); return name
      }) }))
      files.push({ path: 'public/data/listings.json', content: JSON.stringify(out, null, 2) + '\n' })
      await commit(cfg, token, files, `Update listings (${out.length})`)
      setList(out); setBase(JSON.stringify(out)); say('Published in one commit. The site updates in about a minute.')
    } catch (e) { say((e as Error).message, false) } finally { setBusy(false) }
  }
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' })); a.download = 'listings.json'; a.click() }

  const onFile = async (file?: File) => {
    if (!file) return
    try { setPreview(await parseListingsFile(file)); setNote(null) } catch (e) { setPreview(null); say((e as Error).message, false) }
  }
  const applyImport = () => {
    const r = mergeListings(list, preview!.map(p => p.listing)); const hidden = preview!.filter(p => !p.listing.published).length
    setList(r.list); setPreview(null); setTab('listings'); say(`Added ${r.added}, updated ${r.updated} (${hidden} hidden from the site). Publish to put the changes online.`)
  }
  const save = () => {
    if (!draft.title.trim()) return say('Add a listing name before saving.', false)
    const l = { ...draft, id: draft.id || slug(draft.title), amenities: sortedUnique(draft.amenities), updatedAt: new Date().toISOString() }
    setList(x => (x.some(i => i.id === l.id) ? x.map(i => (i.id === l.id ? l : i)) : [l, ...x])); setTab('listings'); say(`Saved “${l.title}”. Publish to put it online.`)
  }
  const set = (k: keyof Listing, v: unknown) => setDraft(d => ({ ...d, [k]: v }))

  const addImages = async (files: Blob[]) => {
    try { const urls = await Promise.all(files.map(toJpeg)); setDraft(d => ({ ...d, photos: [...d.photos, ...urls] })) } catch { say('That image could not be read. Try a JPG or PNG.', false) }
  }
  const onPaste = (e: React.ClipboardEvent) => {
    const imgs = [...e.clipboardData.files].filter(f => f.type.startsWith('image/'))
    if (imgs.length) { e.preventDefault(); addImages(imgs); return }
    const t = e.clipboardData.getData('text').trim()
    if (/^https?:\/\/\S+\.(jpe?g|png|webp|avif|gif)(\?\S*)?$/i.test(t)) { e.preventDefault(); setDraft(d => ({ ...d, photos: [...d.photos, t] })) }
  }
  const move = (i: number, dir: number) => setDraft(d => { const p = [...d.photos]; const j = i + dir; if (j < 0 || j >= p.length) return d; [p[i], p[j]] = [p[j], p[i]]; return { ...d, photos: p } })
  const rows = list.filter(l => (l.title + where(l)).toLowerCase().includes(q.toLowerCase()))
  const hiddenCount = list.filter(l => !l.published).length

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
      <p className="muted">Fine-grained token for this repository only, with Contents: read and write. It stays in this browser tab.</p>
    </details>

    {note && <p className={note.ok ? 'note ok' : 'note bad'} role="status">{note.text}</p>}

    <div className="tabs">{(['listings', 'import', 'edit'] as const).map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => { if (t === 'edit') setDraft(blank()); setTab(t) }}>{{ listings: `Listings (${list.length})`, import: 'Import', edit: 'Add listing' }[t]}</button>)}</div>

    {tab === 'listings' && <section>
      <input className="search-in" placeholder="Search by name or location" value={q} onChange={e => setQ(e.target.value)} />
      <p className="muted">{list.length - hiddenCount} shown on the site · {hiddenCount} hidden</p>
      {rows.length === 0 ? <p className="empty">No listings yet. Import your spreadsheet or add one by hand.</p> :
        <div className="tablewrap"><table><thead><tr><th>Listing</th><th>Location</th><th>Price</th><th>On site</th><th></th></tr></thead><tbody>{rows.map(l => { const p = topPrice(l); return <tr key={l.id} className={l.published ? '' : 'dim'}>
          <td>{l.title}</td><td>{where(l)}</td><td>{p ? `${money(p.value)} · ${KIND_LABEL[p.kind]}` : '—'}</td>
          <td><input type="checkbox" checked={l.published} aria-label={`Show ${l.title} on the site`} onChange={e => setList(x => x.map(i => (i.id === l.id ? { ...i, published: e.target.checked } : i)))} />{!l.published && <small className="warn"> Hidden</small>}</td>
          <td className="acts"><button onClick={() => { setDraft(l); setTab('edit') }}>Edit</button><button onClick={() => confirm(`Delete “${l.title}”?`) && setList(x => x.filter(i => i.id !== l.id))}>Delete</button></td></tr> })}</tbody></table></div>}
    </section>}

    {tab === 'import' && <section>
      <label className="drop">Choose your listings spreadsheet (.xlsx or .csv)<input type="file" accept=".xlsx,.xls,.csv,text/csv" onChange={e => onFile(e.target.files?.[0])} /></label>
      <p className="muted">Rows marked “Unlisted / Occupied” in the Webpage column are imported as hidden. The sheet's Photos column is ignored. Listings already here are updated, not duplicated, and photos you added in the admin are kept.</p>
      {preview && <>
        <div className="tablewrap"><table><thead><tr><th>Listing</th><th>Location</th><th>Price</th><th>Status</th></tr></thead><tbody>{preview.map(({ listing: l, warnings }) => { const p = topPrice(l); return <tr key={l.id} className={l.published ? '' : 'dim'}>
          <td>{l.title}</td><td>{where(l)}</td><td>{p ? money(p.value) : '—'}</td>
          <td>{list.some(x => x.id === l.id || slug(x.title) === slug(l.title)) ? 'Update' : 'New'} · {l.published ? 'Shown' : 'Hidden'}{warnings.length > 0 && <small className="warn"> · {warnings.join(', ')}</small>}</td></tr> })}</tbody></table></div>
        <button className="btn" onClick={applyImport}>Add {preview.length} {preview.length === 1 ? 'listing' : 'listings'} to draft</button>
      </>}
    </section>}

    {tab === 'edit' && <section className="form">
      {TEXT.map(([k, label]) => <label key={k}>{label}<input value={String(draft[k] ?? '')} onChange={e => set(k, e.target.value)} /></label>)}
      {SEL.map(([k, label, opts]) => <label key={k}>{label}<select value={String(draft[k] ?? '')} onChange={e => set(k, e.target.value)}><option value="">—</option>{opts.map(o => <option key={o}>{o}</option>)}</select></label>)}
      <label>Availability date<input type="date" value={draft.availableFrom} onChange={e => set('availableFrom', e.target.value)} /></label>
      {NUM.map(([k, label]) => <label key={k}>{label}<input type="number" inputMode="decimal" min="0" value={(draft[k] as number | undefined) ?? ''} onChange={e => set(k, e.target.value ? +e.target.value : undefined)} /></label>)}
      <label className="wide">Amenities (comma separated, sorted automatically)<textarea defaultValue={draft.amenities.join(', ')} onBlur={e => set('amenities', sortedUnique(e.target.value.split(',')))} /></label>
      <label className="wide">Remarks<textarea defaultValue={draft.remarks} onBlur={e => set('remarks', e.target.value)} /></label>

      <div className="wide"><b>Photos</b> <span className="muted">first photo is the cover</span>
        <div className="paste" tabIndex={0} onPaste={onPaste} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); addImages([...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))) }}>
          Click here, then paste an image (Ctrl/⌘ + V). You can also drop files or an image link.
          <label className="btn ghost">Choose photos<input type="file" accept="image/*" multiple hidden onChange={e => { addImages([...(e.target.files ?? [])]); e.target.value = '' }} /></label>
        </div>
        {draft.photos.length > 0 && <div className="thumbs">{draft.photos.map((p, i) => <figure key={i}><img src={p} alt={`Photo ${i + 1}`} />
          <figcaption>{i === 0 ? 'Cover' : i + 1}{p.startsWith('data:') && <small> · new</small>}<span><button aria-label="Move earlier" onClick={() => move(i, -1)}>←</button><button aria-label="Move later" onClick={() => move(i, 1)}>→</button><button aria-label="Remove photo" onClick={() => setDraft(d => ({ ...d, photos: d.photos.filter((_, k) => k !== i) }))}>×</button></span></figcaption></figure>)}</div>}
      </div>
      <label className="check"><input type="checkbox" checked={draft.negotiable} onChange={e => set('negotiable', e.target.checked)} /> Price is negotiable</label>
      <label className="check"><input type="checkbox" checked={draft.published} onChange={e => set('published', e.target.checked)} /> Show on the site</label>
      <div className="wide"><button className="btn" onClick={save}>Save listing</button></div>
    </section>}

    <footer className="bar"><span>{dirty ? 'You have unpublished changes.' : 'Everything is published.'}</span>
      <button onClick={download}>Download JSON</button>
      <button className="btn" disabled={!dirty || !ready || busy} onClick={publish}>{busy ? 'Publishing…' : 'Publish to site'}</button></footer>
  </div>)
}
