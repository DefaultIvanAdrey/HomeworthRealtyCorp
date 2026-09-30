import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { Listing, SiteConfig } from './types'
import { headline, money, where } from './format'

const Admin = lazy(() => import('./Admin'))

export default function App() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => { const f = () => setHash(location.hash); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  return hash.startsWith('#/admin') ? <Suspense fallback={null}><Admin /></Suspense> : <Site />
}

const Fact = ({ v, l }: { v?: number; l: string }) => (v ? <span><b>{v}</b> {l}</span> : null)

function Site() {
  const [site, setSite] = useState<SiteConfig>()
  const [all, setAll] = useState<Listing[] | null>(null)
  const [open, setOpen] = useState<Listing | null>(null)
  const [err, setErr] = useState('')
  const [f, setF] = useState({ mode: '', place: '', beds: '', max: '' })

  useEffect(() => {
    fetch('data/site.json').then(r => { if (!r.ok) throw new Error(`data/site.json returned ${r.status}`); return r.json() }).catch((e: Error) => setErr(e.message)).then((s?: SiteConfig) => { if (!s) return; setSite(s); document.title = `${s.name} | ${s.tagline}` })
    fetch('data/listings.json?' + Date.now()).then(r => r.json()).then((l: Listing[]) => setAll(l.filter(x => x.published))).catch(() => setAll([]))
  }, [])
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null); addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [])

  const places = useMemo(() => [...new Set((all ?? []).map(l => l.municipality).filter(Boolean))].sort(), [all])
  const shown = useMemo(() => (all ?? []).filter(l => {
    const price = f.mode === 'rent' ? l.monthlyRent : l.salePrice ?? l.monthlyRent
    return (!f.mode || (f.mode === 'sale' ? l.salePrice : l.monthlyRent)) && (!f.place || l.municipality === f.place)
      && (!f.beds || (l.bedrooms ?? 0) >= +f.beds) && (!f.max || (price ?? 0) <= +f.max)
  }), [all, f])

  if (err) return <p style={{ padding: '2rem', font: '1rem system-ui' }}>The site could not load its settings ({err}). Check that the <code>public/data</code> folder is in your repository, then redeploy.</p>
  if (!site) return null
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  return (<>
    <header className="hero" style={{ backgroundImage: `linear-gradient(105deg, rgba(10,32,36,.92) 30%, rgba(10,32,36,.35)), url(${site.heroImage})` }}>
      <nav><img src={site.logo} alt={site.name} /><a href="#listings">Listings</a><a href="#about">About</a><a href="#contact">Contact</a></nav>
      <h1>{site.tagline}</h1>
      <form className="search" onSubmit={e => { e.preventDefault(); document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' }) }}>
        <label>Looking to<select value={f.mode} onChange={set('mode')}><option value="">Buy or rent</option><option value="sale">Buy</option><option value="rent">Rent</option></select></label>
        <label>Where<select value={f.place} onChange={set('place')}><option value="">Anywhere</option>{places.map(p => <option key={p}>{p}</option>)}</select></label>
        <label>Bedrooms<select value={f.beds} onChange={set('beds')}><option value="">Any</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}+</option>)}</select></label>
        <label>Max price (₱)<input inputMode="numeric" placeholder="No limit" value={f.max} onChange={set('max')} /></label>
        <button>Show {all ? shown.length : ''} {shown.length === 1 ? 'listing' : 'listings'}</button>
      </form>
    </header>

    <main>
      <section id="listings" className="wrap">
        {all === null ? <p className="muted">Loading listings…</p> : shown.length === 0 ? (
          <p className="empty">{all.length ? 'No listings match those filters. Try widening the price or location.' : 'No listings are published yet.'}</p>
        ) : <div className="grid">{shown.map(l => (
          <button key={l.id} className="card" onClick={() => setOpen(l)}>
            <div className="thumb" style={l.photos[0] ? { backgroundImage: `url(${l.photos[0]})` } : undefined}>{!l.photos[0] && <span>{l.municipality || l.category}</span>}</div>
            <div className="body">
              <p className="price">{headline(l)}{l.negotiable && <small> negotiable</small>}</p>
              <h3>{l.title}</h3>
              <p className="muted">{where(l)}</p>
              <p className="facts"><Fact v={l.bedrooms} l="bed" /><Fact v={l.bathrooms} l="bath" /><Fact v={l.floorArea} l="sqm" /><Fact v={l.parking} l="parking" /></p>
            </div>
          </button>))}</div>}
      </section>

      <section id="about" className="wrap about"><h2>About Homeworth</h2><div>{site.about.map((p, i) => <p key={i}>{p}</p>)}</div></section>
      <section id="contact" className="wrap contact"><h2>Talk to us</h2>
        <p>{site.address}</p><p><a href={`tel:${site.phone}`}>{site.phone}</a>{site.email && <> · <a href={`mailto:${site.email}`}>{site.email}</a></>}</p></section>
    </main>

    {open && <div className="scrim" onClick={() => setOpen(null)}><article className="sheet" role="dialog" aria-modal="true" aria-label={open.title} onClick={e => e.stopPropagation()}>
      <button className="close" onClick={() => setOpen(null)} aria-label="Close">×</button>
      {open.photos.length > 0 && <div className="strip">{open.photos.map(p => <img key={p} src={p} alt="" loading="lazy" />)}</div>}
      <p className="price">{headline(open)}{open.negotiable && <small> negotiable</small>}</p>
      <h2>{open.title}</h2>
      <p className="muted">{[open.unit, open.street, where(open)].filter(Boolean).join(' · ')}</p>
      <dl>{([['Availability', open.availability], ['Condition', open.condition], ['Monthly rent', money(open.monthlyRent)], ['Lease', money(open.leasePrice)], ['Floor area', open.floorArea && open.floorArea + ' sqm'], ['Lot area', open.lotArea && open.lotArea + ' sqm'], ['Bedrooms', open.bedrooms], ['Bathrooms', open.bathrooms], ['Parking', open.parking], ['Storey', open.storey], ['Available from', open.availableFrom]] as [string, string | number | undefined][]).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {open.amenities.length > 0 && <p className="tags">{open.amenities.map(a => <span key={a}>{a}</span>)}</p>}
      {open.remarks && <p className="remarks">{open.remarks}</p>}
      <div className="actions"><a className="btn" href={`tel:${site.phone}`}>Call about this listing</a>{open.photosLink && <a className="btn ghost" href={open.photosLink} target="_blank" rel="noreferrer">View photos</a>}</div>
    </article></div>}
  </>)
}
