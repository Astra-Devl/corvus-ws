export interface BusinessHoursEntry {
  day: string
  mode: string | undefined
  /** Menit sejak 00:00. */
  openTime: number | undefined
  closeTime: number | undefined
}

export interface BusinessProfile {
  jid: string
  address: string | undefined
  description: string | undefined
  email: string | undefined
  websites: string[]
  /** Id kategori + nama (bila ada). */
  categories: Array<{ id: string; name: string | undefined }>
  hours: { timezone: string | undefined; config: BusinessHoursEntry[] } | undefined
}

export interface BusinessProfileUpdate {
  address?: string
  email?: string
  description?: string
  websites?: string[]
  /** Id kategori. */
  categories?: string[]
}

export interface ProductImage {
  requestUrl: string | undefined
  originalUrl: string | undefined
}

export interface Product {
  id: string
  name: string | undefined
  description: string | undefined
  /** Harga dalam satuan terkecil mata uang (string asli dari server). */
  price: string | undefined
  currency: string | undefined
  url: string | undefined
  retailerId: string | undefined
  isHidden: boolean
  availability: string | undefined
  image: ProductImage | undefined
}

export interface Catalog {
  products: Product[]
  /** Kursor halaman berikutnya; `undefined` bila habis. */
  nextCursor: string | undefined
}

export interface Collection {
  id: string
  name: string | undefined
  products: Product[]
}

export interface CatalogQueryOptions {
  limit?: number
  cursor?: string
  imageWidth?: number
  imageHeight?: number
}
