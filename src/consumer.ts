import type Pulsar from 'pulsar-client'

export abstract class Consumer {
  static topic: string
  static subscription: string
  static subscriptionType: Pulsar.SubscriptionType = 'Shared'

  /**
   * Maximum number of times a message will be redelivered before being
   * sent to the dead-letter topic and triggering `rescue()`.
   * Set to 0 to disable the dead-letter policy.
   */
  static maxRedeliverCount: number = 0
  static tenant: string | undefined
  static namespace: string | undefined

  abstract handle(message: Pulsar.Message, consumer: Pulsar.Consumer): Promise<void>

  async onError(
    message: Pulsar.Message,
    consumer: Pulsar.Consumer,
    error: Error
  ): Promise<void> {
    consumer.negativeAcknowledge(message)
    throw error
  }

  /**
   * Called when the message has exceeded `maxRedeliverCount` and is about
   * to be moved to the dead-letter topic. Override this method to perform
   * cleanup, alerting, or manual persistence.
   *
   * The message is acknowledged after this method resolves so that Pulsar
   * can route it to the dead-letter topic normally.
   */
  async rescue(
    _message: Pulsar.Message,
    _consumer: Pulsar.Consumer,
    _error: Error
  ): Promise<void> {}
}
