import { BaseCommand } from '@adonisjs/core/ace'

export default class PulsarListen extends BaseCommand {
  static commandName = 'pulsar:listen'
  static description = 'Start the Pulsar consumer listener'
  static options = {
    startApp: true,
    staysAlive: true,
  }

  async run() {
    const manager = await this.app.container.make('adonis-pulsar/manager')
    await manager.listen()
  }
}
