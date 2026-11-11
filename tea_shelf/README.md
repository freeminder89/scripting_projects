# tea_shelf

使用 Scripting 开发的个人应用，目前为 Hello World 项目。

## 从 GitHub 导入或更新

在 Scripting App 中导入以下脚本子目录地址，或在已有脚本的设置中将远程来源设为该地址，再手动检查更新：

https://github.com/freeminder89/scripting_projects/tree/main/tea_shelf

请使用上面的子目录地址。仓库根目录包含多个项目，不是本脚本的目录。

导入或更新完成后，运行 `tea_shelf`，页面将显示 `amow said hello`。如果仍显示示例内容，请先在脚本编辑器中确认 `index.tsx` 已更新为本仓库的内容。

## 本地文件

- `script.json`：脚本名称、图标、版本等配置。
- `index.tsx`：主应用入口。

手动导入时，应将这两个文件一起放到 Scripting 的同一脚本目录中。

关闭页面后，脚本会调用 `Script.exit()` 释放资源。

参考：[Scripting 快速开始](https://scriptingapp.github.io/zh/guide/Quick%20Start)、[远程脚本来源与更新](https://scriptingapp.github.io/zh/guide/Script/Script#远程脚本来源与更新)。
