import type { InferEnv } from 'cf/config'
import type config from './cloudflare.config'

type WorkerEnv = InferEnv<typeof config.worker>

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return env.APP.fetch(request)
  },
} satisfies ExportedHandler<WorkerEnv>
