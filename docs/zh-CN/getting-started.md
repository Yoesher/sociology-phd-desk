# 开始使用 Sociology PhD Desk

## 直接在浏览器中使用

打开 <https://yoesher.github.io/sociology-phd-desk/>。无需 GitHub 账号、注册、登录或云数据库。Windows、macOS 和 Linux 上支持 IndexedDB 的现代浏览器都可以直接使用；浏览器模式与已安装模式具有相同的研究功能。

第一次打开会建立一个空的个人工作台和一个明确标注的合成 Demo。研究数据默认保存在当前设备、当前浏览器配置文件、当前 Web 来源的 IndexedDB 中，不会默认同步到其他设备。

## 安装 PWA

兼容浏览器可能在地址栏或浏览器菜单中显示“安装应用”。也可以打开“工作台与设置 → 应用与存储”，在浏览器提供安装事件时选择“安装”。截至 2026-08-13，官方说明可概括为：Chrome/Edge 在支持的平台通过地址栏或菜单提供安装；Firefox 的独立 Web App 目前是 Windows 功能且受版本/安装来源限制；Safari 在 macOS Sonoma 14 或更高版本使用“文件 → 添加到程序坞”，在 iOS/iPadOS 使用“分享 → 添加到主屏幕 → 作为 Web App 打开”。Linux 上若浏览器不提供安装，请继续完整网页模式并使用书签或固定标签页。Android 上支持的 Chromium 浏览器通常从浏览器菜单安装。不同浏览器能力会变化，以浏览器自身菜单和官方说明为准。

官方入口：[Chrome 桌面 Web App](https://support.google.com/chrome/answer/9658361?hl=zh-Hans)、[Chrome Android 主屏幕快捷方式](https://support.google.com/chrome/answer/15085120?hl=zh-Hans)、[Microsoft Edge PWA](https://learn.microsoft.com/zh-cn/microsoft-edge/progressive-web-apps/ux)、[Safari Mac Web App](https://support.apple.com/zh-cn/104996)、[Safari iPhone Web App](https://support.apple.com/zh-cn/guide/iphone/iphea86e5236/ios)、[Firefox Windows Web App](https://support.mozilla.org/zh-CN/kb/web-apps-firefox-windows)。

安装不是账号注册，也不会把现有数据上传到服务器。安装后的应用和普通浏览器标签页仍使用同一浏览器来源下的本地存储。

## 离线与更新

成功在线打开一次后，service worker 会保存应用的静态构建文件，以便离线启动。它没有研究数据上传、代理或 runtime 缓存规则；工作台研究内容仍由 IndexedDB 管理。首次安装缓存之前，或浏览器主动清除站点数据后，离线启动可能不可用。

应用会在启动时检查更新，并在窗口重新获得焦点后以不高于每小时一次的频率适度检查。发现等待中的版本时只显示提示，不会强制刷新；选择“稍后”不会重载。点击“立即更新”后，waiting service worker 先检查同一应用 scope 是否还有其他窗口并通知它们；若存在其他标签页，更新会保守拒绝。随后应用完成当前工作台待写入内容并回读最新提交；已解锁加密工作台也必须通过该核验。核验失败时不会激活新版本。成功后页面重新加载，并由现有迁移链安全处理受支持的旧 schema。

## 在新设备恢复加密备份

1. 在旧设备的“备份与恢复”中为加密工作台生成 `.sociologydesk` 备份，并把文件保存到可信位置。
2. 在新设备打开 Sociology PhD Desk，进入“工作台与设置 → 备份与恢复”。
3. 选择“导入加密备份”，输入备份口令，并为新设备上的新工作台设置口令。
4. 应用会先认证和完整验证备份，再创建隔离的新工作台；错误口令或损坏文件不会写入目标工作台。

本项目无法恢复遗失口令。普通 JSON 是可直接阅读的明文，不应当作加密迁移文件。

## 持久存储与备份提醒

“应用与存储”会显示浏览器报告的 persistent storage 状态。只有在你主动点击时才调用 `navigator.storage.persist()`；浏览器可以批准，也可以拒绝。获批会降低自动回收风险，但不能防止用户手动清除、浏览器重置、设备损坏或同源代码访问。

个人工作台的本地备份提醒可关闭或设为 7、14、30 天，默认 14 天；Demo 永不提醒。提醒依据工作台注册表中的最近一次成功生成导出时间；尚未导出的工作台从创建时间开始计算。浏览器只能确认应用已经生成导出并发起下载，不能证明文件仍存在于你选择的位置。该设置和时间戳只是本地元数据，不会上传。

## 清除浏览器数据的风险

清除 `yoesher.github.io` 的站点数据、重置浏览器配置文件或卸载时选择删除站点数据，可能同时移除 IndexedDB、设置与离线静态缓存。PWA 安装图标不是备份。请定期生成并实际验证加密备份。

当前托管地址使用共享的 `yoesher.github.io` 来源；浏览器按协议、主机和端口隔离 IndexedDB，而不是按仓库路径隔离。完整风险与未来迁移方案见[来源策略与迁移边界](../architecture/origin-strategy.md)。
