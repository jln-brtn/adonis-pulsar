import type { ApplicationService } from '@adonisjs/core/types'
import { PulsarManager } from '../src/pulsar_manager.js'
import type { PulsarConfig } from '../src/types/main.js'

export default class PulsarProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('adonis-pulsar/manager', async () => {
      const config = this.app.config.get<PulsarConfig>('pulsar')
      const logger = await this.app.container.make('logger')
      return new PulsarManager(config, logger, this.app)
    })
  }

  async boot() {
    const manager = await this.app.container.make('adonis-pulsar/manager')
    await manager.registerFromConfig()
  }

  async ready() {
    const config = this.app.config.get<PulsarConfig>('pulsar')
    if (config.autoListen === false) return
    const manager = await this.app.container.make('adonis-pulsar/manager')
    manager.listen().catch(async (error) => {
      const logger = await this.app.container.make('logger')
      logger.error(error, 'Pulsar auto-listen failed')
    })
  }

  async shutdown() {
    const manager = await this.app.container.make('adonis-pulsar/manager')
    await manager.closeAll()
  }
}
