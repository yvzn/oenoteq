export type Color = 'rouge' | 'blanc' | 'rose'
export type GardeStatus = 'too_young' | 'ready' | 'past_peak'

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

export interface WineSearchResult extends Wine {
  garde_status: GardeStatus
}

export interface Appellation {
  id: number
  name: string
}

export interface Meal {
  id: number
  name: string
}

export interface Consumption {
  id: number
  wine_id: number
  date: string
  rating: number | null
  notes: string | null
}

export interface WineDetail extends Wine {
  suggested_meals: Meal[]
  consumption_history: Consumption[]
}
