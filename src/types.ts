export interface Listing {
  id: string; pk?: number; title: string; category: string; subtype: string; availability: string; condition: string
  salePrice?: number; monthlyRent?: number; leasePrice?: number; negotiable: boolean
  unit: string; street: string; district: string; municipality: string
  lotArea?: number; floorArea?: number; bedrooms?: number; bathrooms?: number; parking?: number; storey?: number
  amenities: string[]; remarks: string; photos: string[]
  availableFrom: string; latestTransaction: string; published: boolean; updatedAt: string
}
export interface SiteConfig {
  name: string; tagline: string; heroImage: string; logo: string; phone: string; emails?: string[]; contacts?: { email: string; role: string; show: boolean }[]; credit?: { text: string; email: string }; address: string
  objectives: string[]; business: string[]; story: string[]
}
export const blank = (): Listing => ({ id: '', title: '', category: 'Condominium', subtype: '', availability: 'For Sale Only', condition: '', negotiable: false, unit: '', street: '', district: '', municipality: '', amenities: [], remarks: '', photos: [], availableFrom: '', latestTransaction: '', published: true, updatedAt: '' })
