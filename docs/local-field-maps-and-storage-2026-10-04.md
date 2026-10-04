# 本地地图标注与附件容量 / Local field maps and storage

2026-10-04 · **应用 `0.4.0` 源码候选，尚未发布。** 公开网站当前已验收版本仍为 `0.3.1`，最终 S2 提交 `3e4967c3cbb05cf96f3bd72edd90ae1d78027a4f`。本地单元/集成测试 46 文件、422 项通过，审计 0 漏洞，Zotero 原命令 8/8 通过；实际浏览器与构建完整验收、发布决定、远端部署和线上验收待完成。下列流程描述新候选，实际状态见 [PROJECT_STATE.md](../PROJECT_STATE.md)。既有正式 GitHub Release/tag 为 `v0.3.0`，本轮不创建或移动标签。

## 选择适合的素材

这个入口让你导入自己有权使用的地图或研究草图，把既有田野点关联到图上的粗略位置。应用不提供全国底图、生产行政区目录、省市县浏览、在线瓦片、远程图像或 GPS，也不提供地图图像公开导出或托管。全国地图的权威来源、再分发许可、项目审图元数据和全国完整性四项门禁仍为 **BLOCKED / NOT TESTABLE**；本地素材工具没有完成这些门禁。历史证据见 [地图来源记录](zh-CN/map-data-sources.md)及 [ADR-026](../DECISIONS.md)。

请选择县域或更粗的研究示意图，或匿名公共研究场所。素材和标注不得包含参与者住宅、参与者精确位置或可识别身份的信息。图上的水平、垂直百分比不是经纬度，但详细底图仍可能识别具体地点；田野点别名和百分比坐标都不能保证匿名。

仅接受静态 PNG/JPEG。文件原始字节会保留，因此原有 EXIF/GPS 等元数据也可能进入工作台及备份；本工具不会自动清除元数据。请先检查并选择没有敏感位置或身份元数据的素材，再导入。本地保存和素材确认勾选不代表著作权、地图加工许可或审图已获批准；私人素材标注软件与公开地图服务的架构区分也不是法律免审结论。

## 登记与标注

1. 打开当前工作台，选好项目；在“田野工作”先登记使用别名的田野点。没有项目或同项目田野点时，先完成这些普通记录。
2. 进入“本地地图标注”（`#/fieldwork?view=maps`），选择“导入本地地图 / 草图”。填写“地图 / 草图标题”和“所属项目”，选择本地 PNG/JPEG。项目空间已选定时会沿用该项目。
3. 核对素材权利、粗略位置及参与者隐私边界，勾选确认。等待图像核验完成，再点“保存本地地图”。选择文件和保存是两个动作；保存失败时输入与已保存记录会保留。
4. 在“既有田野点（同一项目）”中选择一个田野点。点击图像选择位置，或在“水平位置（%）”“垂直位置（%）”填入 0 到 100；聚焦图像后也可用方向键调整。手机上可用选择器和百分比输入，避免依赖精确点击。
5. 点“保存 / 移动标注”才写入位置。再次标注同一田野点会替换该地图上的旧位置；点击已有标记只选择该田野点，不会自动移动它。
6. 选中田野点后查看“关联田野访问”“关联访谈”，使用“编辑田野点”“添加关联访问”或“添加关联访谈”进入现有记录表单。关系仍要求同一项目；标注只是关联入口，不生成新的访谈内容。

位置随保存的图像和记录持久化。刷新后重新选择相同工作台、项目和地图即可查看；切换项目只改变显示范围，其他项目的数据仍保留在整个工作台。

## 编辑、换图与删除

“编辑地图信息”可以只改标题等信息，不选择新图就保留原图。更换有标注的底图时，须明确勾选清空已有标注后才能保存；这些位置不会默默套用到新图，原田野点、访问和访谈记录仍保留。

“移除标注”和“删除本地地图”都有确认，仅移除标注或地图。若某田野点仍被地图引用，其删除或跨项目变更会被保护；先在相关地图移除标注，再处理该田野点。不要为了改变显示范围删除原始研究记录。

更换图片失败、格式不支持或保存失败时，原图和原有记录保持不变；请读取错误提示并保留当前输入。切换工作台、项目或遇到其他标签页修改后，可能需要返回正确上下文重新打开编辑表单，不能把失败当作成功保存。

## 容量与备份

| 对象 | `0.4.0` 候选上限与行为 |
| --- | --- |
| 本地 PDF | 每个 10 MiB；整个工作台 PDF 合计 20 MiB。原 `0.3.1` 为 5/12 MiB；Zotero 仍只交接书目元数据。点击 PDF 下载时才解码，不对每个列表行预先解码。 |
| 地图 / 草图图像 | 每个 2 MiB；整个工作台图像合计 4 MiB；单边最多 8,192 像素，总面积最多 1,600 万像素。真实格式、尺寸与解码必须符合要求；SVG、动画及远程图像不支持。 |
| 完整普通 JSON | 可读 UTF-8 JSON 最大 32 MiB，包含整个工作台、所有项目、PDF、图像和标注。超限明确拒绝，不截断附件，也不只导出当前项目。普通文件导入仍在读取前检查 32 MiB。 |
| 交互保存 | 保存后完整 JSON 在 32 MiB 内才允许增长；已有合法超限工作台可继续读取、迁移和不增加完整序列化大小的写入。更大附件或新增记录可能被拒绝，输入和原数据保留。 |
| 加密备份 | 同样保留完整工作台、PDF、图像与标注；沿用原 64 MiB 密文上限及封装防护，明文需为认证标签留空间。独立的 PDF/图像限额仍适用，不能当作无限容量。 |

