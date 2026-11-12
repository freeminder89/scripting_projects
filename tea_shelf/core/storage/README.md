# 文件存储

`index.ts` 导出应用使用的单例 `storage`，`storage.ts` 提供可注入文件系统的实现。
一个脚本进程使用一个实例；当前不支持多设备或多进程并发写入同一份数据。

## 目录

本地数据位于 `FileManager.appGroupDocumentsDirectory/tea_shelf`，不放在可被远程更新替换的脚本目录中。
iCloud 备份位于 `FileManager.iCloudDocumentsDirectory/tea_shelf/tea_shelf.YYYY-MM-DD`。

### 目录文件
#### meta.json

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-11-11T11:30:00.000Z",
  "lastSyncAt": null,
  "files": ["data.0.json"], 
  "brands": ["大益", "中茶"]
}
```

- updatedAt: 初始化为null；每次有更新（所有文件更新）时，同步修改；为null时不备份到icloud；时间保存为 UTC
- lastSyncAt：先同步icloud再修改，保存的是同步动作完成的时间；时间保存为 UTC
- files：暂时固定只有一个文件，未来按需实现存储分块
- brands：用户提交的品牌名

#### data.0.json

```json
{
  "schemaVersion": 1,
  "teas": [] 
}
```

- schemaVersion：固定，暂无作用
- teas：tea对象，字段以代码为准
  - 未设置的数字用 `null` 表示，不与 `0` 混淆。

## 机制

* 数据对象：
  * 提供全局单例数据对象，程序内读写只交互全局数据对象
  * 数据对象本身不负责保存本地文件，手动触发
  * 对meta有修改的场景要即时保存，不做联合事务保存。比如：
    * 茶品页新增品牌时直接保存meta，保存茶品时保存data，不做事务打包
* 本地存储：
  * 提供saveMeta、saveData接口，存储全局对象到本地文件；
  * saveData内部修改meta时间戳并saveMeta；
  * saveMeta提供在只更新元信息场景使用
  * 本地存储保存需要串行执行；本地保存不触发icloud同步
* 同步icloud：
  * 同步条件（需要都满足）
    * 更新时间不是null（非初始化文件）
    * 更新时间大于上次同步时间
  * 同步触发时机
    * 启动应用后后台同步
    * 运行期间10分钟同步一次
    * 同步过程需要串行执行
  * 同步过程
    * 本地使用uploading临时目录，云端不使用临时目录
    * 同步前清空临时目录
    * copy待同步文件到临时目录
    * 上传临时目录中内容到云端同步目录，直接做同名文件替换，不需要删除云端目录多余文件
    * 同步结束后保证只有5个历史版本，多余的删除
  * 边界说明
    * 不考虑同步期间本地文件的修改
    * 不考虑
     


## 茶品


评分使用纯文本直接保存标签，历史数据兼容表：
> 读取时转换，保存时更新评分。
| 当前评分档 | 历史兼容评分 |
| --- | --- |
| ✅还行 | 不行、口粮 |
| 👍夯 | 不错 |
| 💥顶夯 | 很好

## 其他接口

`listBackupDirectories()` 只读查询 iCloud 中的日期存档目录，倒序返回目录名；iCloud 不可用返回 `null`，无存档返回空数组。


## 验证
使用 Node.js 22.18 或更新版本运行：

```sh
node --experimental-strip-types --test core/storage/storage.test.mjs
```

测试使用临时目录和可控时钟，不访问真实应用数据和 iCloud。
