export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
export type DataFileName = `data.${number}.json`
export type DataFiles = Partial<Record<DataFileName, JsonValue>>

export const TEA_PREFERENCES = ["✅还行", "👍夯", "💥顶夯"] as const
export const TEA_STOCKS = ["无", "一两", "半斤以上"] as const
export type TeaInput = {
  name: string
  brand: string
  preference: typeof TEA_PREFERENCES[number]
  pricePerJin: number | null
  stock: typeof TEA_STOCKS[number]
  cupBrew: { grams300ml: number | null, firstSteepMinutes: number | null }
  gongfuBrew: {
    grams: number | null
    firstSteepSeconds: number | null
    extendEveryCups: number | null
    extendSeconds: number | null
    maxSteeps: number | null
  }
}
export type Tea = TeaInput & { id: string }
export const TEAS_FILE: DataFileName = "data.0.json"

function readPreference(value: unknown): TeaInput["preference"] {
  switch (value) {
    case "不行": case "口粮": return "✅还行"
    case "不错": return "👍夯"
    case "很好": return "💥顶夯"
    default:
      if (TEA_PREFERENCES.includes(value as TeaInput["preference"])) return value as TeaInput["preference"]
      throw new Error("请选择个人喜好")
  }
}

/** Validate persisted values as well as form submissions; do not coerce corrupt data. */
export function validateTea(input: TeaInput): TeaInput {
  if (!input || typeof input.name !== "string" || !input.name.trim()) throw new Error("请输入品名")
  if (typeof input.brand !== "string") throw new Error("品牌格式不正确")
  if (!TEA_PREFERENCES.includes(input.preference)) throw new Error("请选择个人喜好")
  if (!TEA_STOCKS.includes(input.stock)) throw new Error("请选择存量")
  const number = (value: unknown, label: string, integer = false, min = 0) => {
    if (value === null) return
    if (typeof value !== "number" || !Number.isFinite(value) || value < min
      || (integer && !Number.isSafeInteger(value))) {
      throw new Error(`${label}须为${min === 1 ? "正" : "非负"}${integer ? "整数" : "数字"}`)
    }
  }
  if (!input.cupBrew || !input.gongfuBrew) throw new Error("泡茶配置格式不正确")
  number(input.pricePerJin, "斤价", true)
  number(input.cupBrew.grams300ml, "300ml投茶量")
  number(input.cupBrew.firstSteepMinutes, "杯泡首泡")
  number(input.gongfuBrew.grams, "茶碗投茶量")
  number(input.gongfuBrew.firstSteepSeconds, "功夫首泡", true)
  number(input.gongfuBrew.extendEveryCups, "几泡顺延", true, 1)
  number(input.gongfuBrew.extendSeconds, "顺延秒", true)
  number(input.gongfuBrew.maxSteeps, "最大泡数", true, 1)
  return { ...input, name: input.name.trim(), brand: input.brand.trim() }
}

function parseTeas(content?: string): { schemaVersion: 1, teas: Tea[] } {
  if (content === undefined) return { schemaVersion: 1, teas: [] }
  const value = JSON.parse(content)
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.teas)) {
    throw new Error("茶品数据格式不正确，已停止写入")
  }
  const ids = new Set<string>()
  for (const tea of value.teas) {
    if (!tea || typeof tea.id !== "string" || !tea.id || ids.has(tea.id)) {
      throw new Error("茶品编号无效或重复，已停止写入")
    }
    tea.preference = readPreference(tea.preference)
    validateTea(tea)
    ids.add(tea.id)
  }
  return value
}

export interface StorageMeta {
  schemaVersion: 1
  updatedAt: string | null
  lastSyncAt: string | null
  files: DataFileName[]
  brands: string[]
}

/** Minimal adapter for Scripting FileManager; also permits filesystem tests. */
export interface StorageFileSystem {
  exists(path: string): Promise<boolean>
  isDirectory(path: string): Promise<boolean>
  createDirectory(path: string, recursive: boolean): Promise<void>
  readDirectory(path: string): Promise<string[]>
  readAsString(path: string): Promise<string>
  writeAsString(path: string, content: string): Promise<void>
  rename(from: string, to: string): Promise<void>
  remove(path: string): Promise<void>
}

export interface StorageOptions {
  fs: StorageFileSystem
  localDirectory: string
  /** Resolve lazily: iCloud may be disabled at launch and enabled later. */
  backupDirectory: () => string | null
  now?: () => Date
  onError?: (error: unknown) => void
  /** Returns a cancellation function. */
  schedule?: (callback: () => void, delayMs: number) => () => void
}

