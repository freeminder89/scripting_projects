// Run: node --experimental-strip-types --test core/storage/storage.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import * as fs from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { TeaShelfStorage, CHECK_INTERVAL_MS } from "./storage.ts"
import { createTeaDraft, teaFromDraft } from "../../pages/teas/draft.ts"

async function fixture(t) {
  const root = await fs.mkdtemp(join(tmpdir(), "tea-shelf-storage-"))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const local = join(root, "local", "tea_shelf")
  const cloud = join(root, "cloud", "tea_shelf")
  let clock = new Date(2026, 10, 1, 12)
  let available = true
  const timers = new Set()
  const adapter = {
    exists: async path => {
      try { await fs.access(path); return true } catch (error) {
        if (error.code === "ENOENT") return false
        throw error
      }
    },
    isDirectory: async path => {
      try { return (await fs.stat(path)).isDirectory() } catch (error) {
        if (error.code === "ENOENT") return false
        throw error
      }
    },
    createDirectory: async (path, recursive) => { await fs.mkdir(path, { recursive }) },
    readDirectory: path => fs.readdir(path),
    readAsString: path => fs.readFile(path, "utf8"),
    writeAsString: (path, content) => fs.writeFile(path, content),
    rename: async (from, to) => {
      // Do not depend on undocumented destination-overwrite behavior.
      if (await adapter.exists(to)) throw new Error("Destination already exists")
      await fs.rename(from, to)
    },
    remove: path => fs.rm(path, { recursive: true }),
  }
  const errors = []
  const options = {
    fs: adapter,
    localDirectory: local,
    backupDirectory: () => available ? cloud : null,
    now: () => new Date(clock),
    onError: error => errors.push(error),
    schedule: (callback, delay) => {
      const timer = { callback, delay }
      timers.add(timer)
      return () => timers.delete(timer)
    },
  }
  const storage = new TeaShelfStorage(options)
  t.after(() => storage.stop().catch(() => {}))
  const fire = delay => {
    for (const timer of [...timers]) {
      if (timer.delay === delay) { timers.delete(timer); timer.callback() }
    }
  }
  const sync = () => storage.checkForUpdates()
  return {
    storage, adapter, local, cloud, options, fire, sync, errors, timers,
    setClock: value => { clock = value },
    setAvailable: value => { available = value },
  }
}


function teaInput(name = "熟普") {
  return teaFromDraft({
    ...createTeaDraft(), name, brand: "大益", preference: "💥顶夯", stock: "半斤以上",
    pricePerJin: "280", grams300ml: "3.5", firstSteepMinutes: "1.25", gongfuGrams: "7.5",
    firstSteepSeconds: "15", extendEveryCups: "3", extendSeconds: "5", maxSteeps: "12",
  })
}

test("tea form preserves decimals, distinguishes blank from zero and rejects invalid numbers", () => {
  const draft = { ...createTeaDraft(), brand: "大益" }
  const emptyNumbers = teaFromDraft({ ...draft, name: "红茶", pricePerJin: "0", firstSteepMinutes: ".5" })
  assert.equal(emptyNumbers.pricePerJin, 0)
  assert.equal(emptyNumbers.cupBrew.grams300ml, null)
  assert.equal(emptyNumbers.cupBrew.firstSteepMinutes, 0.5)
  assert.equal(teaFromDraft({ ...draft, name: "茶", grams300ml: "３．５" }).cupBrew.grams300ml, 3.5)
  assert.equal(teaFromDraft({ ...draft, name: "茶", firstSteepMinutes: "1,5" }).cupBrew.firstSteepMinutes, 1.5)
  for (const patch of [
    { name: " " }, { pricePerJin: "1.5" }, { grams300ml: "-1" }, { firstSteepMinutes: "Infinity" },
    { firstSteepSeconds: "2.5" }, { extendEveryCups: "0" }, { maxSteeps: "0" }, { pricePerJin: "1e3" },
  ]) {
    assert.throws(() => teaFromDraft({ ...draft, name: "茶", ...patch }))
  }
})


