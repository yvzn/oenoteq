import type { Wine } from '../api/types'

export type GardeStatus = 'too_young' | 'ready' | 'past_peak'

export function computeGardeStatus(
  wine: Pick<Wine, 'garde_debut' | 'garde_fin'>,
  currentYear: number = new Date().getFullYear(),
): GardeStatus {
  if (currentYear < wine.garde_debut) return 'too_young'
  if (currentYear > wine.garde_fin) return 'past_peak'
  return 'ready'
}
