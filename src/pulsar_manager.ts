import Pulsar from 'pulsar-client'
import type { ApplicationService, LoggerService } from '@adonisjs/core/types'
import type { ConsumerConstructor, DispatchOptions, PulsarConfig } from './types/main.js'

export class PulsarManager {
  #client: Pulsar.Client
  #producers: Map<string, Pulsar.Producer> = new Map()
  #consumers: ConsumerConstructor[] = []
  #pulsarConsumers: Pulsar.Consumer[] = []
  #running: boolean = false

  constructor(
    private config: PulsarConfig,
    private logger: LoggerService,
    private app: ApplicationService
  ) {
    this.#client = new Pulsar.Client({
      serviceUrl: config.serviceUrl,
      ...(config.token && { authentication: new Pulsar.AuthenticationToken({ token: config.token }) }),
      ...config.client,
    })
  }

  #buildTopic(topic: string, tenant?: string, namespace?: string): string {
    const effectiveTenant = tenant ?? this.config.tenant
    const effectiveNamespace = namespace ?? this.config.namespace
    if (effectiveTenant && effectiveNamespace && !topic.includes('://')) {
      return `persistent://${effectiveTenant}/${effectiveNamespace}/${topic}`
    }
    return topic
  }

  async #getOrCreateProducer(topic: string): Promise<Pulsar.Producer> {
    let producer = this.#producers.get(topic)
    if (!producer) {
      producer = await this.#client.createProducer({
        topic: this.#buildTopic(topic),
        ...this.config.producer,
      })
      this.#producers.set(topic, producer)
    }
    return producer
  }

  async dispatch(topic: string, data: Buffer | string, options?: DispatchOptions): Promise<Pulsar.MessageId> {
    const producer = await this.#getOrCreateProducer(topic)
    const payload = typeof data === 'string' ? Buffer.from(data) : data

    const message: Pulsar.ProducerMessage = { data: payload }
    if (options?.properties) message.properties = options.properties
    if (options?.deliverAfter !== undefined) message.deliverAfter = options.deliverAfter
    if (options?.deliverAt !== undefined) message.deliverAt = options.deliverAt
    if (options?.partitionKey) message.partitionKey = options.partitionKey

    return producer.send(message)
  }

  register(...ConsumerClasses: ConsumerConstructor[]): void {
    this.#consumers.push(...ConsumerClasses)
  }

  async registerFromConfig(): Promise<void> {
    if (!this.config.consumers?.length) return

    for (const importer of this.config.consumers) {
      const mod = await importer()
      this.#consumers.push(mod.default)
    }
  }

  async listen(): Promise<void> {
    this.#running = true
    this.logger.info('Starting Pulsar consumers...')

    for (const ConsumerClass of this.#consumers) {
      const maxRedeliverCount = ConsumerClass.maxRedeliverCount ?? 0
      const resolvedTopic = this.#buildTopic(
        ConsumerClass.topic,
        ConsumerClass.tenant,
        ConsumerClass.namespace
      )
      const deadLetterTopic = `${resolvedTopic}-${ConsumerClass.subscription}-DLQ`

      const pulsarConsumer = await this.#client.subscribe({
        topic: resolvedTopic,
        subscription: ConsumerClass.subscription,
        subscriptionType: ConsumerClass.subscriptionType ?? 'Shared',
        ...(maxRedeliverCount > 0 && {
          deadLetterPolicy: {
            maxRedeliverCount,
            deadLetterTopic,
          },
        }),
      })
      this.#pulsarConsumers.push(pulsarConsumer)
      this.logger.info(`Listening on topic "${resolvedTopic}" (${ConsumerClass.subscription})`)
      this.#runReceiveLoop(ConsumerClass, pulsarConsumer).catch((error) => {
        this.logger.error(error, `Receive loop crashed for topic "${ConsumerClass.topic}"`)
      })
    }
  }

  async #runReceiveLoop(
    ConsumerClass: ConsumerConstructor,
    pulsarConsumer: Pulsar.Consumer
  ): Promise<void> {
    const maxRedeliverCount = ConsumerClass.maxRedeliverCount ?? 0

    while (this.#running) {
      let message: Pulsar.Message
      try {
        message = await pulsarConsumer.receive()
      } catch {
        if (!this.#running) break
        throw new Error(`Failed to receive message from topic "${ConsumerClass.topic}"`)
      }

      const instance = await this.app.container.make(ConsumerClass)
      try {
        await instance.handle(message, pulsarConsumer)
      } catch (error) {
        const isExhausted = maxRedeliverCount > 0 && message.getRedeliveryCount() >= maxRedeliverCount
        if (isExhausted) {
          try {
            await instance.rescue(message, pulsarConsumer, error)
          } catch (rescueErr) {
            this.logger.error(rescueErr, `rescue() failed for topic "${ConsumerClass.topic}"`)
          }
          // Acknowledge so Pulsar routes the message to the dead-letter topic
          pulsarConsumer.acknowledge(message)
        } else {
          try {
            await instance.onError(message, pulsarConsumer, error)
          } catch (onErrorErr) {
            this.logger.error(onErrorErr, `Error handler failed for topic "${ConsumerClass.topic}"`)
          }
        }
      }
    }
  }

  async closeAll(): Promise<void> {
    this.#running = false

    for (const producer of this.#producers.values()) {
      await producer.close()
    }
    this.#producers.clear()

    for (const consumer of this.#pulsarConsumers) {
      await consumer.close()
    }
    this.#pulsarConsumers = []

    await this.#client.close()
    this.logger.info('Pulsar client closed')
  }
}
