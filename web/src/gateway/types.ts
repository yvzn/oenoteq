import type {
  Appellation,
  Color,
  Meal,
  Producer,
  WineCreateInput,
  WineDetail,
  WineInput,
  WineSearchResult,
} from '../api/types'
import type { SearchFilters } from '../domain/searchFilters'
import type { WineSort } from '../domain/wineSort'

export interface ConsumptionInput {
  date: string
  rating: number | null
  notes: string | null
}

// Every operation rejects with the underlying error (usually an ApiError);
// composables turn it into a friendly message. Adapters may legitimately
// differ in what happens around the call (outbox, local ids, pending state) —
// never in what these signatures promise.
export interface NamedEntityGateway<T extends { id: number; name: string }> {
  // Name-sorted. Rejects only when nothing at all can be shown.
  list(): Promise<T[]>
  create(name: string): Promise<T>
  update(id: number, name: string): Promise<T>
  remove(id: number): Promise<void>
}

export interface GetWineResult {
  wine: WineDetail | null
  // The id the wine actually ended up loaded under — a local id whose create
  // has since synced resolves to the real one. Reported even on failure.
  resolvedId: number
  // Set when the wine could not be shown at all (no copy to fall back on).
  error?: unknown
}

export interface WineGateway {
  // `onCached` fires early with an already-available copy while a fresher one
  // is still being fetched.
  get(id: number, onCached?: (wine: WineDetail) => void): Promise<GetWineResult>
  create(input: WineCreateInput): Promise<WineDetail>
  update(id: number, input: WineInput): Promise<WineDetail>
  adjustQuantity(id: number, delta: number): Promise<WineDetail>
  recordConsumption(wineId: number, input: ConsumptionInput): Promise<WineDetail>
  updateConsumption(wineId: number, consumptionId: number, input: ConsumptionInput): Promise<WineDetail>
  // Resolves to the refreshed wine, or null when it could not be refreshed
  // (the delete itself still succeeded).
  deleteConsumption(wineId: number, consumptionId: number): Promise<WineDetail | null>
}

export interface MealPairingGateway {
  list(appellationId: number, color: Color): Promise<Meal[]>
  // Resolves to the paired meal when it is known, for immediate display.
  add(appellationId: number, color: Color, mealId: number): Promise<Meal | undefined>
  remove(appellationId: number, color: Color, mealId: number): Promise<void>
}

export interface DataGateway {
  wines: WineGateway
  producers: NamedEntityGateway<Producer>
  appellations: NamedEntityGateway<Appellation>
  meals: NamedEntityGateway<Meal>
  mealPairings: MealPairingGateway
  // The whole filtered, sorted cellar (not paged).
  search(filters: SearchFilters, sort: WineSort): Promise<WineSearchResult[]>
  // Like `search`, but keeps `onResult` current for as long as the caller
  // stays subscribed: adapters that can tell the cellar changed (the local
  // store) call it again, others call it once. `onError` fires when no result
  // can be produced. Returns the unsubscribe function.
  watchSearch(
    filters: SearchFilters,
    sort: WineSort,
    onResult: (results: WineSearchResult[]) => void,
    onError: (error: unknown) => void,
  ): () => void
}
