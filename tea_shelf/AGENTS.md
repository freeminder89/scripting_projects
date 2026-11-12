# tea_shelf 开发约定

## 发布版本

- 每次执行 `git push` 前，将 `script.json` 的 `version` 更新为 Asia/Shanghai 时区的当前时间，格式为 `yyyyMMdd-HHmm`（如 `20261112-1100`）。
- 版本更新必须包含在本次推送的提交中；使用 `apply_patch` 修改。
- 欢迎页通过 `Script.metadata.version` 显示该版本，不维护另一份版本号，也不使用运行时当前时间代替发布版本。
