import { useEffect, useRef, useState } from 'react'
import { blank, type Listing } from './types'
import { cleanListing, collator, filterOptions, KIND_LABEL, listingText, money, recent, slug, sortedUnique, topPrice, where } from './format'
import { AVAILABILITY, CATEGORY, CONDITION, SUBTYPE } from './options'
import { mergeListings, parseListingsFile, parsePastedRow, type ParsedRow } from './import'
import { commit, pull, type FileOut, type GhCfg } from './github'

const TEXT: [keyof Listing, string][] = [['title', 'Project / listing name'], ['unit', 'Unit / house no. & tower'], ['street', 'Street / village / project'], ['district', 'District / project'], ['municipality', 'Municipality']]
const NUM: [keyof Listing, string][] = [['salePrice', 'Sale value (₱)'], ['monthlyRent', 'Monthly rent value (₱)'], ['leasePrice', 'Lease value (₱)'], ['floorArea', 'Floor area (sqm)'], ['lotArea', 'Lot area (sqm)'], ['bedrooms', 'Bedrooms'], ['bathrooms', 'Bathrooms'], ['parking', 'Parking'], ['storey', 'Storey']]
const SEL: [keyof Listing, string, string[]][] = [['category', 'Category', CATEGORY], ['subtype', 'Property subtype', SUBTYPE], ['availability', 'Availability', AVAILABILITY], ['condition', 'Condition', CONDITION]]

async function toJpeg(file: Blob) {
  const b = await createImageBitmap(file); const k = Math.min(1, 1600 / Math.max(b.width, b.height))
  const c = document.createElement('canvas'); c.width = Math.round(b.width * k); c.height = Math.round(b.height * k)
  c.getContext('2d')!.drawImage(b, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.82)
}

