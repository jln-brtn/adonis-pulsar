import { InvalidArgumentsException } from '@poppinss/utils'
import type { PulsarConfig } from './types/main.js'

export function defineConfig(config: PulsarConfig): PulsarConfig {
  if (!config.serviceUrl) {
    throw new InvalidArgumentsException(
      'Missing "serviceUrl" in pulsar config. Make sure to define it inside the config/pulsar.ts file'
    )
  }
  return config
}
