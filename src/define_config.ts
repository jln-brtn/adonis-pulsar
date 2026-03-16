import type { PulsarConfig } from './types/main.js'

export function defineConfig(config: PulsarConfig): PulsarConfig {
  if (!config.serviceUrl) {
    throw new Error(
      'Missing "serviceUrl" in pulsar config. Make sure to define it inside the config/pulsar.ts file'
    )
  }

  if (config.tenant && !config.namespace) {
    throw new Error(
      'Missing "namespace" in pulsar config. "namespace" is required when "tenant" is defined'
    )
  }

  if (config.namespace && !config.tenant) {
    throw new Error(
      'Missing "tenant" in pulsar config. "tenant" is required when "namespace" is defined'
    )
  }

  return config
}
