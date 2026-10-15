import type { Color, Wine, WineCreateInput, WineInput } from '../api/types'
import { messageRef, type MessageRef } from '../i18n/messageRef'

export interface WineFormFields {
  millesime: string
  appellationId: number | null
  producerId: number | null
  color: Color | ''
  gardeDebut: string
  gardeFin: string
  quantity: string
}

export const emptyWineFormFields: WineFormFields = {
  millesime: '',
  appellationId: null,
  producerId: null,
  color: '',
  gardeDebut: '',
  gardeFin: '',
  quantity: '1',
}

export type WineFormErrors = Partial<Record<keyof WineFormFields, MessageRef>>

export function validateWineForm(fields: WineFormFields): WineFormErrors {
  const errors: WineFormErrors = {}

  if (fields.appellationId === null) errors.appellationId = messageRef('wine.form.errors.appellationRequired')
  if (fields.producerId === null) errors.producerId = messageRef('wine.form.errors.producerRequired')
  if (fields.color === '') errors.color = messageRef('wine.form.errors.colorRequired')

  const gardeDebut = parseNumber(fields.gardeDebut)
  const gardeFin = parseNumber(fields.gardeFin)
  if (gardeDebut !== null && gardeFin !== null && gardeDebut > gardeFin) {
    errors.gardeFin = messageRef('wine.form.errors.gardeEndBeforeStart')
  }

  return errors
}

// Only relevant on create (ADR-0007): editing a Wine never touches quantity.
export function validateInitialQuantity(quantity: string): MessageRef | undefined {
  const n = parseNumber(quantity)
  if (n === null || n < 1) return messageRef('wine.form.errors.quantityMin', { min: 1 })
  return undefined
}

export function toWineInput(fields: WineFormFields): WineInput {
  return {
    millesime: parseNumber(fields.millesime),
    appellation_id: fields.appellationId as number,
    producer_id: fields.producerId as number,
    color: fields.color as Color,
    garde_debut: parseNumber(fields.gardeDebut),
    garde_fin: parseNumber(fields.gardeFin),
  }
}

export function toWineCreateInput(fields: WineFormFields): WineCreateInput {
  return {
    ...toWineInput(fields),
    initial_quantity: parseNumber(fields.quantity) as number,
  }
}

export function wineToFormFields(wine: Wine): WineFormFields {
  return {
    millesime: wine.millesime === null ? '' : String(wine.millesime),
    appellationId: wine.appellation_id,
    producerId: wine.producer_id,
    color: wine.color,
    gardeDebut: wine.garde_debut === null ? '' : String(wine.garde_debut),
    gardeFin: wine.garde_fin === null ? '' : String(wine.garde_fin),
    quantity: emptyWineFormFields.quantity,
  }
}

export function deriveGardeFin(gardeDebut: string, gardeFin: string): string {
  return gardeFin === '' ? gardeDebut : gardeFin
}

function parseNumber(value: string): number | null {
  // native number inputs cast v-model to a JS number at runtime despite the string type
  const trimmed = String(value).trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}
