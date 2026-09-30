import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { Listing, SiteConfig } from './types'
import { collator, KIND_LABEL, money, recent, topPrice, where } from './format'
import { F_AVAILABILITY, F_CATEGORY, CONDITION, SORTS } from './options'
import Carousel from './Carousel'

const Admin = lazy(() => import('./Admin'))

export default function App() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => { const f = () => setHash(location.hash); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  return hash.startsWith('#/admin') ? <Suspense fallback={null}><Admin /></Suspense> : <Site />
}

const Price = ({ l }: { l: Listing }) => { const p = topPrice(l); return <p className="price">{p ? money(p.value) : 'Price on request'}{p && <small> {KIND_LABEL[p.kind]}{l.negotiable ? ' · negotiable' : ''}</small>}</p> }
const Fact = ({ v, l }: { v?: number | string; l: string }) => (v ? <span><b>{v}</b> {l}</span> : null)

function Site() {
  const [site, setSite] = useState<SiteConfig>()
  const [all, setAll] = useState<Listing[] | null>(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState<Listing | null>(null)
  const [box, setBox] = useState<{ l: Listing; i: number } | null>(null)
  const [ask, setAsk] = useState('')
  const [f, setF] = useState({ avail: '', cat: '', cond: '', max: '', sort: 'recent' })
  const heroRef = useRef<HTMLElement>(null)
  const [scrolled, setScrolled] = useState(false)

  // Parallax: one rAF-throttled scroll listener drives a single CSS variable (--p, 0 to 1) that the hero reads.
  useEffect(() => {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const tick = () => { raf = 0; const y = scrollY; if (!still) heroRef.current?.style.setProperty('--p', Math.min(1, y / innerHeight).toFixed(3)); setScrolled(s => ((y > 40) === s ? s : y > 40)) }
    const on = () => { if (!raf) raf = requestAnimationFrame(tick) }
    addEventListener('scroll', on, { passive: true }); tick()
    return () => { removeEventListener('scroll', on); cancelAnimationFrame(raf) }
  }, [])

  useEffect(() => {
    fetch('data/site.json').then(r => { if (!r.ok) throw new Error(`data/site.json returned ${r.status}`); return r.json() }).then((s: SiteConfig) => { setSite(s); document.title = `${s.name} | ${s.tagline}` }).catch((e: Error) => setErr(e.message))
    fetch('data/listings.json?' + Date.now()).then(r => r.json()).then((l: Listing[]) => setAll(l.filter(x => x.published))).catch(() => setAll([]))
  }, [])
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && (box ? setBox(null) : setOpen(null))
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [box])
  useEffect(() => { document.body.style.overflow = open || box ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [open, box])

  const shown = useMemo(() => {
    const max = +f.max.replace(/[^0-9]/g, '')
    const out = (all ?? []).filter(l => {
      const p = topPrice(l)?.value ?? 0
      return (!f.avail || l.availability.toLowerCase().includes(f.avail.toLowerCase())) && (!f.cat || l.category === f.cat || l.subtype === f.cat)
        && (!f.cond || l.condition === f.cond) && (!max || p <= max)
    })
    const pv = (l: Listing) => topPrice(l)?.value ?? 0
    return out.sort(f.sort === 'high' ? (a, b) => pv(b) - pv(a) : f.sort === 'low' ? (a, b) => pv(a) - pv(b) : recent)
  }, [all, f])

  // Scroll reveal: elements with .rv fade up the first time they enter the viewport.
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.rv:not([data-in])')
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) { els.forEach(e => e.setAttribute('data-in', '1')); return }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.setAttribute('data-in', '1'); io.unobserve(e.target) } }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
    els.forEach(e => io.observe(e)); return () => io.disconnect()
  }, [shown, all, site])

  if (err) return <p style={{ padding: '2rem', font: '1rem system-ui' }}>The site could not load its settings ({err}). Check that the <code>public/data</code> folder is in your repository, then redeploy.</p>
  if (!site) return null
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const sel = (k: keyof typeof f, label: string, a: string, opts: readonly string[]) => <label key={k}>{label}<select value={f[k]} onChange={set(k)}><option value="">{a}</option>{opts.map(o => <option key={o}>{o}</option>)}</select></label>

  return (<>
    <div className={scrolled ? 'top solid' : 'top'}><nav><img src={site.logo} alt={site.name} /><a href="#find">Listings</a><a href="#about">About</a><a className="pill" href="#contact">Inquire</a></nav></div>
    <header className="hero" ref={heroRef}>
      <div className="hero-bg" style={{ backgroundImage: `url(${site.heroImage})` }} />
      <div className="hero-shade" />
      <div className="hero-copy">
        <p className="eyebrow">{site.name}</p>
        <h1 aria-label={site.tagline}>{site.tagline.split(' ').map((w, i, a) => <span key={i} aria-hidden className="w" style={{ '--i': i } as React.CSSProperties}><span className={i === a.length - 1 ? 'gold' : ''}>{w}</span>{' '}</span>)}</h1>
        {site.heroSub && <p className="sub">{site.heroSub}</p>}
        <a className="cta" href="#find">{all && all.length ? `Explore ${all.length} homes` : 'Explore homes'} <span aria-hidden>↓</span></a>
      </div>
      <span className="cue" aria-hidden />
    </header>

    <main>
      <section id="find" className="wrap find">
        <div className="head rv"><p className="eyebrow dark">Available now</p><h2>Find your home</h2></div>
        <form className="filters rv" onSubmit={e => e.preventDefault()} style={{ '--d': '.1s' } as React.CSSProperties}>
          {sel('avail', 'Availability', 'Any', F_AVAILABILITY)}
          {sel('cat', 'Category', 'Any', F_CATEGORY)}
          {sel('cond', 'Condition', 'Any', CONDITION)}
          <label>Max price (₱)<input inputMode="numeric" placeholder="No limit" value={f.max} onChange={set('max')} /></label>
          <label>Sort by<select value={f.sort} onChange={set('sort')}>{SORTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        </form>
        <p className="results" role="status"><span>{all ? `${shown.length} ${shown.length === 1 ? 'listing' : 'listings'}` : ''}</span>
          {(f.avail || f.cat || f.cond || f.max || f.sort !== 'recent') && <button onClick={() => setF({ avail: '', cat: '', cond: '', max: '', sort: 'recent' })}>Clear filters</button>}</p>
      </section>
      <section id="listings" className="wrap">
        {all === null ? <p className="muted">Loading listings…</p> : shown.length === 0 ? (
          <p className="empty">{all.length ? 'No listings match those filters. Try widening the price or clearing a filter.' : 'No listings are published yet.'}</p>
        ) : <div className="grid">{shown.map((l, n) => (
          <div key={l.id} className="card rv" style={{ '--d': `${(n % 3) * 0.09}s` } as React.CSSProperties} role="button" tabIndex={0} aria-label={l.title} onClick={() => setOpen(l)} onKeyDown={e => e.key === 'Enter' && setOpen(l)}>
            {l.photos.length ? <Carousel photos={l.photos} alt={l.title} /> : <div className="thumb"><span>{l.subtype || l.category}</span></div>}
            <div className="body">
              <Price l={l} />
              <h3>{l.title}</h3>
              <p className="muted">{where(l)}</p>
              <p className="facts"><Fact v={l.subtype} l="" /><Fact v={l.floorArea} l="sqm" /><Fact v={l.bathrooms} l="bath" /></p>
            </div>
          </div>))}</div>}
      </section>

      <section id="about" className="wrap about rv">
        <h2>About Us</h2>
        <div>
          <h3>Our Objectives and Goals</h3><ul>{site.objectives.map((p, i) => <li key={i}>{p}</li>)}</ul>
          <h3>Our Business and Targets</h3><ul>{site.business.map((p, i) => <li key={i}>{p}</li>)}</ul>
          {site.story.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </section>
      <section id="contact" className="wrap contact rv">
        <div><h2>Get in touch</h2><h3>Address</h3><p>{site.address}</p><h3>Contacts</h3>
          <p><a href={`tel:${site.phone}`}>{site.phone}</a></p>{site.emails.map(m => <p key={m}><a href={`mailto:${m}`}>{m}</a></p>)}</div>
        <Inquiry site={site} prefill={ask} />
      </section>
    </main>
    <footer className="foot">© {new Date().getFullYear()} {site.name}</footer>

    {open && <div className="scrim" onClick={() => setOpen(null)}><article className="sheet" role="dialog" aria-modal="true" aria-label={open.title} onClick={e => e.stopPropagation()}>
      <span className="grab" aria-hidden />
      <button className="close" onClick={() => setOpen(null)} aria-label="Close">×</button>
      {open.photos.length > 0 && <Carousel photos={open.photos} alt={open.title} onSelect={i => setBox({ l: open, i })} />}
      <div className="pad">
        <Price l={open} />
        <h2>{open.title}</h2>
        <p className="muted">{[open.unit, open.street, where(open)].filter(Boolean).join(' · ')}</p>
        <dl>{([['Availability', open.availability], ['Category', open.category], ['Type', open.subtype], ['Condition', open.condition], ['Sale price', money(open.salePrice)], ['Monthly rent', money(open.monthlyRent)], ['Lease / month', money(open.leasePrice)], ['Floor area', open.floorArea && open.floorArea + ' sqm'], ['Lot area', open.lotArea && open.lotArea + ' sqm'], ['Bedrooms', open.bedrooms], ['Bathrooms', open.bathrooms], ['Parking', open.parking], ['Storey', open.storey], ['Available from', open.availableFrom]] as [string, string | number | undefined][]).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        {open.amenities.length > 0 && <p className="tags">{[...open.amenities].sort(collator.compare).map(a => <span key={a}>{a}</span>)}</p>}
        {open.remarks && <p className="remarks">{open.remarks}</p>}
        <div className="actions"><a className="btn" href={`tel:${site.phone}`}>Call us</a>
          <button className="btn ghost" onClick={() => { setAsk(`Hi, I'm interested in ${open.title}.`); setOpen(null); setTimeout(() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }), 50) }}>Send inquiry</button>
          {open.photosLink && <a className="btn ghost" href={open.photosLink} target="_blank" rel="noreferrer">More photos</a>}</div>
      </div>
    </article></div>}

    {box && <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer"><button className="close" onClick={() => setBox(null)} aria-label="Close photo viewer">×</button><Carousel photos={box.l.photos} alt={box.l.title} start={box.i} contain /></div>}
  </>)
}

function Inquiry({ site, prefill }: { site: SiteConfig; prefill: string }) {
  const [st, setSt] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle')
  const [msg, setMsg] = useState(prefill)
  useEffect(() => { if (prefill) setMsg(prefill) }, [prefill])
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget; const d = new FormData(form)
    if (d.get('_honey')) return
    setSt('sending')
    try {
      const r = await fetch(`https://formsubmit.co/ajax/${site.inquiry.to}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name: d.get('name'), mobile: d.get('mobile'), email: d.get('email'), message: msg, _subject: site.inquiry.subject, _cc: site.inquiry.cc.join(','), _template: 'table', _captcha: 'false' }) })
      if (!r.ok) throw new Error(); setSt('ok'); form.reset(); setMsg('')
    } catch { setSt('err') }
  }
  return (
    <form className="inquiry" onSubmit={submit}>
      <h3>Send us an inquiry</h3>
      <label>Name*<input name="name" required autoComplete="name" placeholder="Your name" /></label>
      <label>Mobile Number*<input name="mobile" type="tel" required autoComplete="tel" placeholder="+63 123 456 7890" /></label>
      <label>Your email*<input name="email" type="email" required autoComplete="email" placeholder="Your email address" /></label>
      <label>Message*<textarea name="message" required rows={4} placeholder="Enter your message" value={msg} onChange={e => setMsg(e.target.value)} /></label>
      <input name="_honey" tabIndex={-1} autoComplete="off" style={{ display: 'none' }} />
      <button className="btn" disabled={st === 'sending'}>{st === 'sending' ? 'Sending…' : 'Submit'}</button>
      <p role="status" className={st === 'err' ? 'bad' : 'ok'}>{st === 'ok' ? 'Thank you. We received your inquiry and will get back to you soon.' : st === 'err' ? 'Sorry, that did not send. Please call or email us instead.' : ''}</p>
    </form>
  )
}
