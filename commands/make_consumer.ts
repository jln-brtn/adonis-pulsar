import { args, BaseCommand } from '@adonisjs/core/ace'
import { stubsRoot } from '../stubs/index.js'

export default class MakeConsumer extends BaseCommand {
  static commandName = 'make:consumer'
  static description = 'Make a new Pulsar consumer class'

  @args.string({ description: 'Name of the consumer' })
  declare name: string

  async run() {
    const codemods = await this.createCodemods()
    await codemods.makeUsingStub(stubsRoot, 'make/consumer.stub', {
      entity: this.app.generators.createEntity(this.name),
    })
  }
}
