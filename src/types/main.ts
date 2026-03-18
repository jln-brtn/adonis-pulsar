import type Pulsar from 'pulsar-client'
import type { Consumer } from '../consumer.js'

export interface PulsarConfig {
  serviceUrl: string
  token?: string
  tenant?: string
  namespace?: string
  client?: Omit<Pulsar.ClientConfig, 'serviceUrl' | 'authentication'>
  producer?: Omit<Pulsar.ProducerConfig, 'topic'>
  consumers?: (() => Promise<{ default: ConsumerConstructor }>)[]
}

export interface ConsumerConstructor {
  topic: string
  subscription: string
  subscriptionType?: Pulsar.SubscriptionType
  maxRedeliverCount?: number
  tenant?: string
  namespace?: string
  new (): Consumer
}

export interface DispatchOptions {
  properties?: { [key: string]: string }
  deliverAfter?: number
  deliverAt?: number
  partitionKey?: string
}