const AF0 = { avail: '', cat: '', sub: '', cond: '', town: '', vis: '', sort: 'recent' }

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
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(() => !!(sessionStorage.getItem('hw-token') && JSON.parse(localStorage.getItem('hw-gh') || '{}').owner))
  const [af, setAf] = useState(AF0)
  const [formKey, setFormKey] = useState(0)   // bumped to refresh the uncontrolled textareas after a paste-fill
  const [dnd, setDnd] = useState<{ from: number; over: number; x: number; y: number } | null>(null)
  const figs = useRef<(HTMLElement | null)[]>([])
  const rects = useRef<(DOMRect | null)[]>([])
  const origin = useRef({ x: 0, y: 0 })
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const dirty = JSON.stringify(list) !== base
  const ready = connected
  const say = (text: string, ok = true) => setNote({ ok, text })

  // The GitHub connection is the login: nothing of the manager is shown until the token has been verified against the repository.
  const connect = async () => {
    const c = { owner: cfg.owner.trim(), repo: cfg.repo.trim(), branch: cfg.branch.trim() || 'main' }; const t = token.trim()
    if (!c.owner || !c.repo || !t) { say('Enter the owner, repository and access token.', false); setConnecting(false); return }
    setConnecting(true); setNote(null)
    try {
      const d = await pull(c, t)
      localStorage.setItem('hw-gh', JSON.stringify(c)); sessionStorage.setItem('hw-token', t); setCfg(c); setToken(t)
      setList(d.map(cleanListing)); setBase(JSON.stringify(d)); setConnected(true); say(`Connected. Loaded ${d.length} listings from GitHub.`)
    } catch (e) { sessionStorage.removeItem('hw-token'); say((e as Error).message, false) } finally { setConnecting(false) }
  }
  const disconnect = () => {
    if (dirty && !confirm('You have unpublished changes. Disconnect and discard them?')) return
    sessionStorage.removeItem('hw-token'); setToken(''); setConnected(false); setList([]); setBase('[]'); setPreview(null); setNote(null); setTab('listings'); setAf(AF0); setQ('')
  }
  useEffect(() => { if (token && cfg.owner && cfg.repo) connect(); else setConnecting(false) }, []) // eslint-disable-line  (re-connects after a refresh in the same tab)
  useEffect(() => { const b = (e: BeforeUnloadEvent) => dirty && e.preventDefault(); addEventListener('beforeunload', b); return () => removeEventListener('beforeunload', b) }, [dirty])
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
  const reorder = (from: number, to: number) => setDraft(d => { if (to < 0 || to >= d.photos.length || from === to) return d; const p = [...d.photos]; const [m] = p.splice(from, 1); p.splice(to, 0, m); return { ...d, photos: p } })
  // Drag a photo onto another to move it there (mouse, pen or finger).
  const dndStart = (i: number) => (e: React.PointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture?.(e.pointerId); rects.current = figs.current.map(f => f?.getBoundingClientRect() ?? null)
    origin.current = { x: e.clientX, y: e.clientY }; setDnd({ from: i, over: i, x: 0, y: 0 })
  }
  const dndMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!dnd) return
    let over = dnd.over
    rects.current.forEach((r, k) => { if (r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) over = k })
    setDnd({ ...dnd, over, x: e.clientX - origin.current.x, y: e.clientY - origin.current.y })
  }
  const dndEnd = () => { if (dnd) reorder(dnd.from, dnd.over); setDnd(null) }
  // Paste one row copied from the spreadsheet and the form fills itself.
  const fillFromRow = (text: string) => {
    try {
      const { listing: l } = parsePastedRow(text)
      const exists = list.some(x => x.id === l.id || slug(x.title) === slug(l.title))
      setDraft(d => ({ ...l, photos: d.photos, id: d.id || l.id })); setFormKey(k => k + 1)
      say(`Filled the form from “${l.title}”.${exists ? ' It matches a listing that is already here, so saving will update it.' : ''} Check the details, add photos, then Save.`)
    } catch (e) { say((e as Error).message, false) }
  }
  const opts = filterOptions(list)
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const pv = (l: Listing) => topPrice(l)?.value ?? 0
  const rows = list.filter(l => words.every(w => listingText(l).includes(w)) && (!af.avail || l.availability.toLowerCase().includes(af.avail.toLowerCase())) && (!af.cat || l.category === af.cat) && (!af.sub || l.subtype === af.sub)
    && (!af.cond || l.condition === af.cond) && (!af.town || l.municipality === af.town) && (!af.vis || (af.vis === 'shown') === l.published))
    .sort(af.sort === 'high' ? (a, b) => pv(b) - pv(a) : af.sort === 'low' ? (a, b) => pv(a) - pv(b) : af.sort === 'name' ? (a, b) => collator.compare(a.title, b.title) : recent)
  const filtering = !!(q || af.avail || af.cat || af.sub || af.cond || af.town || af.vis || af.sort !== 'recent')
  const asel = (k: keyof typeof AF0, label: string, choices: string[]) => <label key={k}>{label}<select value={af[k]} onChange={e => setAf({ ...af, [k]: e.target.value })}><option value="">Any</option>{choices.map(o => <option key={o}>{o}</option>)}</select></label>
  const hiddenCount = list.filter(l => !l.published).length

  if (!connected) return (
    <div className="wall"><form className="wall-card" onSubmit={e => { e.preventDefault(); connect() }}>
      <span className="lock" aria-hidden><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg></span>
      <h1>Listings manager</h1>
      <p className="muted">Connect to GitHub to continue.</p>
      <label>Owner<input value={cfg.owner} autoComplete="off" onChange={e => setCfg({ ...cfg, owner: e.target.value })} /></label>
      <label>Repository<input value={cfg.repo} autoComplete="off" onChange={e => setCfg({ ...cfg, repo: e.target.value })} /></label>
      <label>Branch<input value={cfg.branch} autoComplete="off" onChange={e => setCfg({ ...cfg, branch: e.target.value })} /></label>
      <label>Access token<input type="password" value={token} autoComplete="off" onChange={e => setToken(e.target.value)} /></label>
      {note && <p className="note bad" role="alert">{note.text}</p>}
      <button className="btn" disabled={connecting}>{connecting ? 'Connecting…' : 'Connect'}</button>
      <p className="muted small">Use a fine-grained token for this repository only, with Contents: read and write. It is kept in this browser tab and cleared when you close it.</p>
      <a href="#/">← Back to the website</a>
    </form></div>)

  return (<div className="admin">
    <header><a href="#/">← View site</a><h1>Listings manager</h1><span className="muted who">Connected to {cfg.owner}/{cfg.repo}</span><button className="disc" onClick={disconnect}>Disconnect</button></header>

    {note && <p className={note.ok ? 'note ok' : 'note bad'} role="status">{note.text}</p>}

    <div className="tabs">{(['listings', 'import', 'edit'] as const).map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => { if (t === 'edit') setDraft(blank()); setTab(t) }}>{{ listings: `Listings (${list.length})`, import: 'Import', edit: 'Add listing' }[t]}</button>)}</div>

    {tab === 'listings' && <section>
      <div className="afilters">
        <div className="searchbar"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m20 20-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <input type="search" aria-label="Search listings" placeholder="Search name, building, area, amenity, remarks…" value={q} onChange={e => setQ(e.target.value)} /></div>
        {asel('avail', 'Availability', opts.avail)}{asel('cat', 'Category', opts.cat)}{asel('sub', 'Property subtype', opts.sub)}{asel('cond', 'Condition', opts.cond)}{asel('town', 'Municipality', opts.town)}
        <label>Visibility<select value={af.vis} onChange={e => setAf({ ...af, vis: e.target.value })}><option value="">Any</option><option value="shown">On site</option><option value="hidden">Hidden</option></select></label>
        <label>Sort by<select value={af.sort} onChange={e => setAf({ ...af, sort: e.target.value })}><option value="recent">Most Recent</option><option value="high">Price: High to Low</option><option value="low">Price: Low to High</option><option value="name">Name: A to Z</option></select></label>
      </div>
      <p className="muted resultsline">{filtering ? `${rows.length} of ${list.length} listings` : `${list.length} listings`} · {list.length - hiddenCount} on the site · {hiddenCount} hidden{filtering && <button className="linkish" onClick={() => { setQ(''); setAf(AF0) }}>Clear filters</button>}</p>
      {rows.length === 0 ? <p className="empty">{list.length ? 'No listings match those filters.' : 'No listings yet. Import your spreadsheet or add one by hand.'}</p> :
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
      <label className="wide rowpaste">Paste a row from your spreadsheet
        <textarea rows={2} placeholder="In your sheet, select a row, copy it, click here and paste (Ctrl/⌘ + V). The form fills itself." onPaste={e => { e.preventDefault(); fillFromRow(e.clipboardData.getData('text')); e.currentTarget.value = '' }} />
      </label>
      {TEXT.map(([k, label]) => <label key={k}>{label}<input value={String(draft[k] ?? '')} onChange={e => set(k, e.target.value)} /></label>)}
      {SEL.map(([k, label, opts]) => <label key={k}>{label}<select value={String(draft[k] ?? '')} onChange={e => set(k, e.target.value)}><option value="">—</option>{opts.map(o => <option key={o}>{o}</option>)}</select></label>)}
      <label>Availability date<input type="date" value={draft.availableFrom} onChange={e => set('availableFrom', e.target.value)} /></label>
      {NUM.map(([k, label]) => <label key={k}>{label}<input type="number" inputMode="decimal" min="0" value={(draft[k] as number | undefined) ?? ''} onChange={e => set(k, e.target.value ? +e.target.value : undefined)} /></label>)}
      <label className="wide">Amenities (comma separated, sorted automatically)<textarea key={'a' + formKey} defaultValue={draft.amenities.join(', ')} onBlur={e => set('amenities', sortedUnique(e.target.value.split(',')))} /></label>
      <label className="wide">Remarks<textarea key={'r' + formKey} defaultValue={draft.remarks} onBlur={e => set('remarks', e.target.value)} /></label>

      <div className="wide"><b>Photos</b> <span className="muted">first photo is the cover</span>
        <div className="paste" tabIndex={0} onPaste={onPaste} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); addImages([...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))) }}>
          Click here, then paste an image (Ctrl/⌘ + V). You can also drop files or an image link.
          <label className="btn ghost">Choose photos<input type="file" accept="image/*" multiple hidden onChange={e => { addImages([...(e.target.files ?? [])]); e.target.value = '' }} /></label>
        </div>
        {draft.photos.length > 0 && <><p className="muted">Drag a photo onto another to reorder it. The first one is the cover.</p><div className="thumbs">{draft.photos.map((p, i) => {
          const dragging = dnd?.from === i
          return <figure key={i} data-i={i} ref={el => { figs.current[i] = el }} tabIndex={0} aria-label={`Photo ${i + 1} of ${draft.photos.length}. Use the left and right arrow keys to move it.`}
            className={dragging ? 'drag' : dnd && dnd.over === i ? 'over' : ''} style={dragging ? { transform: `translate(${dnd!.x}px,${dnd!.y}px) scale(1.04)` } : undefined}
            onPointerDown={dndStart(i)} onPointerMove={dndMove} onPointerUp={dndEnd} onPointerCancel={() => setDnd(null)}
            onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); reorder(i, i + (e.key === 'ArrowLeft' ? -1 : 1)) } }}>
            <img src={p} alt="" draggable={false} />
            <figcaption>{i === 0 ? 'Cover' : i + 1}{p.startsWith('data:') && <small> · new</small>}<button aria-label="Remove photo" onClick={() => setDraft(x => ({ ...x, photos: x.photos.filter((_, k) => k !== i) }))}>×</button></figcaption></figure>
        })}</div></>}
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
