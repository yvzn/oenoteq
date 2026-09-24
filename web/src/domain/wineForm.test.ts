import { describe, expect, it } from 'vitest'
import {
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

  it('requires garde_debut and garde_fin', () => {
    expect(validateWineForm({ ...validFields, gardeDebut: '', gardeFin: '' })).toMatchObject({
      gardeDebut: expect.any(String),
      gardeFin: expect.any(String),
    })
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
})

describe('emptyWineFormFields', () => {
  it('has no appellation or producer selected and every field blank', () => {
    expect(emptyWineFormFields).toEqual({
      millesime: '',
      appellationId: null,
      producerId: null,
      color: '',
      gardeDebut: '',
      gardeFin: '',
      quantity: '',
    })
  })
})
