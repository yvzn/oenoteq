import { localFirstGateway } from './localFirstGateway'
import type { DataGateway } from './types'

// The one place the active adapter is chosen. Always local-first for now;
// ADR 0010 swaps in a direct-to-server adapter here based on Storage Consent.
export const gateway: DataGateway = localFirstGateway

export type { ConsumptionInput, DataGateway } from './types'