export type SyncResult = "synced" | "unchanged" | "unavailable" | "stopped"
export const CHECK_INTERVAL_MS = 10 * 60 * 1000
export const SYNC_DEBOUNCE_MS = 500

const validFile = (name: string): name is DataFileName => /^data\.\d+\.json$/.test(name)
const validDate = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value))
const encode = (value: unknown): string => {
  const text = JSON.stringify(value, null, 2)
  if (text === undefined) throw new Error("Cannot store undefined JSON")
  return text + "\n"
}

function parseMeta(text: string): StorageMeta {
  const meta = JSON.parse(text)
  if (!meta || meta.schemaVersion !== 1 || !Array.isArray(meta.files)
    || !meta.files.every((file: unknown) => typeof file === "string" && validFile(file))
    || new Set(meta.files).size !== meta.files.length
    || (meta.brands !== undefined && (!Array.isArray(meta.brands)
      || !meta.brands.every((brand: unknown) => typeof brand === "string")))
    || !(meta.updatedAt === null || validDate(meta.updatedAt))
    || !(meta.lastSyncAt === null || validDate(meta.lastSyncAt))
    || (meta.updatedAt === null && (meta.files.length > 0 || meta.lastSyncAt !== null
      || (meta.brands?.length ?? 0) > 0))
    || (meta.lastSyncAt !== null && Date.parse(meta.lastSyncAt) > Date.parse(meta.updatedAt))) {
    throw new Error("Invalid tea_shelf meta.json; refusing to overwrite existing data")
  }
  // Older local/backup metadata remains readable; persist on the next write.
  return { ...meta, brands: meta.brands ?? [] }
}

