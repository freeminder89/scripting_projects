# 文件存储

`index.ts` 导出应用使用的单例 `storage`，`storage.ts` 提供可注入文件系统的实现。
一个脚本进程使用一个实例；当前不支持多设备或多进程并发写入同一份数据。

## 目录

本地数据位于 `FileManager.appGroupDocumentsDirectory/tea_shelf`，不放在可被远程更新替换的脚本目录中。
iCloud 备份位于 `FileManager.iCloudDocumentsDirectory/tea_shelf/tea_shelf.YYYY-MM-DD`。
每个目录包含 `meta.json` 以及清单内的 `data.数字.json`。

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-11-11T11:30:00.000Z",
  "lastSyncAt": null,
  "files": ["data.0.json"],
  "brands": ["大益", "中茶"]
}
```

首次初始化时 `updatedAt`、`lastSyncAt` 均为 `null`，文件清单为空，不自动备份空数据。
时间保存为 UTC，备份日期按设备本地时区生成。

## 使用

```ts
import { storage } from "./core/storage"

await storage.start()
await storage.write("data.0.json", { teas: [] })
const data = await storage.read("data.0.json")
const meta = await storage.getMeta()
// 茶品编辑页新增的品牌保存在 meta.json 中，更新 updatedAt，不触发即时同步。
await storage.addBrand("大益")
// 完整替换数据集；未列出的分块被删除。
await storage.save({ "data.0.json": { teas: [] }, "data.1.json": [] })
// 退出时停止检查并等待正在进行的备份，不强制同步。
await storage.stop()
```

应用入口已接入 `start()` 和 `stop()`。保存只更新本地数据和 `updatedAt`，不触发同步。
启动时及运行期间每 10 分钟检查：有未同步修改才备份。请求在 500ms 内合并，任务串行执行。
同步期间有新修改会继续备份；`lastSyncAt` 只推进到已备份快照的 `updatedAt`，不使用上传结束时间。
同步元数据更新不会改变业务数据的 `updatedAt`。
旧版元数据缺少 `brands` 时按空列表读取，下次写入时补齐；新增品牌会去除首尾空白并拒绝空名称和重复名称。

## 茶品

`listTeas()` 读取茶品列表；`upsertTea(input, id?)` 新增或按稳定 ID 编辑茶品；`removeTea(id)` 删除茶品并保留品牌和其他分块。
当前茶品集合存放于 `data.0.json`，结构为 `{ "schemaVersion": 1, "teas": [...] }`，后续可扩展分块。
每条记录包含品名、品牌、喜好、斤价、存量、杯泡和功夫配置。未设置的数字用 `null` 表示，不与 `0` 混淆。
杯泡分钟和投茶克数支持小数；斤价、秒数、杯数、泡数为整数，杯数和最大泡数填写时至少为 1。
茶品保存与新品牌注册在同一目录事务中提交，失败不会单独留下品牌；不会触发即时同步。
编辑页的加号通过 `addBrand()` 立即独立保存品牌并选中，不等待茶品保存。
新评分为“✅还行 / 👍夯 / 💥顶夯”。读取旧记录时，“不行”和“口粮”映射为“✅还行”，“不错”映射为“👍夯”，“很好”映射为“💥顶夯”；下次茶品写入时保存新格式。
已有的未知格式 `data.0.json` 会报错并保留，不会自动覆盖；其他分块和元数据保持原样。

同日覆盖，保留最近 5 个日期目录。文件先写入同级 `.pending` 目录并校验，再用目录重命名提交；
原目录暂存为 `.previous`，失败回滚，重启时恢复中断的提交。目录替换使用两次重命名，
不承诺跨进程原子读取或系统断电级别的持久性。

iCloud 不可用时继续本地使用；写入失败通过 `onError` 上报，保持未同步状态供下次检查重试。
成功表示文件已写入 iCloud 目录，不保证系统已完成云端上传。脚本关闭或挂起期间不保证定时检查。
损坏元数据或缺失分块会报错，不自动用空数据覆盖；云端恢复功能尚未提供。

## 验证

使用 Node.js 22.18 或更新版本运行：

```sh
node --experimental-strip-types --test core/storage/storage.test.mjs
```

测试使用临时目录和可控时钟，不访问真实应用数据和 iCloud。