const json = async path => JSON.parse(await fs.readFile(path, "utf8"))
async function ready(f) { await f.storage.getMeta(); return f.storage }
async function saveTea(f, input = teaInput(), id) {
  const s = await ready(f)
  if (!s.meta.brands.includes(input.brand)) { s.addBrand(input.brand); await s.saveMeta() }
  const tea = s.upsertTea(input, id)
  await s.saveData()
  return tea
}
function blockCloud(f) {
  let enter, release
  const entered = new Promise(resolve => { enter = resolve })
  const gate = new Promise(resolve => { release = resolve })
  const write = f.adapter.writeAsString
  let once = true
  f.adapter.writeAsString = async (path, content) => {
    if (once && path.startsWith(f.cloud)) { once = false; enter(); await gate }
    await write(path, content)
  }
  return { entered, release }
}

test("initialization creates a single empty data file, and reads reuse memory objects", async t => {
  const f = await fixture(t)
  const s = await ready(f)
  assert.deepEqual(s.meta.files, ["data.0.json"])
  assert.equal(s.meta.updatedAt, null)
  assert.deepEqual((await fs.readdir(f.local)).sort(), ["data.0.json", "meta.json"])
  const meta = s.meta, data = s.data, teas = s.data.teas
  const read = f.adapter.readAsString
  f.adapter.readAsString = async () => { throw new Error("Unexpected disk read") }
  assert.equal(await s.getMeta(), meta)
  assert.equal(await s.listTeas(), teas)
  assert.equal(s.data, data)
  f.adapter.readAsString = read
  assert.equal(await f.sync(), "unchanged")
  assert.equal(await f.adapter.exists(f.cloud), false)
})

test("memory mutations require explicit save; meta-only saves never rewrite data", async t => {
  const f = await fixture(t)
  const s = await ready(f)
  s.addBrand(" 大益 ")
  const tea = s.upsertTea(teaInput())
  assert.deepEqual((await json(join(f.local, "meta.json"))).brands, [])
  assert.deepEqual((await json(join(f.local, "data.0.json"))).teas, [])
  assert.equal(await f.sync(), "unchanged")
  const writes = []
  const write = f.adapter.writeAsString
  f.adapter.writeAsString = async (path, content) => { writes.push(path); await write(path, content) }
  await s.saveMeta()
  assert.deepEqual(writes, [join(f.local, "meta.json")])
  assert.deepEqual((await json(join(f.local, "meta.json"))).brands, ["大益"])
  assert.deepEqual((await json(join(f.local, "data.0.json"))).teas, [])
  await s.saveData()
  assert.deepEqual(writes.slice(1), [join(f.local, "data.0.json"), join(f.local, "meta.json")])
  assert.deepEqual((await json(join(f.local, "data.0.json"))).teas, [tea])
  assert.equal(await f.adapter.exists(f.cloud), false)
})

test("local save operations are serial and timestamp order survives rapid saves and clock rollback", async t => {
  const f = await fixture(t)
  const s = await ready(f)
  let active = 0, peak = 0
  const write = f.adapter.writeAsString
  f.adapter.writeAsString = async (path, content) => {
    peak = Math.max(peak, ++active)
    await Promise.resolve()
    await write(path, content)
    active--
  }
  s.addBrand("大益")
  await Promise.all([s.saveMeta(), s.saveData(), s.saveMeta()])
  assert.equal(peak, 1)
  const before = s.meta.updatedAt
  f.setClock(new Date(2020, 0, 1))
  await s.saveMeta()
  assert.ok(Date.parse(s.meta.updatedAt) > Date.parse(before))
  assert.equal(s.meta.lastSyncAt, null)
})

test("startup and ten-minute checks run without debounce; stop cancels the timer", async t => {
  const f = await fixture(t)
  await saveTea(f)
  await f.storage.start()
  assert.deepEqual([...f.timers].map(timer => timer.delay), [CHECK_INTERVAL_MS])
  await f.sync() // Queues behind the startup check without merging it.
  assert.equal(await f.adapter.exists(join(f.cloud, "tea_shelf.2026-11-01")), true)
  f.storage.data.teas[0].name = "更新"
  await f.storage.saveData()
  assert.deepEqual([...f.timers].map(timer => timer.delay), [CHECK_INTERVAL_MS])
  f.fire(CHECK_INTERVAL_MS)
  await f.storage.stop()
  assert.equal(f.timers.size, 0)
  assert.equal((await json(join(f.cloud, "tea_shelf.2026-11-01/data.0.json"))).teas[0].name, "更新")
})

