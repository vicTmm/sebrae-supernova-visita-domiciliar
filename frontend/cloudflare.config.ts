import { bindings, defineConfig } from 'cf/config'

const apiOrigin = process.env.API_ORIGIN?.trim() ?? ''
if (apiOrigin) {
  const url = new URL(apiOrigin)
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('API_ORIGIN deve ser uma origem HTTPS sem caminho, credenciais ou query string.')
  }
}

export default defineConfig({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '79713c6296c1f11ea71c1efce251bfed',
  worker: {
    name: 'sebrae-supernova-visita-domiciliar',
    compatibilityDate: '2026-11-17',
    entrypoint: './worker/index.ts',
    workersDev: true,
    previewUrls: true,
    assets: {
      notFoundHandling: 'single-page-application',
      runWorkerFirst: ['/visits', '/visits/*', '/feedback', '/health'],
    },
    env: { API_ORIGIN: bindings.text(apiOrigin) },
    observability: {
      enabled: true,
      redactQueryString: true,
      logs: { enabled: true, invocationLogs: true, headSamplingRate: 1 },
      traces: { enabled: true, headSamplingRate: 0.01 },
    },
  },
})
