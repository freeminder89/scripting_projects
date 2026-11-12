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
export const TEAS_FILE = "data.0.json"

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
export function validateTea(input: TeaInput, allowEmptyBrand = false): TeaInput {
  if (!input || typeof input.name !== "string" || !input.name.trim()) throw new Error("请输入品名")
  if (typeof input.brand !== "string") throw new Error("品牌格式不正确")
  if (!allowEmptyBrand && !input.brand.trim()) throw new Error("请选择品牌")
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
  if (!value || !Array.isArray(value.teas)) {
    throw new Error("茶品数据格式不正确，已停止写入")
  }
  const ids = new Set<string>()
  for (const tea of value.teas) {
    if (!tea || typeof tea.id !== "string" || !tea.id || ids.has(tea.id)) {
      throw new Error("茶品编号无效或重复，已停止写入")
    }
    tea.preference = readPreference(tea.preference)
    // Keep older unbranded records readable; new saves must provide a brand.
    validateTea(tea, true)
    ids.add(tea.id)
  }
  return value
}

export interface StorageMeta {
  schemaVersion: 1
  updatedAt: string | null
  lastSyncAt: string | null
  files: string[]
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

export type SyncResult = "synced" | "unchanged" | "unavailable"
export const CHECK_INTERVAL_MS = 10 * 60 * 1000

const validDate = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value))
const encode = (value: unknown): string => {
  const text = JSON.stringify(value, null, 2)
  if (text === undefined) throw new Error("Cannot store undefined JSON")
  return text + "\n"
}

function parseMeta(text: string): StorageMeta {
  const meta = JSON.parse(text)
  if (!meta || !Array.isArray(meta.files)
    || !meta.files.every((file: unknown) => file === TEAS_FILE)
    || new Set(meta.files).size !== meta.files.length
    || (meta.brands !== undefined && (!Array.isArray(meta.brands)
      || !meta.brands.every((brand: unknown) => typeof brand === "string")))
    || !(meta.updatedAt === null || validDate(meta.updatedAt))
    || !(meta.lastSyncAt === null || validDate(meta.lastSyncAt))) {
    throw new Error("Invalid tea_shelf meta.json; refusing to overwrite existing data")
  }
  // Older local/backup metadata remains readable; persist on the next write.
  return { ...meta, brands: meta.brands ?? [] }
}

