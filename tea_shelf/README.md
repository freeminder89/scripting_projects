# tea_shelf

使用 Scripting 开发的个人茶架应用。

## 页面

- 欢迎页：功能卡片按每行三列布局，目前提供“品牌管理”入口。
- 品牌管理：输入品牌名称后点击“添加”；列表每项显示品牌名称，右滑后点击“删除”。
- 品牌列表保存在本地 `meta.json` 的 `brands` 字段，随现有机制备份到 iCloud。
- 欢迎页显示 `script.json` 中的发布版本；每次 push 前按北京时间更新为 `yyyyMMddHHmm`。

## 从 GitHub 导入或更新

在 Scripting App 中导入以下脚本子目录地址，或在已有脚本的设置中将远程来源设为该地址，再手动检查更新：

https://github.com/freeminder89/scripting_projects/tree/main/tea_shelf

请使用上面的子目录地址。仓库根目录包含多个项目，不是本脚本的目录。

导入或更新完成后，运行 `tea_shelf`，页面将显示欢迎页与“品牌管理”卡片。如果仍显示示例内容，请先在脚本编辑器中确认项目文件已更新为本仓库的内容。

## 本地文件

- `script.json`：脚本名称、图标、版本等配置。
- `index.tsx`：主应用入口。
- `core/storage/`：本地文件存储与 iCloud 按日备份，详见该目录的 README。
- `pages/`：欢迎页和品牌管理页。

手动导入时，应将配置、入口和 `core/`、`pages/` 目录一起放到 Scripting 的同一脚本目录中。

关闭页面后，脚本会调用 `Script.exit()` 释放资源。

参考：[Scripting 快速开始](https://scriptingapp.github.io/zh/guide/Quick%20Start)、[远程脚本来源与更新](https://scriptingapp.github.io/zh/guide/Script/Script#远程脚本来源与更新)。
