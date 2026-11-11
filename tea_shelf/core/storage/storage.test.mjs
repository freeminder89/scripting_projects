// Run: node --experimental-strip-types --test core/storage/storage.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import * as fs from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { TeaShelfStorage, CHECK_INTERVAL_MS, SYNC_DEBOUNCE_MS } from "./storage.ts"

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
  const sync = () => {
    const promise = storage.checkForUpdates()
    fire(SYNC_DEBOUNCE_MS)
    return promise
  }
  return {
    storage, adapter, local, cloud, options, fire, sync, errors, timers,
    setClock: value => { clock = value },
    setAvailable: value => { available = value },
  }
}

test("local directory, full replacement, chunk writes and monotonic timestamps", async t => {
  const f = await fixture(t)
  assert.deepEqual((await f.storage.getMeta()).files, [])
  await f.storage.save({ "data.0.json": { tea: "oolong" }, "data.1.json": [1] })
  const first = await f.storage.getMeta()
  await f.storage.write("data.0.json", { tea: "green" })
  const second = await f.storage.getMeta()
  assert.ok(Date.parse(second.updatedAt) > Date.parse(first.updatedAt))
  assert.deepEqual(await f.storage.read("data.1.json"), [1])
  f.setClock(new Date(2020, 0, 1))
  await f.storage.save({ "data.2.json": null })
  assert.ok(Date.parse((await f.storage.getMeta()).updatedAt) > Date.parse(second.updatedAt))
  assert.deepEqual((await fs.readdir(f.local)).sort(), ["data.2.json", "meta.json"])
  assert.equal(await f.storage.read("data.0.json"), undefined)
  assert.equal(await f.adapter.exists(f.cloud), false)
  await assert.rejects(f.storage.save({ "../outside.json": [] }), /Invalid data filename/)
})

test("startup and ten-minute checks, debounce, no save-triggered sync, stop cancels timers", async t => {
  const f = await fixture(t)
  await f.storage.write("data.0.json", ["startup"])
  await f.storage.start()
  const first = f.storage.checkForUpdates()
  assert.equal(f.storage.checkForUpdates(), first)
  assert.equal([...f.timers].filter(timer => timer.delay === SYNC_DEBOUNCE_MS).length, 1)
  f.fire(SYNC_DEBOUNCE_MS)
  assert.equal(await first, "synced")
  await f.storage.write("data.0.json", ["next"])
  assert.equal([...f.timers].some(timer => timer.delay === SYNC_DEBOUNCE_MS), false)
  f.fire(CHECK_INTERVAL_MS)
  assert.equal(await f.sync(), "synced")
  const meta = await f.storage.getMeta()
  assert.equal(meta.updatedAt, meta.lastSyncAt)
  assert.equal(await f.sync(), "unchanged")
  assert.deepEqual(await fs.readdir(f.cloud), ["tea_shelf.2026-11-01"])
  assert.deepEqual(JSON.parse(await fs.readFile(join(f.cloud, "tea_shelf.2026-11-01/data.0.json"))), ["next"])
  const pending = f.storage.checkForUpdates()
  await f.storage.stop()
  assert.equal(await pending, "stopped")
  assert.equal(f.timers.size, 0)
})

test("empty initialization does not replace an existing cloud backup", async t => {
  const f = await fixture(t)
  await fs.mkdir(join(f.cloud, "tea_shelf.2026-11-01"), { recursive: true })
  await fs.writeFile(join(f.cloud, "tea_shelf.2026-11-01/keep"), "existing")
  await f.storage.start()
  assert.equal(await f.sync(), "unchanged")
  assert.equal(await fs.readFile(join(f.cloud, "tea_shelf.2026-11-01/keep"), "utf8"), "existing")
})

