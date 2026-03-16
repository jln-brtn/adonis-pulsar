import { InvalidArgumentsException } from '@poppinss/utils'
import type { PulsarConfig } from './types/main.js'

export function defineConfig(config: PulsarConfig): PulsarConfig {
  if (!config.serviceUrl) {
    throw new InvalidArgumentsException(
      'Missing "serviceUrl" in pulsar config. Make sure to define it inside the config/pulsar.ts file'
    )
  }

  if (config.tenant && !config.namespace) {
    throw new InvalidArgumentsException(
      'Missing "namespace" in pulsar config. "namespace" is required when "tenant" is defined'
    )
  }

  if (config.namespace && !config.tenant) {
    throw new InvalidArgumentsException(
      'Missing "tenant" in pulsar config. "tenant" is required when "namespace" is defined'
    )
  }

  return config
}
