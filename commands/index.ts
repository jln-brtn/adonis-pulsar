import { readFile } from 'node:fs/promises'

let cache: any[] | undefined

export async function getMetaData(): Promise<any[]> {
  if (cache) return cache
  const raw = await readFile(new URL('./commands.json', import.meta.url), 'utf-8')
  cache = JSON.parse(raw).commands
  return cache!
}

export async function getCommand(metaData: { commandName: string }) {
  const commands = await getMetaData()
  const cmd = commands.find(({ commandName }: any) => metaData.commandName === commandName)
  if (!cmd) return null
  const { default: ctor } = await import(new URL(cmd.filePath, import.meta.url).href)
  return ctor
}