test("sync time is the action start time and is acknowledged only after uploading", async t => {
  const f = await fixture(t)
  await saveTea(f)
  const updated = f.storage.meta.updatedAt
  f.setClock(new Date(2026, 10, 1, 14))
  const gate = blockCloud(f)
  const task = f.sync()
  await gate.entered
  assert.equal(f.storage.meta.lastSyncAt, null)
  assert.deepEqual((await fs.readdir(join(f.local, "uploading"))).sort(), ["data.0.json", "meta.json"])
  f.setClock(new Date(2026, 10, 1, 15))
  gate.release()
  assert.equal(await task, "synced")
  assert.equal(f.storage.meta.lastSyncAt, new Date(2026, 10, 1, 14).toISOString())
  assert.equal(f.storage.meta.updatedAt, updated)
  assert.equal((await json(join(f.local, "meta.json"))).lastSyncAt, f.storage.meta.lastSyncAt)
  assert.equal(await f.sync(), "unchanged")
})

test("saves during upload stay dirty; later checks are queued separately and back up the new state", async t => {
  const f = await fixture(t)
  await saveTea(f)
  const gate = blockCloud(f)
  const first = f.sync()
  await gate.entered
  f.storage.data.teas[0].name = "新茶"
  await f.storage.saveData()
  const updated = f.storage.meta.updatedAt
  gate.release()
  await first
  assert.ok(Date.parse(updated) > Date.parse(f.storage.meta.lastSyncAt))
  assert.equal((await json(join(f.cloud, "tea_shelf.2026-11-01/data.0.json"))).teas[0].name, "熟普")
  const secondGate = blockCloud(f)
  const second = f.sync()
  await secondGate.entered
  const third = f.sync()
  assert.notEqual(second, third)
  secondGate.release()
  assert.equal(await second, "synced")
  assert.equal(await third, "unchanged")
  assert.equal((await json(join(f.cloud, "tea_shelf.2026-11-01/data.0.json"))).teas[0].name, "新茶")
})

test("unsaved memory edits are excluded from the snapshot and sync acknowledgment", async t => {
  const f = await fixture(t)
  await saveTea(f)
  f.storage.meta.brands.push("尚未保存")
  f.storage.data.teas[0].name = "尚未保存"
  await f.sync()
  const cloud = join(f.cloud, "tea_shelf.2026-11-01")
  assert.deepEqual((await json(join(cloud, "meta.json"))).brands, ["大益"])
  assert.equal((await json(join(cloud, "data.0.json"))).teas[0].name, "熟普")
  assert.deepEqual((await json(join(f.local, "meta.json"))).brands, ["大益"])
  assert.deepEqual(f.storage.meta.brands, ["大益", "尚未保存"])
  assert.equal(f.storage.data.teas[0].name, "尚未保存")
})

test("iCloud unavailable or failed upload leaves sync time unchanged and can retry", async t => {
  const f = await fixture(t)
  await saveTea(f)
  f.setAvailable(false)
  assert.equal(await f.sync(), "unavailable")
  f.setAvailable(true)
  const write = f.adapter.writeAsString
  f.adapter.writeAsString = async (path, content) => {
    if (path.startsWith(f.cloud)) throw new Error("Cloud offline")
    await write(path, content)
  }
  await assert.rejects(f.sync(), /Cloud offline/)
  assert.equal(f.storage.meta.lastSyncAt, null)
  assert.equal((await json(join(f.local, "meta.json"))).lastSyncAt, null)
  f.adapter.writeAsString = write
  assert.equal(await f.sync(), "synced")
})

test("uploading is cleared each time; cloud extra files survive and only five dated directories remain", async t => {
  const f = await fixture(t)
  const s = await ready(f)
  for (let day = 1; day <= 7; day++) {
    f.setClock(new Date(2026, 10, day, 12))
    s.meta.brands.push(String(day))
    await s.saveMeta()
    await f.sync()
  }
  assert.deepEqual(await fs.readdir(f.cloud), [3,4,5,6,7].map(day => `tea_shelf.2026-11-0${day}`))
  const latest = join(f.cloud, "tea_shelf.2026-11-07")
  await fs.writeFile(join(latest, "extra.json"), "keep")
  await fs.writeFile(join(f.local, "uploading", "stale.json"), "remove")
  await s.saveMeta()
  await f.sync()
  assert.equal(await fs.readFile(join(latest, "extra.json"), "utf8"), "keep")
  assert.equal(await f.adapter.exists(join(f.local, "uploading", "stale.json")), false)
  assert.equal((await fs.readdir(f.cloud)).some(name => /pending|previous|uploading/.test(name)), false)
})

