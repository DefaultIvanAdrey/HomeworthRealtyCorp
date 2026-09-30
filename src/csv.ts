import Papa from 'papaparse'
import { blank, type Listing } from './types'
import { slug } from './format'

export interface ParsedRow { listing: Listing; warnings: string[] }
const num = (s: string) => { const n = parseFloat(s.replace(/[^0-9.]/g, '')); return n > 0 ? n : undefined }
const iso = (s: string) => { const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : '' }
const IMG = /\.(jpe?g|png|webp|avif|gif)(\?|$)/i

/** Reads the Homeworth sheet export. Finds the header row itself, so the summary rows above it are ignored. */
export function parseListingsCsv(text: string): ParsedRow[] {
  const rows = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' }).data
  const h = rows.findIndex(r => r.some(c => c.trim() === 'Category') && r.some(c => c.trim() === 'Description'))
  if (h < 0) throw new Error('No header row found. The file needs columns named "Description" and "Category".')
  const cols = rows[h].map(c => c.trim().toLowerCase())
  return rows.slice(h + 1).flatMap(r => {
    const g = (...names: string[]) => { for (const n of names) { const i = cols.indexOf(n); if (i >= 0 && r[i]?.trim()) return r[i].trim() } return '' }
    const title = g('disctinction / project name', 'distinction / project name', 'project name')
    if (!title) return []
    const urls = g('photos').split(/[\s,]+/).filter(u => u.startsWith('http'))
    const desc = g('description')
    const l: Listing = {
      ...blank(), title,
      id: slug(g('webpage').replace(/\/+$/, '').split('/').pop() || title),
      category: g('category'), availability: g('availability'), condition: g('condition'),
      salePrice: num(g('sale value')), monthlyRent: num(g('monthly rent value')), leasePrice: num(g('lease value')),
      negotiable: /^(true|yes|1)$/i.test(g('negotiable')),
      unit: g('unit/house number & tower'), street: g('street / village / barangay / project'),
      district: g('district / project'), municipality: g('municipality'),
      lotArea: num(g('lot area')), floorArea: num(g('floor area')), bedrooms: num(g('bedroom')),
      bathrooms: num(g('bathroom')), parking: num(g('parking')), storey: num(g('storey')),
      amenities: g('amenities').split(',').map(a => a.trim()).filter(Boolean),
      // the sheet's Description column is an auto-generated summary of the other columns, so only keep hand-written text
      remarks: g('remarks') || (desc.includes('**') ? '' : desc),
      photos: urls.filter(u => IMG.test(u)), photosLink: urls.find(u => !IMG.test(u)) ?? '',
      availableFrom: iso(g('availability date')), updatedAt: new Date().toISOString(),
    }
    const warnings: string[] = []
    if (!l.salePrice && !l.monthlyRent && !l.leasePrice) warnings.push('No price')
    if (!l.municipality) warnings.push('No municipality')
    if (!l.photos.length) warnings.push(l.photosLink ? 'Photos link only (not shown as images)' : 'No photos')
    return [{ listing: l, warnings }]
  })
}

export function mergeListings(current: Listing[], incoming: Listing[]) {
  const map = new Map(current.map(l => [l.id, l])); let added = 0, updated = 0
  for (const l of incoming) { map.has(l.id) ? updated++ : added++; map.set(l.id, { ...map.get(l.id), ...l }) }
  return { list: [...map.values()], added, updated }
}
