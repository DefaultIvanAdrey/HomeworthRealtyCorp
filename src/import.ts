import * as XLSX from 'xlsx'
import { blank, type Listing } from './types'
import { slug, sortedUnique } from './format'

export interface ParsedRow { listing: Listing; warnings: string[] }
const s = (v: unknown) => (v == null ? '' : String(v).trim())
const num = (v: unknown) => { const n = typeof v === 'number' ? v : parseFloat(s(v).replace(/[^0-9.]/g, '')); return n > 0 ? n : undefined }
const iso = (v: unknown) => {
  if (typeof v === 'number' && v > 20000) return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10) // Excel serial → date, no timezone drift
  const t = s(v); const m = t.match(/^(\d{4})-(\d{2})-(\d{2})/) ?? t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  return !m ? '' : m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
}
const IMG = /\.(jpe?g|png|webp|avif|gif)(\?|$)/i

/** Reads the Homeworth workbook (.xlsx) or a CSV export. Finds the header row itself. */
export async function parseListingsFile(file: File): Promise<ParsedRow[]> {
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' })
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '', raw: true })
    const h = rows.findIndex(r => r.some(c => s(c) === 'Property Subtype') && r.some(c => s(c) === 'Category'))
    if (h >= 0) return build(rows, h)
  }
  throw new Error('No listings sheet found. The file needs a header row with "Category" and "Property Subtype".')
}

function build(rows: unknown[][], h: number): ParsedRow[] {
  const cols = rows[h].map(c => s(c).toLowerCase())
  return rows.slice(h + 1).flatMap(r => {
    const raw = (...names: string[]) => { for (const n of names) { const i = cols.indexOf(n); if (i >= 0 && s(r[i]) !== '') return r[i] } return '' }
    const g = (...names: string[]) => s(raw(...names))
    const title = g('disctinction / project name', 'distinction / project name', 'project name')
    if (!title) return []
    const web = g('webpage'); const pk = num(raw('primary key'))
    const urls = g('photos').split(/[\s,]+/).filter(u => u.startsWith('http'))
    const l: Listing = {
      ...blank(), title, pk, id: pk ? String(pk) : slug(title),
      category: g('category'), subtype: g('property subtype'), availability: g('availability'), condition: g('condition'),
      salePrice: num(raw('sale value')), monthlyRent: num(raw('monthly rent value')), leasePrice: num(raw('lease value')),
      negotiable: raw('negotiable') === true || /^true$/i.test(g('negotiable')),
      unit: g('unit/house number & tower'), street: g('street / village / barangay / project'),
      district: g('district / project'), municipality: g('municipality'),
      lotArea: num(raw('lot area')), floorArea: num(raw('floor area')), bedrooms: num(raw('bedroom')),
      bathrooms: num(raw('bathroom')), parking: num(raw('parking')), storey: num(raw('storey')),
      amenities: sortedUnique(g('amenities').split(',')),
      remarks: g('remarks'), photos: urls.filter(u => IMG.test(u)), photosLink: urls.find(u => !IMG.test(u)) ?? '',
      availableFrom: iso(raw('availability date')), latestTransaction: iso(raw('latest transaction')),
      published: !/unlisted|occupied/i.test(web), updatedAt: new Date().toISOString(),
    }
    const warnings: string[] = []
    if (!l.salePrice && !l.monthlyRent && !l.leasePrice) warnings.push('No price')
    if (!l.photos.length) warnings.push(l.photosLink ? 'Album link only, no photos yet' : 'No photos')
    return [{ listing: l, warnings }]
  })
}

/** Existing listings are matched by id, then by name, so re-importing updates instead of duplicating. Photos you added in the admin are kept. */
export function mergeListings(current: Listing[], incoming: Listing[]) {
  const list = [...current]; let added = 0, updated = 0
  for (const n of incoming) {
    const i = list.findIndex(o => o.id === n.id || slug(o.title) === slug(n.title))
    if (i < 0) { list.push(n); added++ } else { const o = list[i]; list[i] = { ...o, ...n, id: o.id, photos: n.photos.length ? n.photos : o.photos, photosLink: n.photosLink || o.photosLink }; updated++ }
  }
  return { list, added, updated }
}
