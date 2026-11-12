# tea_shelf 开发约定

## 发布版本

- 每次执行 `git push` 前，将 `script.json` 的 `version` 更新为 Asia/Shanghai 时区的当前时间，格式为 `yyyyMMdd-HHmm`（如 `20261112-1100`）。
- 版本更新必须包含在本次推送的提交中；使用 `apply_patch` 修改。
- 欢迎页通过 `Script.metadata.version` 显示该版本，不维护另一份版本号，也不使用运行时当前时间代替发布版本。

## README文件约定

- README文件（各目录下）都作为契约spec使用
- agent不直接修改README文件
- 每次做出代码调整后，agent认为有价值同步到README的信息，提醒用户
- README维护原则
  - 非平凡直观的设计方案和机制
  - 不做与代码逻辑完全一致的字段级枚举、属性值重复（比如xxx高度12px这种）
  - README**不能**与代码实现冲突，必须不能
- 用户明确要求agent代写README时，可以编写README文件
