import type { Listing } from './types'
const php = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 })
export const money = (n?: number) => (n ? php.format(n) : '')
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const where = (l: Listing) => [l.district, l.municipality].filter(Boolean).join(', ')
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
