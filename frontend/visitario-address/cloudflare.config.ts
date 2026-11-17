import { bindings, defineConfig } from 'cf/config'

export default defineConfig({
  accountId: '79713c6296c1f11ea71c1efce251bfed',
  worker: {
    name: 'visitario',
    compatibilityDate: '2026-11-17',
    entrypoint: './index.ts',
    workersDev: true,
    previewUrls: false,
    env: {
      APP: bindings.worker({ worker: 'sebrae-supernova-visita-domiciliar' }),
    },
    observability: {
      enabled: true,
      redactQueryString: true,
      logs: { enabled: true, invocationLogs: false },
      traces: { enabled: true, headSamplingRate: 0.01 },
    },
  },
})
