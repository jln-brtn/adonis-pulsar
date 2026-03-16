# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build
npm run compile        # Full build: clean → tsc → copy stubs
npm run build          # TypeScript compilation only
npm run clean          # Remove build directory
npm run copy:stubs     # Copy .stub files to build/

# Type checking
npm run typecheck      # tsc --noEmit

# Publish (runs compile automatically)
npm publish            # triggers prepublishOnly → compile
```

There are no test or lint scripts defined. The project uses `@adonisjs/eslint-config` and `@adonisjs/prettier-config` as dev dependencies.

## Architecture

**adonis-pulsar** is an AdonisJS v6 provider package wrapping the `pulsar-client` library for Apache Pulsar messaging.

### Core Components

- **`src/pulsar_manager.ts`** — Central class managing the Pulsar client, a producer cache (Map keyed by topic), registered consumers, and independent receive loops. All message dispatching and consumption goes through here.
- **`src/consumer.ts`** — Abstract base class for user-defined consumers. Subclasses define `topic`, `subscription` (static), and implement `handle()`. Optional hooks: `onError()` and `rescue()` (triggered when `maxRedeliverCount` is exceeded).
- **`providers/pulsar_provider.ts`** — AdonisJS service provider. `register()` binds `PulsarManager` as a singleton under `'adonis-pulsar/manager'`. `boot()` loads consumers from config. `shutdown()` closes the Pulsar client.
- **`services/main.ts`** — Pre-resolved singleton export; app code imports via `import pulsar from 'adonis-pulsar/services/main'`.
- **`commands/pulsar_listen.ts`** — Ace command that calls `manager.listen()` to start all consumer receive loops.
- **`commands/make_consumer.ts`** — Ace generator that scaffolds a new consumer from `stubs/make/consumer.stub`.
- **`configure.ts`** — Installation hook run by `node ace add adonis-pulsar`; creates `config/pulsar.ts`, registers provider/commands in `adonisrc.ts`, and adds `PULSAR_SERVICE_URL` env var.

### Message Flow

**Publishing:**
```
pulsar.dispatch(topic, data, options)
  → PulsarManager gets/creates cached Producer for topic
  → Sends ProducerMessage, returns MessageId
```

**Consuming:**
```
pulsar:listen
  → PulsarManager.listen()
  → Subscribes each registered Consumer, starts independent async loop per consumer
  → Per message: instantiate Consumer via AdonisJS container → handle()
  → On error: onError() or rescue() (if maxRedeliverCount exceeded, then ack to dead-letter)
```

### Package Exports

```
'adonis-pulsar'             → build/index.js (PulsarManager, Consumer, defineConfig)
'adonis-pulsar/types'       → build/src/types/main.js
'adonis-pulsar/pulsar_provider' → build/providers/pulsar_provider.js
'adonis-pulsar/commands'    → build/commands/index.js
'adonis-pulsar/services/main'   → build/services/main.js
```

### Type Augmentation

`src/types/extended.ts` augments `ContainerBindings` with `'adonis-pulsar/manager': PulsarManager`, enabling typed container resolution without casting.
