import { describe, expect, it } from 'vitest'
import {
  deriveGardeFin,
  emptyWineFormFields,
  toWineInput,
  validateWineForm,
  wineToFormFields,
  type WineFormFields,
} from './wineForm'

const validFields: WineFormFields = {
  millesime: '2018',
  appellationId: 1,
  producerId: 2,
  color: 'rouge',
  gardeDebut: '2020',
  gardeFin: '2028',
  quantity: '6',
}

describe('validateWineForm', () => {
  it('returns no errors for a fully valid form', () => {
    expect(validateWineForm(validFields)).toEqual({})
  })

  it('allows an empty millesime (optional)', () => {
    expect(validateWineForm({ ...validFields, millesime: '' })).toEqual({})
  })

  it('requires an appellation', () => {
    expect(validateWineForm({ ...validFields, appellationId: null })).toMatchObject({
      appellationId: expect.any(String),
    })
  })

  it('requires a producer', () => {
    expect(validateWineForm({ ...validFields, producerId: null })).toMatchObject({
      producerId: expect.any(String),
    })
  })

  it('requires a color', () => {
    expect(validateWineForm({ ...validFields, color: '' })).toMatchObject({
      color: expect.any(String),
    })
  })

  it('allows garde_debut and garde_fin to both be empty (optional)', () => {
    expect(validateWineForm({ ...validFields, gardeDebut: '', gardeFin: '' })).toEqual({})
  })

  it('allows only garde_debut to be set', () => {
    expect(validateWineForm({ ...validFields, gardeFin: '' })).toEqual({})
  })

  it('allows only garde_fin to be set', () => {
    expect(validateWineForm({ ...validFields, gardeDebut: '' })).toEqual({})
  })

  it('rejects garde_debut greater than garde_fin', () => {
    expect(
      validateWineForm({ ...validFields, gardeDebut: '2028', gardeFin: '2020' }),
    ).toMatchObject({
      gardeFin: expect.any(String),
    })
  })

  it('allows garde_debut equal to garde_fin', () => {
    expect(validateWineForm({ ...validFields, gardeDebut: '2020', gardeFin: '2020' })).toEqual({})
  })

  it('requires a quantity', () => {
    expect(validateWineForm({ ...validFields, quantity: '' })).toMatchObject({
      quantity: expect.any(String),
    })
  })

  it('rejects a negative quantity', () => {
    expect(validateWineForm({ ...validFields, quantity: '-1' })).toMatchObject({
      quantity: expect.any(String),
    })
  })

  it('allows a zero quantity', () => {
    expect(validateWineForm({ ...validFields, quantity: '0' })).toEqual({})
  })
})

describe('toWineInput', () => {
  it('converts valid form fields into the API payload shape', () => {
    expect(toWineInput(validFields)).toEqual({
      millesime: 2018,
      appellation_id: 1,
      producer_id: 2,
      color: 'rouge',
      garde_debut: 2020,
      garde_fin: 2028,
      quantity: 6,
    })
  })

  it('converts an empty millesime to null', () => {
    expect(toWineInput({ ...validFields, millesime: '' }).millesime).toBeNull()
  })

  it('converts empty garde_debut/garde_fin to null', () => {
    const input = toWineInput({ ...validFields, gardeDebut: '', gardeFin: '' })
    expect(input.garde_debut).toBeNull()
    expect(input.garde_fin).toBeNull()
  })
})

describe('wineToFormFields', () => {
  it('converts an API wine into string form fields', () => {
    expect(
      wineToFormFields({
        millesime: 2018,
        appellation_id: 1,
        producer_id: 2,
        color: 'rouge',
        garde_debut: 2020,
        garde_fin: 2028,
        quantity: 6,
      }),
    ).toEqual(validFields)
  })

  it('converts a null millesime to an empty string', () => {
    expect(
      wineToFormFields({
        millesime: null,
        appellation_id: 1,
        producer_id: 2,
        color: 'rouge',
        garde_debut: 2020,
        garde_fin: 2028,
        quantity: 6,
      }).millesime,
    ).toBe('')
  })

  it('converts null garde_debut/garde_fin to empty strings', () => {
    const fields = wineToFormFields({
      millesime: 2018,
      appellation_id: 1,
      producer_id: 2,
      color: 'rouge',
      garde_debut: null,
      garde_fin: null,
      quantity: 6,
    })
    expect(fields.gardeDebut).toBe('')
    expect(fields.gardeFin).toBe('')
  })
})

describe('emptyWineFormFields', () => {
  it('has no appellation or producer selected, blank garde, and quantity defaulted to 1', () => {
    expect(emptyWineFormFields).toEqual({
      millesime: '',
      appellationId: null,
      producerId: null,
      color: '',
      gardeDebut: '',
      gardeFin: '',
      quantity: '1',
    })
  })
})

describe('deriveGardeFin', () => {
  it('copies garde_debut into garde_fin when garde_fin is empty', () => {
    expect(deriveGardeFin('2020', '')).toBe('2020')
  })

  it('leaves garde_fin untouched when it already has a value', () => {
    expect(deriveGardeFin('2020', '2028')).toBe('2028')
  })

  it('leaves garde_fin empty when garde_debut is empty', () => {
    expect(deriveGardeFin('', '')).toBe('')
  })
})
