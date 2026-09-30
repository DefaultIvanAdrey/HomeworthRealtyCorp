import type { Listing } from './types'
const php = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 })
export const money = (n?: number) => (n ? php.format(n) : '')
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const where = (l: Listing) => [l.district, l.municipality].filter(Boolean).join(', ')
export const headline = (l: Listing) => (l.salePrice ? money(l.salePrice) : l.monthlyRent ? money(l.monthlyRent) + ' / month' : 'Price on request')
