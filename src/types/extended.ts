import type { PulsarManager } from '../pulsar_manager.js'

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'adonis-pulsar/manager': PulsarManager
  }
}