test("iCloud unavailable or failed write leaves changes pending and retries", async t => {
  const f = await fixture(t)
  await f.storage.write("data.0.json", ["saved locally"])
  f.setAvailable(false)
  assert.equal(await f.sync(), "unavailable")
  assert.equal((await f.storage.getMeta()).lastSyncAt, null)
  f.setAvailable(true)
  const write = f.adapter.writeAsString
  f.adapter.writeAsString = async (path, content) => {
    if (path.startsWith(f.cloud)) throw new Error("Cloud offline")
    await write(path, content)
  }
  await assert.rejects(f.sync(), /Cloud offline/)
  assert.equal((await f.storage.getMeta()).lastSyncAt, null)
  assert.deepEqual(await f.storage.read("data.0.json"), ["saved locally"])
  f.adapter.writeAsString = write
  assert.equal(await f.sync(), "synced")
})

test("keeps five newest dated directories and overwrites same-day snapshots", async t => {
  const f = await fixture(t)
  for (let day = 1; day <= 7; day++) {
    f.setClock(new Date(2026, 10, day, 12))
    await f.storage.save({ "data.0.json": { day }, "data.1.json": [] })
    await f.sync()
  }
  await f.storage.save({ "data.0.json": { final: true } })
  await f.sync()
  assert.deepEqual(await fs.readdir(f.cloud), [3, 4, 5, 6, 7].map(day => `tea_shelf.2026-11-0${day}`))
  const latest = join(f.cloud, "tea_shelf.2026-11-07")
  assert.deepEqual((await fs.readdir(latest)).sort(), ["data.0.json", "meta.json"])
  const meta = JSON.parse(await fs.readFile(join(latest, "meta.json")))
  assert.equal(meta.updatedAt, meta.lastSyncAt)
})

test("a save during backup is not acknowledged early and is backed up afterward", async t => {
  const f = await fixture(t)
  await f.storage.write("data.0.json", ["old"])
  let unblock
  let entered
  const blocked = new Promise(resolve => { entered = resolve })
  const release = new Promise(resolve => { unblock = resolve })
  const write = f.adapter.writeAsString
  let once = true
  f.adapter.writeAsString = async (path, content) => {
    if (once && path.startsWith(f.cloud)) {
      once = false
      entered()
      await release
    }
    await write(path, content)
  }
  const task = f.sync()
  await blocked
  assert.equal(f.storage.checkForUpdates(), task)
  await f.storage.write("data.0.json", ["new"])
  assert.equal((await f.storage.getMeta()).lastSyncAt, null)
  unblock()
  assert.equal(await task, "synced")
  const meta = await f.storage.getMeta()
  assert.equal(meta.updatedAt, meta.lastSyncAt)
  assert.deepEqual(JSON.parse(await fs.readFile(join(f.cloud, "tea_shelf.2026-11-01/data.0.json"))), ["new"])
})

test("failed directory commit rolls back and restart recovers an interrupted swap", async t => {
  const f = await fixture(t)
  await f.storage.write("data.0.json", ["good"])
  const rename = f.adapter.rename
  f.adapter.rename = async (from, to) => {
    if (from === f.local + ".pending" && to === f.local) throw new Error("Commit failed")
    await rename(from, to)
  }
  await assert.rejects(f.storage.write("data.0.json", ["bad"]), /Commit failed/)
  assert.deepEqual(await f.storage.read("data.0.json"), ["good"])
  f.adapter.rename = rename
  await fs.rename(f.local, f.local + ".previous")
  const restarted = new TeaShelfStorage(f.options)
  assert.deepEqual(await restarted.read("data.0.json"), ["good"])
  assert.equal(await f.adapter.exists(f.local + ".previous"), false)
  assert.equal(await f.adapter.exists(f.local + ".pending"), false)
})

test("corrupt metadata or a missing listed chunk is not silently reinitialized", async t => {
  const f = await fixture(t)
  await f.storage.write("data.0.json", ["good"])
  await fs.writeFile(join(f.local, "meta.json"), "{}")
  const restarted = new TeaShelfStorage(f.options)
  await assert.rejects(restarted.write("data.0.json", []), /Invalid tea_shelf/)
  assert.deepEqual(JSON.parse(await fs.readFile(join(f.local, "data.0.json"))), ["good"])
  await fs.writeFile(join(f.local, "meta.json"), JSON.stringify({
    schemaVersion: 1, updatedAt: new Date().toISOString(), lastSyncAt: null, files: ["data.9.json"],
  }))
  await assert.rejects(new TeaShelfStorage(f.options).getMeta(), /ENOENT/)
})

