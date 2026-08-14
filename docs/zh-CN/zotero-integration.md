# Zotero 联动

Sociology PhD Desk Zotero 插件 `0.1.0` 支持 Zotero 8 和 Zotero 9；发布候选已使用隔离的合成 profile 在 Zotero 8.0.4 与 Zotero 9.0.6 上完成安装、重启、发送、禁用和卸载验证，未使用真实用户文库。Zotero 继续负责文献收藏、PDF、笔记、标注和引用；工作站只接收用户明确选中文献的书目元数据，并由用户在预览中决定研究项目、阅读状态、优先级和“为什么读”。

## 安装

1. 从 Sociology PhD Desk `v0.3.0` GitHub Release 下载 `sociology-phd-desk-zotero-0.1.0.xpi` 和同名 `.sha256` 文件。
2. 核对 XPI 的 SHA-256 与校验文件一致。
3. 打开 Zotero 8 或 Zotero 9 的“工具 → 插件”。
4. 点击齿轮菜单，选择“从文件安装插件”，并选中 XPI。
5. 如果 Zotero 提示，重启 Zotero。

## 发送文献

1. 在 Zotero 8 或 Zotero 9 选中一篇或多篇普通书目条目。
2. 右键选择“发送到 Sociology PhD Desk”。
3. 小批量会直接打开工作站的“文献”导入预览；较大的批量会保存为本地 `.spdzotero` 文件，再由用户在“文献 → 从 Zotero 导入”中选择。
4. 在预览中选择目标项目、状态和优先级，并填写为什么读；确认后才写入当前工作台。

精确 Zotero 身份会刷新书目信息，但不会覆盖项目、阅读状态、优先级、为什么读或本地笔记。DOI、ISBN、标题与年份仅用于提示可能重复，不会自动合并。

插件不会读取或发送 PDF、附件路径、Zotero 笔记、标注、全文或存储路径；不会后台同步或写回 Zotero。