function dateLabel(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/** One instance per running script. All local operations are serialized. */
export class TeaShelfStorage {
  private options: StorageOptions
  private localQueue: Promise<unknown> = Promise.resolve()
  private initialized = false
  private started = false
  private cancelPeriodic?: () => void
  private cancelDebounce?: () => void
  private pending?: Promise<SyncResult>
  private resolvePending?: (result: SyncResult) => void
  private active?: Promise<SyncResult>
  private teaSequence = 0

  constructor(options: StorageOptions) {
    this.options = options
  }

  private get fs() { return this.options.fs }
  private get directory() { return this.options.localDirectory }
  private now() { return (this.options.now ?? (() => new Date()))() }
  private report(error: unknown) {
    (this.options.onError ?? console.error)(error)
  }
  private schedule(callback: () => void, delay: number): () => void {
    if (this.options.schedule) return this.options.schedule(callback, delay)
    const timer = setTimeout(callback, delay)
    return () => clearTimeout(timer)
  }
  private local<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.localQueue.then(operation)
    this.localQueue = next.catch(() => {})
    return next
  }

  /** Recover an interrupted directory swap before accessing its contents. */
  private async recover(directory: string): Promise<void> {
    const previous = directory + ".previous"
    if (await this.fs.exists(previous)) {
      if (await this.fs.exists(directory)) await this.fs.remove(previous)
      else await this.fs.rename(previous, directory)
    }
    if (await this.fs.exists(directory + ".pending")) await this.fs.remove(directory + ".pending")
  }

  /** Same-parent rename with rollback; never remove the last complete copy first. */
  private async replace(directory: string, files: Record<string, string>): Promise<void> {
    await this.recover(directory)
    const staging = directory + ".pending"
    const previous = directory + ".previous"
    await this.fs.createDirectory(staging, true)
    for (const [name, content] of Object.entries(files)) {
      await this.fs.writeAsString(`${staging}/${name}`, content)
      if (await this.fs.readAsString(`${staging}/${name}`) !== content) {
        throw new Error(`Storage verification failed: ${name}`)
      }
    }
    const existed = await this.fs.exists(directory)
    if (existed) await this.fs.rename(directory, previous)
    try {
      await this.fs.rename(staging, directory)
    } catch (error) {
      if (existed) await this.fs.rename(previous, directory)
      throw error
    }
    if (existed) await this.fs.remove(previous)
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return
    await this.recover(this.directory)
    if (!await this.fs.exists(this.directory)) {
      // No automatic backup of a freshly initialized empty dataset.
      await this.replace(this.directory, {
        "meta.json": encode({ schemaVersion: 1, updatedAt: null, lastSyncAt: null, files: [], brands: [] }),
      })
    }
    await this.snapshot()
    this.initialized = true
  }

  private async snapshot(): Promise<{ meta: StorageMeta, files: Record<string, string> }> {
    const meta = parseMeta(await this.fs.readAsString(`${this.directory}/meta.json`))
    const files: Record<string, string> = {}
    for (const file of meta.files) {
      const content = await this.fs.readAsString(`${this.directory}/${file}`)
      JSON.parse(content)
      files[file] = content
    }
    return { meta, files }
  }

  async getMeta(): Promise<StorageMeta> {
    return this.local(async () => {
      await this.initialize()
      return (await this.snapshot()).meta
    })
  }

  /** Read-only archive listing. Does not initialize, synchronize, recover or prune files. */
  async listBackupDirectories(): Promise<string[] | null> {
    const root = this.options.backupDirectory()
    if (root === null) return null
    if (!await this.fs.exists(root)) return []
    const names = (await this.fs.readDirectory(root))
      .filter(name => /^tea_shelf\.\d{4}-\d{2}-\d{2}$/.test(name))
    const directories = await Promise.all(names.map(async name =>
      await this.fs.isDirectory(`${root}/${name}`) ? name : null))
    return directories.filter((name): name is string => name !== null).sort().reverse()
  }

  /** Brand mutations share the local queue with chunk writes and backup acknowledgments. */
  async addBrand(name: string): Promise<string[]> {
    const brand = name.trim()
    if (!brand) throw new Error("请输入品牌名称")
    return this.local(async () => {
      await this.initialize()
      const { meta, files } = await this.snapshot()
      if (meta.brands.includes(brand)) throw new Error("该品牌已存在")
      meta.brands.push(brand)
      await this.commit(meta, files)
      return [...meta.brands]
    })
  }

  async listTeas(): Promise<Tea[]> {
    return this.local(async () => {
      await this.initialize()
      const { files } = await this.snapshot()
      return parseTeas(files[TEAS_FILE]).teas
    })
  }

  /** Save a tea and register its brand in one local directory transaction. */
  async upsertTea(input: TeaInput, id?: string): Promise<Tea> {
    // Capture a detached value before queuing so caller mutation cannot affect the commit.
    const normalized = JSON.parse(encode(validateTea(input))) as TeaInput
    return this.local(async () => {
      await this.initialize()
      const { meta, files } = await this.snapshot()
      const data = parseTeas(files[TEAS_FILE])
      let teaId = id
      if (teaId === undefined) {
        do {
          teaId = `${this.now().getTime().toString(36)}-${++this.teaSequence}-${Math.random().toString(36).slice(2, 8)}`
        } while (data.teas.some(tea => tea.id === teaId))
      }
      const tea: Tea = { ...normalized, id: teaId }
      const index = data.teas.findIndex(item => item.id === teaId)
      if (id !== undefined && index < 0) throw new Error("茶品不存在，请返回列表后重试")
      if (index < 0) data.teas.push(tea)
      else data.teas[index] = tea
      if (tea.brand && !meta.brands.includes(tea.brand)) meta.brands.push(tea.brand)
      files[TEAS_FILE] = encode(data)
      await this.commit(meta, files)
      return tea
    })
  }

  /** Delete only the requested record; keep brands and all other data chunks. */
  async removeTea(id: string): Promise<Tea[]> {
    return this.local(async () => {
      await this.initialize()
      const { meta, files } = await this.snapshot()
      const data = parseTeas(files[TEAS_FILE])
      if (!data.teas.some(tea => tea.id === id)) return data.teas
      data.teas = data.teas.filter(tea => tea.id !== id)
      files[TEAS_FILE] = encode(data)
      await this.commit(meta, files)
      return data.teas
    })
  }

  async read<T extends JsonValue = JsonValue>(file: DataFileName): Promise<T | undefined> {
    if (!validFile(file)) throw new Error(`Invalid data filename: ${file}`)
    return this.local(async () => {
      await this.initialize()
      const { files } = await this.snapshot()
      return file in files ? JSON.parse(files[file]) as T : undefined
    })
  }

  /** Replace the complete dataset. Omitted chunks are deleted. Does not trigger sync. */
  async save(files: DataFiles): Promise<void> {
    const encoded: Record<string, string> = {}
    for (const [name, value] of Object.entries(files)) {
      if (!validFile(name)) throw new Error(`Invalid data filename: ${name}`)
      encoded[name] = encode(value)
    }
    await this.local(async () => {
      await this.initialize()
      await this.saveEncoded(encoded)
    })
  }

  /** Save one chunk while preserving all other listed chunks. */
  async write(file: DataFileName, value: JsonValue): Promise<void> {
    if (!validFile(file)) throw new Error(`Invalid data filename: ${file}`)
    const content = encode(value)
    await this.local(async () => {
      await this.initialize()
      const { files } = await this.snapshot()
      files[file] = content
      await this.saveEncoded(files)
    })
  }

  private async saveEncoded(files: Record<string, string>): Promise<void> {
    const { meta } = await this.snapshot()
    await this.commit(meta, files)
  }

  private async commit(meta: StorageMeta, files: Record<string, string>): Promise<void> {
    // Strictly increasing even for rapid saves or a device clock moving backwards.
    const timestamp = Math.max(this.now().getTime(), meta.updatedAt ? Date.parse(meta.updatedAt) + 1 : 0)
    meta.updatedAt = new Date(timestamp).toISOString()
    meta.files = Object.keys(files).sort() as DataFileName[]
    await this.replace(this.directory, { ...files, "meta.json": encode(meta) })
  }

  /** Initializes local storage and starts startup/10-minute background checks. */
  async start(): Promise<void> {
    await this.local(() => this.initialize())
    if (this.started) return
    this.started = true
    this.schedulePeriodic()
    void this.checkForUpdates().catch(error => this.report(error))
  }

  private schedulePeriodic(): void {
    this.cancelPeriodic = this.schedule(() => {
      if (!this.started) return
      this.schedulePeriodic()
      void this.checkForUpdates().catch(error => this.report(error))
    }, CHECK_INTERVAL_MS)
  }

  /** Coalesces repeated requests; at most one cloud operation can run at a time. */
  checkForUpdates(): Promise<SyncResult> {
    if (this.active) return this.active
    if (this.pending) return this.pending
    this.pending = new Promise<SyncResult>((resolve, reject) => {
      this.resolvePending = resolve
      this.cancelDebounce = this.schedule(() => {
        const request = this.pending!
        this.pending = undefined
        this.resolvePending = undefined
        this.cancelDebounce = undefined
        const task = this.synchronize()
        this.active = request
        task.then(result => {
          this.active = undefined
          resolve(result)
        }, error => {
          this.active = undefined
          reject(error)
        })
      }, SYNC_DEBOUNCE_MS)
    })
    return this.pending
  }

  /** Cancels checks and waits for an in-progress backup; does not force a final sync. */
  async stop(): Promise<void> {
    this.started = false
    this.cancelPeriodic?.()
    this.cancelDebounce?.()
    this.resolvePending?.("stopped")
    this.cancelPeriodic = undefined
    this.cancelDebounce = undefined
    this.pending = undefined
    this.resolvePending = undefined
    await this.active
    await this.localQueue
  }

  private async synchronize(): Promise<SyncResult> {
    let result: SyncResult = "unchanged"
    // Re-read after each upload so changes made during a backup remain pending.
    while (true) {
      const snapshot = await this.local(async () => {
        await this.initialize()
        return this.snapshot()
      })
      const { meta, files } = snapshot
      if (meta.updatedAt === null || (meta.lastSyncAt !== null
        && Date.parse(meta.updatedAt) <= Date.parse(meta.lastSyncAt))) return result
      const root = this.options.backupDirectory()
      if (root === null) return "unavailable"
      await this.fs.createDirectory(root, true)
      // Recover any interrupted daily replacement before pruning backups.
      for (const entry of await this.fs.readDirectory(root)) {
        if (/^tea_shelf\.\d{4}-\d{2}-\d{2}\.previous$/.test(entry)) {
          await this.recover(`${root}/${entry.slice(0, -".previous".length)}`)
        }
      }
      const backedUpMeta = { ...meta, lastSyncAt: meta.updatedAt }
      await this.replace(`${root}/tea_shelf.${dateLabel(this.now())}`, {
        ...files, "meta.json": encode(backedUpMeta),
      })
      const backups = (await this.fs.readDirectory(root))
        .filter(name => /^tea_shelf\.\d{4}-\d{2}-\d{2}$/.test(name)).sort().reverse()
      for (const name of backups.slice(5)) await this.fs.remove(`${root}/${name}`)
      // Acknowledge only the captured version, never the upload completion time.
      // Cleanup failures also remain retryable at the next check.
      await this.local(async () => {
        const current = await this.snapshot()
        current.meta.lastSyncAt = meta.updatedAt
        await this.replace(this.directory, { ...current.files, "meta.json": encode(current.meta) })
      })
      result = "synced"
    }
  }
}