test("legacy metadata gains brands without losing chunks or sync state", async t => {
  const f = await fixture(t)
  await f.storage.write("data.0.json", { teas: ["oolong"] })
  await f.sync()
  const legacy = await f.storage.getMeta()
  delete legacy.brands
  await fs.writeFile(join(f.local, "meta.json"), JSON.stringify(legacy))
  const storage = new TeaShelfStorage(f.options)
  assert.deepEqual((await storage.getMeta()).brands, [])
  assert.deepEqual(await storage.addBrand("  大益  "), ["大益"])
  const meta = JSON.parse(await fs.readFile(join(f.local, "meta.json")))
  assert.deepEqual(meta.brands, ["大益"])
  assert.equal(meta.lastSyncAt, legacy.lastSyncAt)
  assert.ok(Date.parse(meta.updatedAt) > Date.parse(legacy.updatedAt))
  assert.deepEqual(await storage.read("data.0.json"), { teas: ["oolong"] })
  await storage.write("data.1.json", ["new chunk"])
  assert.deepEqual((await storage.getMeta()).brands, ["大益"])
})

test("brand changes serialize, reject blank/duplicate names and stay local until a check", async t => {
  const f = await fixture(t)
  await Promise.all([f.storage.addBrand("大益"), f.storage.addBrand("中茶")])
  assert.deepEqual((await f.storage.getMeta()).brands, ["大益", "中茶"])
  assert.equal(await f.adapter.exists(f.cloud), false)
  const before = await f.storage.getMeta()
  await assert.rejects(f.storage.addBrand(" \n "), /请输入品牌名称/)
  await assert.rejects(f.storage.addBrand(" 大益 "), /该品牌已存在/)
  assert.deepEqual(await f.storage.getMeta(), before)
  assert.deepEqual(await f.storage.removeBrand("大益"), ["中茶"])
  await f.sync()
  const backup = JSON.parse(await fs.readFile(join(f.cloud, "tea_shelf.2026-11-01/meta.json")))
  assert.deepEqual(backup.brands, ["中茶"])
  const after = await f.storage.getMeta()
  await f.storage.removeBrand("不存在的品牌")
  assert.deepEqual(await f.storage.getMeta(), after)
  await f.storage.removeBrand("中茶")
  assert.equal(await f.sync(), "synced")
  assert.deepEqual(JSON.parse(await fs.readFile(join(f.cloud, "tea_shelf.2026-11-01/meta.json"))).brands, [])
})

test("brand added during a backup survives its acknowledgment and is backed up", async t => {
  const f = await fixture(t)
  await f.storage.addBrand("大益")
  let unblock
  let entered
  const blocked = new Promise(resolve => { entered = resolve })
  const release = new Promise(resolve => { unblock = resolve })
  const write = f.adapter.writeAsString
  let once = true
  f.adapter.writeAsString = async (path, content) => {
    if (once && path.startsWith(f.cloud)) {
      once = false
      entered()
      await release
    }
    await write(path, content)
  }
  const task = f.sync()
  await blocked
  await f.storage.addBrand("中茶")
  unblock()
  assert.equal(await task, "synced")
  const meta = await f.storage.getMeta()
  assert.deepEqual(meta.brands, ["大益", "中茶"])
  assert.equal(meta.updatedAt, meta.lastSyncAt)
  const backup = JSON.parse(await fs.readFile(join(f.cloud, "tea_shelf.2026-11-01/meta.json")))
  assert.deepEqual(backup.brands, meta.brands)
})

test("invalid brands metadata is rejected without erasing the original", async t => {
  const f = await fixture(t)
  const meta = await f.storage.getMeta()
  meta.brands = [12]
  await fs.writeFile(join(f.local, "meta.json"), JSON.stringify(meta))
  await assert.rejects(new TeaShelfStorage(f.options).addBrand("大益"), /Invalid tea_shelf/)
  assert.deepEqual(JSON.parse(await fs.readFile(join(f.local, "meta.json"))).brands, [12])
})
