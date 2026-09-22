import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient, ApiError } from './client'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiClient.get', () => {
  it('resolves with the parsed JSON body on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, [{ id: 1, name: 'Chinon' }])),
    )

    const result = await apiClient.get('/appellations')

    expect(result).toEqual([{ id: 1, name: 'Chinon' }])
  })

  it('throws an ApiError with the status and message from the error body on non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(404, { error: 'wine not found' })),
    )

    await expect(apiClient.get('/wines/999')).rejects.toMatchObject({
      status: 404,
      message: 'wine not found',
    })
  })

  it('throws an ApiError with a fallback message when the error body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('not json', { status: 500 }),
      ),
    )

    await expect(apiClient.get('/wines')).rejects.toMatchObject({
      status: 500,
      message: 'Request failed with status 500',
    })
  })

  it('throws an ApiError with status 0 when fetch rejects (network failure)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')))

    await expect(apiClient.get('/wines')).rejects.toMatchObject({
      status: 0,
    })
    await expect(apiClient.get('/wines')).rejects.toBeInstanceOf(ApiError)
  })
})

describe('apiClient.post', () => {
  it('sends a JSON body and resolves with the parsed response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { id: 1, name: 'Chinon' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiClient.post('/appellations', { name: 'Chinon' })

    expect(result).toEqual({ id: 1, name: 'Chinon' })
    const [path, init] = fetchMock.mock.calls[0]
    expect(path).toBe('/appellations')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ name: 'Chinon' }))
  })
})
