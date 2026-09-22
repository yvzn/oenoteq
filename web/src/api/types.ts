export type Color = 'rouge' | 'blanc' | 'rose'

export interface Wine {
  id: number
  millesime: number | null
  appellation_id: number
  producer: string
  color: Color
  garde_debut: number
  garde_fin: number
  quantity: number
}

export interface Appellation {
  id: number
  name: string
}