1 MiB 是 1,048,576 字节。附件会用 base64 写入备份，体积约增加三分之一，其他记录与 JSON 格式还有额外开销。因此，即使分别未达到 PDF 20 MiB、图像 4 MiB，完整普通备份仍可能达到 32 MiB。

普通 JSON 和标准工作台数据库是明文，包含图像原始字节及可能存在的元数据；请勿公开上传研究备份。加密工作台与 `.sociologydesk` 备份使用现有认证加密流程，仍需保存并实际验证独立备份；本地持久化、PWA 安装和加密本身都不会生成第二份副本。应用不自动上传素材、标注或研究记录。

已有合法 v6 超限工作台不会因为新增普通 JSON 预算而被截断或拒绝读取/迁移。若它仍超过普通导出上限，可在原加密容量和附件约束内使用完整加密备份保全，再决定是否减少附件。普通 JSON 超限导出仍会拒绝；旧数据保全并不意味着能绕过普通导入文件上限或结构/关系验证。更大量 PDF 需要后续独立附件存储与分块认证备份/恢复设计，本轮没有实现，原 PDF 文件仍应保存在自己的资料目录中。

## 版本与日期

`0.4.0` 候选的 portable workspace、标准数据库和 authenticated encrypted payload 为 v7；v6 → v7 保留旧记录并增加空的本地地图集合，不推断图片或位置。加密 container、vault database、registry database 继续为 v1。备份包含所有项目，无论当前界面只显示哪个项目。

v7 备份需要支持 v7 的应用；当前公开 `0.3.1` 使用 v6，不能读取未来版本。测试候选前先保留可由原版本读取的备份；不要以重置工作台或覆盖原数据库作为回退方式。

页面打开时，“今天”和任务期限会在本地午夜、重新聚焦或从隐藏恢复可见时刷新。浏览器挂起后会在返回时校正；没有网页关闭后的系统通知、邮件提醒或后台推送。

## 遇到问题时保留数据

- **找不到记录：** 检查工作台、项目空间、选中的地图、田野点和页面筛选；切换到全部项目再核对。显示投影不等于删除；没有读取用户真实数据库，不能声称原先找不到的文献已经恢复。
- **图像被拒绝：** 保留原图；选择更小的静态 PNG/JPEG，核对像素和文件大小。不要仅更改扩展名，也不要通过远程链接替代。
- **容量错误：** 保留当前表单和原文件，先生成并验证允许范围内的完整加密备份，再考虑移除不需要随工作台保存的附件或选择较小图像。不要清空其他项目来让当前项目保存成功。
- **保存或跨标签页冲突：** 确认错误后回到正确工作台/项目，核对最新记录，再重新编辑；不要重置工作台或重复导入替换原数据。
- **尚无地图或地图不适合：** 继续使用既有田野点、访问、访谈和笔记表单。地图工具是可选入口；全国底图条件未形成闭环，也不影响普通田野记录保存。

## English brief

**0.4.0 is an unreleased source candidate dated 2026-10-04.** The verified public website is still 0.3.1 at final S2 commit `3e4967c3cbb05cf96f3bd72edd90ae1d78027a4f`. Local unit/integration tests passed 46 files / 422 tests, audit found zero vulnerabilities and the original Zotero command passed 8/8. Complete browser/build acceptance, the publication decision, exact-SHA remote gates and public acceptance remain pending. No new formal Release or tag is created or moved.

In Fieldwork → Local map annotations, first register a field site, then import a PNG/JPEG map or sketch you are entitled to use. Enter a title/project, confirm the rights and coarse-location boundary, and save. Select an existing same-project site, click the image, enter horizontal/vertical percentages, or focus the image and use arrow keys; then choose **Save / move annotation**. Clicking a marker selects its site without moving it. Linked visits/interviews and site editing reuse the existing forms. Re-marking replaces that site's point; replacing an annotated image requires explicit clearing. Removing a map or marker keeps the original site/visit/interview records. Referenced site deletion or project reassignment is protected; failed saves keep drafts and committed data.

Use county-level-or-coarser research sketches or anonymous public settings only. Exclude participant homes, exact participant locations and identifiers. Normalized image positions are not geographic coordinates or an anonymity guarantee. Original bytes, including possible EXIF/GPS metadata, are retained: choose metadata-safe material before importing. Local storage and the rights checkbox do not certify a license, legal compliance or map-review exemption. No nationwide administrative browsing, bundled boundaries/catalog, remote tiles/API, GPS acquisition or public map-image export is provided; all four national map gates remain **BLOCKED**.

Limits are **2 MiB per image / 4 MiB per full workspace**, at most **8,192 pixels per edge / 16 million pixels**; static PNG/JPEG only, with bounded format/dimension validation and real decoding. PDF limits are **10 MiB per file / 20 MiB per workspace**, decoded when downloading. Complete readable ordinary JSON is capped at **32 MiB**, including every project and base64 attachment. Export and further interactive growth fail explicitly without truncation. Existing valid over-budget workspaces remain readable/migratable and allow non-growing writes; ordinary file-import preflight is still 32 MiB. Complete authenticated encrypted backup retains its existing **64 MiB ciphertext** ceiling and independent attachment limits. These bounds do not make the app a large PDF library; independent attachment storage and chunked authenticated backups are future work.

Portable/standard/authenticated payload advance to **v7**, adding an empty map collection to v6 without inventing data; container/vault/registry remain v1. Both ordinary and encrypted backups include images, markers and all projects. Ordinary JSON is plaintext. A v7 backup requires a v7-capable application; keep a tested original-version backup before candidate use. Do not reset/replace a workspace to troubleshoot or roll back. If records appear absent, check workspace/project/map/filter context first; no recovery of unseen user data is claimed. Open-page local dates refresh at midnight/focus/visibility; there are no closed-webpage notifications.