test("data and metadata are not transactional: a separately saved brand survives a data write failure", async t => {
  const f = await fixture(t)
  const s = await ready(f)
  s.addBrand("大益")
  await s.saveMeta()
  const tea = s.upsertTea(teaInput())
  const write = f.adapter.writeAsString
  f.adapter.writeAsString = async (path, content) => {
    if (path === join(f.local, "data.0.json")) throw new Error("Disk full")
    await write(path, content)
  }
  await assert.rejects(s.saveData(), /Disk full/)
  assert.deepEqual((await json(join(f.local, "meta.json"))).brands, ["大益"])
  assert.deepEqual((await json(join(f.local, "data.0.json"))).teas, [])
  assert.deepEqual(s.data.teas, [tea])
  await assert.rejects(f.sync(), /尚未保存成功/)
  f.adapter.writeAsString = write
  await s.saveData()
  assert.deepEqual((await json(join(f.local, "data.0.json"))).teas, [tea])
  assert.equal(await f.sync(), "synced")
})

test("metadata failure after saving data is retryable without treating the incomplete save as synchronized", async t => {
  const f = await fixture(t)
  await saveTea(f)
  const s = f.storage
  s.data.teas[0].name = "新茶"
  const write = f.adapter.writeAsString
  f.adapter.writeAsString = async (path, content) => {
    if (path === join(f.local, "meta.json")) throw new Error("Meta failed")
    await write(path, content)
  }
  await assert.rejects(s.saveData(), /Meta failed/)
  assert.equal((await json(join(f.local, "data.0.json"))).teas[0].name, "新茶")
  await assert.rejects(f.sync(), /尚未保存成功/)
  f.adapter.writeAsString = write
  await s.saveData()
  assert.equal(await f.sync(), "synced")
})

test("brand validation and explicit edits/deletes preserve records and brands", async t => {
  const f = await fixture(t)
  const first = await saveTea(f)
  const second = await saveTea(f, { ...teaInput("绿茶"), brand: "中茶" })
  assert.throws(() => f.storage.addBrand(" 大益 "), /已存在/)
  assert.throws(() => f.storage.addBrand(" "), /请输入/)
  assert.throws(() => f.storage.upsertTea({ ...teaInput(), brand: "" }), /请选择品牌/)
  assert.throws(() => f.storage.upsertTea(teaInput(), "missing"), /不存在/)
  const edited = await saveTea(f, { ...first, name: "熟普2" }, first.id)
  assert.equal(edited.id, first.id)
  f.storage.removeTea(second.id)
  await f.storage.saveData()
  assert.deepEqual(await new TeaShelfStorage(f.options).listTeas(), [edited])
  assert.deepEqual(f.storage.meta.brands, ["大益", "中茶"])
})

test("failed meta-only save retains memory for retry and never uploads that failed save", async t => {
  const f = await fixture(t)
  const s = await ready(f)
  s.addBrand("大益")
  const write = f.adapter.writeAsString
  f.adapter.writeAsString = async (path, content) => {
    if (path === join(f.local, "meta.json")) throw new Error("Meta failed")
    await write(path, content)
  }
  await assert.rejects(s.saveMeta(), /Meta failed/)
  assert.deepEqual(s.meta.brands, ["大益"])
  assert.deepEqual((await json(join(f.local, "meta.json"))).brands, [])
  await assert.rejects(f.sync(), /尚未保存成功/)
  f.adapter.writeAsString = write
  await s.saveMeta()
  assert.equal(await f.sync(), "synced")
})

test("a failed sync acknowledgment does not advance lastSyncAt and the next check retries", async t => {
  const f = await fixture(t)
  await saveTea(f)
  const write = f.adapter.writeAsString
  f.adapter.writeAsString = async (path, content) => {
    if (path === join(f.local, "meta.json")) throw new Error("Acknowledge failed")
    await write(path, content)
  }
  await assert.rejects(f.sync(), /Acknowledge failed/)
  assert.equal(f.storage.meta.lastSyncAt, null)
  f.adapter.writeAsString = write
  assert.equal(await f.sync(), "synced")
  const restarted = new TeaShelfStorage(f.options)
  await restarted.getMeta()
  assert.equal(await restarted.checkForUpdates(), "unchanged")
  assert.equal(restarted.meta.lastSyncAt, f.storage.meta.lastSyncAt)
})

