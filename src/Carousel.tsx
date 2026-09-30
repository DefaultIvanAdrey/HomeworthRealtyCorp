import { useEffect, useRef, useState } from 'react'

/** Swipeable, snap-scrolling photo strip with dots and a counter (Instagram style). */
export default function Carousel({ photos, alt, onSelect, start = 0, contain = false }: { photos: string[]; alt: string; onSelect?: (i: number) => void; start?: number; contain?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [i, setI] = useState(start)
  const n = photos.length
  useEffect(() => { const el = ref.current; if (el && start) el.scrollLeft = start * el.clientWidth }, []) // eslint-disable-line
  const go = (k: number) => (e: React.MouseEvent) => { e.stopPropagation(); ref.current?.scrollTo({ left: k * ref.current.clientWidth, behavior: 'smooth' }) }
  return (
    <div className={contain ? 'car contain' : 'car'}>
      <div className="track" ref={ref} tabIndex={0} onScroll={e => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {photos.map((p, k) => <img key={p + k} src={p} alt={`${alt}, photo ${k + 1} of ${n}`} loading={k ? 'lazy' : 'eager'} draggable={false} onClick={() => onSelect?.(k)} />)}
      </div>
      {n > 1 && <>
        <span className="count">{i + 1}/{n}</span>
        <button className="nav prev" aria-label="Previous photo" disabled={i === 0} onClick={go(i - 1)}>‹</button>
        <button className="nav next" aria-label="Next photo" disabled={i === n - 1} onClick={go(i + 1)}>›</button>
        {n <= 10 && <div className="dots" aria-hidden>{photos.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>}
      </>}
    </div>
  )
}
