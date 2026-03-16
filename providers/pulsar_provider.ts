import type { ApplicationService } from '@adonisjs/core/types'
import { PulsarManager } from '../src/pulsar_manager.js'

export default class PulsarProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('adonis-pulsar/manager', async () => {
      const config = this.app.config.get<import('../src/types/main.js').PulsarConfig>('pulsar')
      const logger = await this.app.container.make('logger')
      return new PulsarManager(config, logger, this.app)
    })
  }

  async boot() {
    const manager = await this.app.container.make('adonis-pulsar/manager')
    await manager.registerFromConfig()
  }

  async shutdown() {
    const manager = await this.app.container.make('adonis-pulsar/manager')
    await manager.closeAll()
  }
}