test("legacy ratings and empty brands remain readable; version fields do not gate loading", async t => {
  const f = await fixture(t)
  await ready(f)
  const teas = ["不行", "口粮", "不错", "很好"].map((preference, i) => ({
    ...teaInput(), id: String(i), preference, brand: "",
  }))
  await fs.writeFile(join(f.local, "data.0.json"), JSON.stringify({ schemaVersion: 2, teas }))
  const meta = await json(join(f.local, "meta.json"))
  meta.schemaVersion = 2
  delete meta.brands
  meta.config = { toolbarIconSize: 40 }
  await fs.writeFile(join(f.local, "meta.json"), JSON.stringify(meta))
  const s = new TeaShelfStorage(f.options)
  assert.deepEqual((await s.listTeas()).map(tea => tea.preference), ["✅还行", "✅还行", "👍夯", "💥顶夯"])
  assert.deepEqual(s.meta.brands, [])
  assert.throws(() => s.upsertTea(s.data.teas[0], "0"), /请选择品牌/)
  await s.saveData()
  assert.deepEqual((await json(join(f.local, "data.0.json"))).teas.map(tea => tea.preference), ["✅还行", "✅还行", "👍夯", "💥顶夯"])
  assert.deepEqual((await json(join(f.local, "meta.json"))).config, meta.config)
})

test("old empty datasets migrate to the fixed file without becoming dirty", async t => {
  const f = await fixture(t)
  await fs.mkdir(f.local, { recursive: true })
  await fs.writeFile(join(f.local, "meta.json"), JSON.stringify({
    schemaVersion: 1, updatedAt: null, lastSyncAt: null, files: [],
  }))
  const s = await ready(f)
  assert.deepEqual(s.meta.files, ["data.0.json"])
  assert.equal(s.meta.updatedAt, null)
  assert.equal(await f.sync(), "unchanged")
  assert.deepEqual(await json(join(f.local, "data.0.json")), { schemaVersion: 1, teas: [] })
})

test("corrupt metadata, missing data and unrecognized tea files are not overwritten", async t => {
  const f = await fixture(t)
  await ready(f)
  await fs.writeFile(join(f.local, "meta.json"), "{}")
  await assert.rejects(new TeaShelfStorage(f.options).getMeta(), /Invalid tea_shelf/)
  const meta = { schemaVersion: 1, updatedAt: null, lastSyncAt: null, files: ["data.0.json"], brands: [] }
  await fs.writeFile(join(f.local, "meta.json"), JSON.stringify(meta))
  await fs.rm(join(f.local, "data.0.json"))
  await assert.rejects(new TeaShelfStorage(f.options).getMeta(), /ENOENT/)
  await fs.writeFile(join(f.local, "data.0.json"), '{"unrelated":true}')
  await assert.rejects(new TeaShelfStorage(f.options).listTeas(), /茶品数据格式/)
  assert.deepEqual(await json(join(f.local, "data.0.json")), { unrelated: true })
})

test("archive listing is read-only and returns only date directories newest first", async t => {
  const f = await fixture(t)
  f.setAvailable(false)
  assert.equal(await f.storage.listBackupDirectories(), null)
  f.setAvailable(true)
  assert.deepEqual(await f.storage.listBackupDirectories(), [])
  assert.equal(await f.adapter.exists(f.local), false)
  const dates = ["tea_shelf.2026-11-01", "tea_shelf.2026-11-07"]
  for (const name of [...dates, "tea_shelf.2026-11-08.pending", "other"]) {
    await fs.mkdir(join(f.cloud, name), { recursive: true })
  }
  await fs.writeFile(join(f.cloud, "tea_shelf.2026-11-09"), "file")
  for (const name of ["createDirectory", "writeAsString", "rename", "remove"]) {
    f.adapter[name] = async () => { throw new Error("Unexpected mutation") }
  }
  assert.deepEqual(await f.storage.listBackupDirectories(), [...dates].reverse())
  assert.equal(await f.adapter.exists(f.local), false)
})
