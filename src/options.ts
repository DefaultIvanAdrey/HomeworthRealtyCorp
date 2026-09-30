// Same lists as the dropdowns in the Google Sheet.
export const CATEGORY = ['House and Lot', 'House Only', 'Lot Only', 'Condominium', 'Penthouse', 'Apartment', 'Commercial', 'Co-op']
export const SUBTYPE = ['Studio', '1 Bedroom', '2 Bedroom', '3 Bedroom', '4 Bedroom', '5 Bedroom', 'Single-Family Detached', 'Duplex', 'Triplex', 'Fourplex/Quadplex', 'Multi-Family (5+ Units)', 'Manufactured/Mobile', 'Other']
export const AVAILABILITY = ['For Rent Only', 'For Sale Only', 'For Lease Only', 'For Rent & For Sale', 'For Lease & For Sale', 'For Lease / Sale / Rent']
export const CONDITION = ['Bare', 'Unfurnished', 'Semi-Furnished', 'Furnished', 'Fully Furnished']
// Public filter choices
export const F_AVAILABILITY = ['Rent', 'Sale', 'Lease']
export const F_CATEGORY = ['House and Lot', 'House Only', 'Lot Only', 'Studio', '1 Bedroom', '2 Bedroom', '3 Bedroom', '4 Bedroom', '5 Bedroom', 'Commercial']
export const SORTS = [['recent', 'Most Recent'], ['high', 'Price: High to Low'], ['low', 'Price: Low to High']] as const
