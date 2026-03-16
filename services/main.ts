import app from '@adonisjs/core/services/app'
import { PulsarManager } from '../src/pulsar_manager.js'

let pulsar: PulsarManager

await app.booted(async () => {
  pulsar = await app.container.make('adonis-pulsar/manager')
})

export { pulsar as default }
