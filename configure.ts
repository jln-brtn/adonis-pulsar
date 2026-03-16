import Configure from '@adonisjs/core/commands/configure'
import { stubsRoot } from './stubs/index.js'

export async function configure(command: Configure) {
  const codemods = await command.createCodemods()

  await codemods.makeUsingStub(stubsRoot, 'config/pulsar.stub', {})

  await codemods.defineEnvVariables({
    PULSAR_SERVICE_URL: 'pulsar://localhost:6650',
  })

  await codemods.defineEnvValidations({
    variables: {
      PULSAR_SERVICE_URL: "Env.schema.string({ format: 'url', tld: false })",
    },
  })

  await codemods.updateRcFile((rcFile: any) => {
    rcFile.addProvider('adonis-pulsar/pulsar_provider')
    rcFile.addCommand('adonis-pulsar/commands')
  })
}
