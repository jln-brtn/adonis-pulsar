# adonis-pulsar

An [AdonisJS v6](https://adonisjs.com) package for [Apache Pulsar](https://pulsar.apache.org), built on top of the official [`pulsar-client`](https://www.npmjs.com/package/pulsar-client) Node.js library.

It provides:
- A **provider** that manages the Pulsar client lifecycle
- A **`dispatch`** method to publish messages to any topic
- An **abstract `Consumer` class** to handle incoming messages
- An **Ace command** (`pulsar:listen`) to start all consumers
- A **generator** (`make:consumer`) to scaffold new consumers
- A **`configure`** hook for `node ace add adonis-pulsar`

---

## Requirements

| Dependency | Version |
|---|---|
| Node.js | `>= 20.6.0` |
| AdonisJS | `^6.2.0` |
| pulsar-client | `^1.11.0` |

---

## Installation

```bash
node ace add adonis-pulsar
```

This will:
1. Install the `adonis-pulsar` npm package
2. Create `config/pulsar.ts`
3. Add `PULSAR_SERVICE_URL` to your `.env` and `start/env.ts`
4. Register the provider and commands in `adonisrc.ts`

### Manual installation

```bash
npm install adonis-pulsar
node ace configure adonis-pulsar
```

---

## Configuration

The configuration file is located at `config/pulsar.ts`:

```ts
import env from '#start/env'
import { defineConfig } from 'adonis-pulsar'

const pulsarConfig = defineConfig({
  serviceUrl: env.get('PULSAR_SERVICE_URL'),

  // Optional: extra options forwarded to new Pulsar.Client()
  client: {
    operationTimeoutSeconds: 30,
  },

  // Optional: default producer options applied to every topic
  producer: {
    sendTimeoutMs: 30000,
  },

  // Consumers to start when running `pulsar:listen`
  consumers: [
    () => import('#consumers/order_consumer'),
  ],
})

export default pulsarConfig
```

### Environment variable

```dotenv
PULSAR_SERVICE_URL=pulsar://localhost:6650
```

For TLS connections:

```dotenv
PULSAR_SERVICE_URL=pulsar+ssl://broker.example.com:6651
```

---

## Creating a consumer

```bash
node ace make:consumer Order
```

This generates `app/consumers/order_consumer.ts`:

```ts
import type Pulsar from 'pulsar-client'
import { Consumer } from 'adonis-pulsar'

export default class OrderConsumer extends Consumer {
  static topic = 'persistent://public/default/order'
  static subscription = 'order-subscription'

  async handle(message: Pulsar.Message, consumer: Pulsar.Consumer): Promise<void> {
    const data = message.getData().toString()
    console.log('Received message:', data)
    consumer.acknowledge(message)
  }
}
```

Then register it in `config/pulsar.ts`:

```ts
consumers: [
  () => import('#consumers/order_consumer'),
],
```

### Consumer options

| Static property | Type | Default | Description |
|---|---|---|---|
| `topic` | `string` | — | **Required.** Full Pulsar topic URL |
| `subscription` | `string` | — | **Required.** Subscription name |
| `subscriptionType` | `SubscriptionType` | `'Shared'` | `Exclusive`, `Shared`, `Failover`, or `KeyShared` |
| `maxRedeliverCount` | `number` | `0` | Max delivery attempts before `rescue()` is called. `0` disables the dead-letter policy. |

### Handling errors

Override `onError` to customise the error behaviour. The default implementation calls `negativeAcknowledge` and re-throws:

```ts
async onError(
  message: Pulsar.Message,
  consumer: Pulsar.Consumer,
  error: Error
): Promise<void> {
  console.error('Failed to process message', error)
  consumer.negativeAcknowledge(message)
}
```

### Rescuing failed messages

When `maxRedeliverCount` is set, the package automatically configures Pulsar's **Dead Letter Policy** on the subscription. Once a message has been redelivered `maxRedeliverCount` times and still fails, the `rescue()` method is called instead of `onError()`, and the message is then routed to the dead-letter topic (`<topic>-<subscription>-DLQ`).

Override `rescue()` to perform cleanup, alerting, or manual persistence before the message is discarded:

```ts
import type Pulsar from 'pulsar-client'
import { Consumer } from 'adonis-pulsar'

export default class OrderConsumer extends Consumer {
  static topic = 'persistent://public/default/order'
  static subscription = 'order-subscription'
  static maxRedeliverCount = 3  // rescue() fires on the 4th failure

  async handle(message: Pulsar.Message, consumer: Pulsar.Consumer): Promise<void> {
    const order = JSON.parse(message.getData().toString())
    await processOrder(order)
    consumer.acknowledge(message)
  }

  async rescue(
    message: Pulsar.Message,
    consumer: Pulsar.Consumer,
    error: Error
  ): Promise<void> {
    const data = message.getData().toString()
    // Log to an external system, send an alert, store in a fallback DB…
    console.error(`Message permanently failed after ${OrderConsumer.maxRedeliverCount} retries`, {
      data,
      error: error.message,
      redeliveryCount: message.getRedeliveryCount(),
    })
  }
}
```

> **Note:** `rescue()` does not need to call `acknowledge` — the package does it automatically after `rescue()` resolves, so the broker can forward the message to the dead-letter topic. If `rescue()` itself throws, the error is logged and the message is still acknowledged to prevent an infinite loop.

---

## Starting the listener

```bash
node ace pulsar:listen
```

The command connects to Pulsar, subscribes all registered consumers, and keeps the process alive. Each consumer runs its own independent receive loop — a crash in one loop is logged and does not affect the others.

---

## Publishing messages

### Using the service singleton

```ts
import pulsar from 'adonis-pulsar/services/main'

// String payload
await pulsar.dispatch('persistent://public/default/order', JSON.stringify({ id: 1 }))

// Buffer payload
await pulsar.dispatch('persistent://public/default/order', Buffer.from('hello'))
```

### Using the container directly

```ts
const pulsar = await app.container.make('adonis-pulsar/manager')
await pulsar.dispatch('persistent://public/default/order', 'hello')
```

### Dispatch options

```ts
await pulsar.dispatch('persistent://public/default/order', payload, {
  // Custom message properties (key/value string map)
  properties: {
    correlationId: '123',
    source: 'api',
  },

  // Delay delivery by N milliseconds from now
  deliverAfter: 5000,

  // Deliver at a specific Unix timestamp (ms)
  deliverAt: Date.now() + 60_000,

  // Route to a specific partition
  partitionKey: 'tenant-42',
})
```

`dispatch` returns a `Pulsar.MessageId` that can be used for deduplication or tracing.

---

## Registering consumers programmatically

Outside of the config file, you can register consumers directly on the manager — useful in tests or conditional scenarios:

```ts
const pulsar = await app.container.make('adonis-pulsar/manager')
pulsar.register(OrderConsumer, PaymentConsumer)
await pulsar.listen()
```

---

## TypeScript

The package ships full type declarations. The manager is registered in the AdonisJS IoC container with its proper type:

```ts
// src/types/extended.ts augments ContainerBindings
import type { PulsarManager } from 'adonis-pulsar'

// Fully typed — no cast needed
const manager = await app.container.make('adonis-pulsar/manager')
await manager.dispatch(...)
```

---

## Package exports

| Export path | Description |
|---|---|
| `adonis-pulsar` | `defineConfig`, `Consumer`, `configure`, `stubsRoot` |
| `adonis-pulsar/types` | `PulsarConfig`, `ConsumerConstructor`, `DispatchOptions` |
| `adonis-pulsar/pulsar_provider` | AdonisJS service provider |
| `adonis-pulsar/commands` | `MakeConsumer`, `PulsarListen` |
| `adonis-pulsar/services/main` | Pre-resolved `PulsarManager` singleton |

---

## License

[MIT](LICENSE)
