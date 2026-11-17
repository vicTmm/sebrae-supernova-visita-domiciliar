import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from './index'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('Worker da PWA', () => {
  it('informa a saúde do Worker sem afirmar que existe API conectada', async () => {
    const response = await worker.fetch(new Request('https://app.example/health'), { API_ORIGIN: '' })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'ok', api_configured: false })
  })

  it('não retorna HTML nem confirma gravação quando a API não existe', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    const response = await worker.fetch(new Request('https://app.example/visits/sync', { method: 'POST', body: '{}' }), { API_ORIGIN: '' })
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toMatchObject({ detail: expect.stringContaining('Sincronização ainda não configurada') })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('encaminha o corpo em streaming apenas à origem HTTPS configurada', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"saved":[]}', { headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'private=1' } }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await worker.fetch(new Request('https://app.example/visits/sync?limit=10', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'local=1' }, body: '{"visits":[]}' }), { API_ORIGIN: 'https://api.example' })
    const [target, options] = fetchMock.mock.calls[0]
    expect(target.toString()).toBe('https://api.example/visits/sync?limit=10')
    expect(options.body).toBeInstanceOf(ReadableStream)
    expect(options.headers.get('cookie')).toBeNull()
    expect(options.redirect).toBe('manual')
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ saved: [] })
  })

  it('não segue redirecionamentos que poderiam expor o registro clínico', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 307, headers: { Location: 'https://other.example' } }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await worker.fetch(new Request('https://app.example/visits'), { API_ORIGIN: 'https://api.example' })
    expect(response.status).toBe(502)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('preserva a falha para a fila tentar novamente, sem registrar dados clínicos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Detalhe privado do upstream')))
    const logs = vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await worker.fetch(new Request('https://app.example/visits'), { API_ORIGIN: 'https://api.example' })
    expect(response.status).toBe(502)
    expect(logs).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ event: 'api_unavailable' }))
  })

  it('impede loops e HTTP na origem', async () => {
    for (const origin of ['https://app.example', 'http://api.example']) {
      const response = await worker.fetch(new Request('https://app.example/visits'), { API_ORIGIN: origin })
      expect(response.status).toBe(502)
    }
  })
})
