import type { GardeStatus, Wine } from '../api/types'

export function computeGardeStatus(
  wine: Pick<Wine, 'garde_debut' | 'garde_fin'>,
  currentYear: number = new Date().getFullYear(),
): GardeStatus {
  if (wine.garde_debut === null && wine.garde_fin === null) return 'unassessed'
  if (wine.garde_debut !== null && currentYear < wine.garde_debut) return 'too_young'
  if (wine.garde_fin !== null && currentYear > wine.garde_fin) return 'past_peak'
  return 'ready'
}
