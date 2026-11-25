import type { InferEnv } from 'cf/config'
import type config from '../cloudflare.config'

type WorkerEnv = InferEnv<typeof config.worker>
const json = (data: unknown, status = 200) => Response.json(data, {
  status,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
})

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/health') {
      return json({ status: 'ok', service: 'sebrae-supernova-visita-domiciliar', api_configured: Boolean(env.API_ORIGIN) })
    }
    if (url.pathname !== '/feedback' && url.pathname !== '/visits' && !url.pathname.startsWith('/visits/')) return json({ detail: 'Rota não encontrada.' }, 404)
    if (!env.API_ORIGIN) {
      return json({ detail: 'Sincronização ainda não configurada. Os registros continuam neste dispositivo.' }, 503)
    }
    const origin = new URL(env.API_ORIGIN)
    if (origin.protocol !== 'https:' || origin.host === url.host) return json({ detail: 'Origem da API inválida.' }, 502)
    const upstream = new URL(url.pathname + url.search, origin)
    const headers = new Headers(request.headers)
    headers.delete('Host')
    headers.delete('Cookie')
    try {
      const response = await fetch(upstream, {
        method: request.method,
        headers,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
        redirect: 'manual',
        signal: AbortSignal.timeout(20000),
      })
      // Nunca encaminhar dados clínicos para um redirecionamento do upstream.
      if (response.status >= 300 && response.status < 400) return json({ detail: 'A API retornou um redirecionamento inesperado.' }, 502)
      const result = new Response(response.body, response)
      result.headers.set('Cache-Control', 'no-store')
      result.headers.set('X-Content-Type-Options', 'nosniff')
      result.headers.delete('Set-Cookie')
      return result
    } catch {
      // Não registrar corpo, notas, identificação ou detalhes da resposta clínica.
      console.error(JSON.stringify({ event: 'api_unavailable' }))
      return json({ detail: 'API indisponível. Os registros continuam neste dispositivo para nova tentativa.' }, 502)
    }
  },
} satisfies ExportedHandler<WorkerEnv>
