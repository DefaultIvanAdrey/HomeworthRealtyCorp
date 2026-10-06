import type { Listing } from './types'
const php = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 })
export const money = (n?: number) => (n ? php.format(n) : '')
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const where = (l: Listing) => [l.district, l.municipality].filter(Boolean).join(', ')
const CP1252: Record<string, string> = { '€': '\x80', '‚': '\x82', 'ƒ': '\x83', '„': '\x84', '…': '\x85', '†': '\x86', '‡': '\x87', 'ˆ': '\x88', '‰': '\x89', 'Š': '\x8a', '‹': '\x8b', 'Œ': '\x8c', 'Ž': '\x8e', '‘': '\x91', '’': '\x92', '“': '\x93', '”': '\x94', '•': '\x95', '–': '\x96', '—': '\x97', '˜': '\x98', '™': '\x99', 'š': '\x9a', '›': '\x9b', 'œ': '\x9c', 'ž': '\x9e', 'Ÿ': '\x9f' }
const MOJIBAKE = /[\u00c2-\u00f4][\u0080-\u00bf€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/
/** Repairs UTF-8 text that was decoded as Latin-1 / Windows-1252 (e.g. "•" shown as "â¢"). Clean text is returned unchanged. */
export function fixText(s: string) {
  if (!MOJIBAKE.test(s)) return s
  try { return decodeURIComponent(escape(s.replace(/[€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g, c => CP1252[c]))) } catch { return s }
}
export const cleanListing = (l: Listing): Listing => ({ ...l, title: fixText(l.title), unit: fixText(l.unit), street: fixText(l.street), district: fixText(l.district), municipality: fixText(l.municipality), remarks: fixText(l.remarks), amenities: l.amenities.map(fixText) })
export const collator = new Intl.Collator('en', { sensitivity: 'base' })
export const sortedUnique = (a: string[]) => [...new Set(a.map(x => x.trim()).filter(Boolean))].sort(collator.compare)

/** The highest of sale / monthly rent / lease on the row. Used for the price shown, the price filter and price sorting. */
export type Kind = 'sale' | 'rent' | 'lease'
export function topPrice(l: Listing): { value: number; kind: Kind } | null {
  const c: [number | undefined, Kind][] = [[l.salePrice, 'sale'], [l.monthlyRent, 'rent'], [l.leasePrice, 'lease']]
  const best = c.filter(([v]) => v).sort((a, b) => b[0]! - a[0]!)[0]
  return best ? { value: best[0]!, kind: best[1] } : null
}
export const KIND_LABEL: Record<Kind, string> = { sale: 'For sale', rent: 'Rent / month', lease: 'Lease / month' }
export const recent = (a: Listing, b: Listing) => (b.availableFrom || '').localeCompare(a.availableFrom || '') || (b.pk ?? 0) - (a.pk ?? 0)