function dateLabel(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

const clone = <T>(value: T): T => JSON.parse(encode(value)) as T

/** One instance per script. meta/data are shared in-memory objects; saves are explicit. */
export class TeaShelfStorage {
  readonly meta: StorageMeta = {
    schemaVersion: 1, updatedAt: null, lastSyncAt: null, files: [TEAS_FILE], brands: [],
  }
  readonly data: { schemaVersion: 1, teas: Tea[] } = { schemaVersion: 1, teas: [] }
  private options: StorageOptions
  private initialization?: Promise<void>
  private localQueue: Promise<unknown> = Promise.resolve()
  private cloudQueue: Promise<unknown> = Promise.resolve()
  private persistedMeta?: StorageMeta
  private started = false
  private cancelPeriodic?: () => void
  private teaSequence = 0
  private clockFloor = 0
  private failedSave = false
  private failedMetaSave = false

  constructor(options: StorageOptions) { this.options = options }
  private get fs() { return this.options.fs }
  private get directory() { return this.options.localDirectory }
  private now() { return (this.options.now ?? (() => new Date()))() }
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

  private async initialize(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.load().catch(error => {
        this.initialization = undefined
        throw error
      })
    }
    await this.initialization
  }

  private async load(): Promise<void> {
    // Recover a directory swap left by an earlier application version.
    const previous = this.directory + ".previous"
    if (await this.fs.exists(previous)) {
      if (await this.fs.exists(this.directory)) await this.fs.remove(previous)
      else await this.fs.rename(previous, this.directory)
    }
    if (await this.fs.exists(this.directory + ".pending")) await this.fs.remove(this.directory + ".pending")
    const metaPath = this.directory + "/meta.json"
    if (await this.fs.exists(metaPath)) {
      const meta = parseMeta(await this.fs.readAsString(metaPath))
      const data = meta.files.includes(TEAS_FILE)
        ? parseTeas(await this.fs.readAsString(this.directory + "/" + TEAS_FILE))
        : { schemaVersion: 1 as const, teas: [] }
      Object.assign(this.meta, meta, { files: [TEAS_FILE] })
      Object.assign(this.data, data)
      if (!meta.files.includes(TEAS_FILE)) {
        await this.fs.writeAsString(this.directory + "/" + TEAS_FILE, encode(this.data))
        await this.fs.writeAsString(metaPath, encode(this.meta))
      }
    } else {
      // An existing data file without metadata must not be silently overwritten.
      if (await this.fs.exists(this.directory + "/" + TEAS_FILE)) throw new Error("Missing tea_shelf meta.json")
      await this.fs.createDirectory(this.directory, true)
      await this.fs.writeAsString(this.directory + "/" + TEAS_FILE, encode(this.data))
      await this.fs.writeAsString(metaPath, encode(this.meta))
    }
    this.persistedMeta = clone(this.meta)
  }

  async getMeta(): Promise<StorageMeta> {
    await this.initialize()
    return this.meta
  }

  async listTeas(): Promise<Tea[]> {
    await this.initialize()
    return this.data.teas
  }

  /** Memory mutation only. The caller explicitly awaits saveMeta(). */
  addBrand(name: string): string[] {
    this.requireLoaded()
    const brand = name.trim()
    if (!brand) throw new Error("请输入品牌名称")
    if (this.meta.brands.includes(brand)) throw new Error("该品牌已存在")
    this.meta.brands.push(brand)
    return this.meta.brands
  }

  /** Memory mutation only. Brands are saved separately before saving a tea. */
  upsertTea(input: TeaInput, id?: string): Tea {
    this.requireLoaded()
    const normalized = clone(validateTea(input))
    let teaId = id
    if (teaId === undefined) {
      do {
        teaId = `${this.now().getTime().toString(36)}-${++this.teaSequence}-${Math.random().toString(36).slice(2, 8)}`
      } while (this.data.teas.some(tea => tea.id === teaId))
    }
    const index = this.data.teas.findIndex(tea => tea.id === teaId)
    if (id !== undefined && index < 0) throw new Error("茶品不存在，请返回列表后重试")
    const tea: Tea = { ...normalized, id: teaId }
    if (index < 0) this.data.teas.push(tea)
    else this.data.teas[index] = tea
    return tea
  }

  /** Memory mutation only. The caller explicitly awaits saveData(). */
  removeTea(id: string): Tea[] {
    this.requireLoaded()
    this.data.teas = this.data.teas.filter(tea => tea.id !== id)
    return this.data.teas
  }

  private requireLoaded(): void {
    if (!this.persistedMeta) throw new Error("请先初始化存储")
  }

  private touch(): void {
    this.clockFloor = Math.max(
      this.now().getTime(), this.clockFloor + 1,
      this.meta.updatedAt ? Date.parse(this.meta.updatedAt) + 1 : 0,
      this.persistedMeta?.lastSyncAt ? Date.parse(this.persistedMeta.lastSyncAt) + 1 : 0,
    )
    this.meta.updatedAt = new Date(this.clockFloor).toISOString()
  }

  private async writeMeta(): Promise<void> {
    this.meta.files = [TEAS_FILE]
    const meta = parseMeta(encode(this.meta))
    await this.fs.writeAsString(this.directory + "/meta.json", encode(meta))
    this.persistedMeta = clone(meta)
  }

  /** Saves metadata only, advances updatedAt, and never triggers cloud synchronization. */
  async saveMeta(): Promise<void> {
    await this.local(async () => {
      await this.initialize()
      try {
        this.touch()
        await this.writeMeta()
        this.failedMetaSave = false
      } catch (error) {
        this.failedMetaSave = true
        throw error
      }
    })
  }

  /** Saves the one data file, then saves metadata; there is no combined transaction. */
  async saveData(): Promise<void> {
    await this.local(async () => {
      await this.initialize()
      try {
        const data = parseTeas(encode(this.data))
        await this.fs.writeAsString(this.directory + "/" + TEAS_FILE, encode(data))
        this.touch()
        await this.writeMeta()
        this.failedSave = false
        this.failedMetaSave = false
      } catch (error) {
        // A data write may have succeeded before metadata failed. Do not back up
        // that incomplete save until saveData() has been retried successfully.
        this.failedSave = true
        throw error
      }
    })
  }

  /** Read-only archive listing. Does not load data, synchronize or prune files. */
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

  async start(): Promise<void> {
    await this.initialize()
    if (this.started) return
    this.started = true
    this.schedulePeriodic()
    void this.checkForUpdates().catch(error => (this.options.onError ?? console.error)(error))
  }

  private schedulePeriodic(): void {
    this.cancelPeriodic = this.schedule(() => {
      if (!this.started) return
      this.schedulePeriodic()
      void this.checkForUpdates().catch(error => (this.options.onError ?? console.error)(error))
    }, CHECK_INTERVAL_MS)
  }

  /** Every check is queued immediately. No debounce or request merging. */
  checkForUpdates(): Promise<SyncResult> {
    const next = this.cloudQueue.then(() => this.synchronize())
    this.cloudQueue = next.catch(() => {})
    return next
  }

  async stop(): Promise<void> {
    this.started = false
    this.cancelPeriodic?.()
    this.cancelPeriodic = undefined
    await this.cloudQueue
    await this.localQueue
  }

  private async synchronize(): Promise<SyncResult> {
    const snapshot = await this.local(async () => {
      await this.initialize()
      if (this.failedSave || this.failedMetaSave) throw new Error("本地数据尚未保存成功，请重新保存后再同步")
      const meta = clone(this.persistedMeta!)
      if (meta.updatedAt === null || (meta.lastSyncAt !== null
        && Date.parse(meta.updatedAt) <= Date.parse(meta.lastSyncAt))) return null
      const root = this.options.backupDirectory()
      if (root === null) return "unavailable" as const
      // Record the action's start time, not the uploaded data's updatedAt.
      // Later saves must sort after this time even within the same millisecond.
      const syncTime = Math.max(this.now().getTime(), Date.parse(meta.updatedAt), this.clockFloor)
      this.clockFloor = syncTime
      const uploading = this.directory + "/uploading"
      if (await this.fs.exists(uploading)) await this.fs.remove(uploading)
      await this.fs.createDirectory(uploading, true)
      const names = [...meta.files, "meta.json"]
      for (const name of names) {
        const content = name === "meta.json" ? encode(meta) : await this.fs.readAsString(this.directory + "/" + name)
        await this.fs.writeAsString(uploading + "/" + name, content)
      }
      return { root, uploading, names, syncTime }
    })
    if (snapshot === null) return "unchanged"
    if (snapshot === "unavailable") return "unavailable"
    const { root, uploading, names, syncTime } = snapshot
    const destination = root + "/tea_shelf." + dateLabel(new Date(syncTime))
    await this.fs.createDirectory(destination, true)
    for (const name of names) {
      await this.fs.writeAsString(destination + "/" + name, await this.fs.readAsString(uploading + "/" + name))
    }
    const entries = await this.fs.readDirectory(root)
    const dated: string[] = []
    for (const name of entries) {
      if (/^tea_shelf\.\d{4}-\d{2}-\d{2}$/.test(name) && await this.fs.isDirectory(root + "/" + name)) dated.push(name)
    }
    dated.sort().reverse()
    for (const name of dated.slice(5)) await this.fs.remove(root + "/" + name)
    await this.local(async () => {
      // Keep newer local saves, and don't persist unrelated unsaved memory edits.
      const meta = { ...this.persistedMeta!, lastSyncAt: new Date(syncTime).toISOString() }
      await this.fs.writeAsString(this.directory + "/meta.json", encode(meta))
      this.persistedMeta = clone(meta)
      this.meta.lastSyncAt = meta.lastSyncAt
    })
    return "synced"
  }
}
