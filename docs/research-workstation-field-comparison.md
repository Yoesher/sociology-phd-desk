# 定性田野、地图、文献与研究交接工具：官方资料对照

核对日期：2026-10-04。基线为 真实原仓库 的应用 0.4.1，HEAD `656b99ac708760b4aae684be8c4b19a95c7608a2`，只读状态检查无未提交修改。按 README → PROJECT_STATE → DECISIONS → NEXT_TASKS → AGENTS 阅读；本报告没有改源码、运行第三方产品、操作用户浏览器数据库或发布任何内容。检索时点是实施前的基线审查；本轮实施目标为0.5.0。

这是一组覆盖不同研究环节的公开网络检索，采用开发者官网、正式手册及维护者仓库；不把官网功能说明当作实机性能或隐私认证。没有把 MAXMaps 的概念图、QGIS 的地理坐标地图、工作站的本地匿名草图混称为同一种地图，也没有声称穷尽全网所有工具。

## 七款产品的实际功能与边界

| 产品 | 官方资料支持的能力 | 需要保留的边界 | 对工作站的启发 |
| --- | --- | --- | --- |
| **Zotero** | 附件区分存储副本与外部链接；书目条目、笔记、附件是不同对象。自身批注存于数据库，可导出带嵌入批注的 PDF。[附件模型](https://www.zotero.org/support/kb/library_items)、[批注模型](https://www.zotero.org/support/kb/annotations_in_database) | Zotero 官方明确书目导出不是完整备份：重导入可能改变日期、字段及原文字处理文档的引用链接。备份需要数据目录及附件，按需下载的文件可能未在本机。[导出边界](https://www.zotero.org/support/kb/exporting)、[数据目录备份](https://www.zotero.org/support/zotero_data) | 保留书目元数据交接边界；让用户清楚地区分阅读清单、附件和可恢复工作台。不要把工作站的 PDF 附件功能宣称为 Zotero 批注/引用替代品。 |
| **Taguette** | 文档片段高亮、标签、标签层级、合并标签；按标签查看片段时可回到原文档。可导出代码本、片段与文档；完整项目用 SQLite3 导出/导入。[使用及导出](https://www.taguette.org/getting-started.html) | 本机安装可离线单人使用，协作属于服务器模式；文档转换依赖 Calibre/HTML 流程，并非原始 PDF 页面批注的等价复制。[本机安装](https://www.taguette.org/install.html) | 检索结果应保留来源对象和回到原模块入口。导出当前视图与完整项目备份必须使用不同名称。 |
| **QualCoder** | 本地客户端可编码文本、图像、音视频，记录 journal/memo，组织编码树、生成编码者比较和报告；项目文件夹含 SQLite 数据库与材料文件。[维护者手册](https://github.com/ccbogel/QualCoder/wiki)、[报告](https://github.com/ccbogel/QualCoder/wiki/5.3.-Reports) | 维护者明确项目由一个人一次打开；协作交接使用整个 .qda 文件夹。跨工具 REFI-QDA 可能丢失产品特有功能，不能替代同工具完整项目交接。编码树图不等于地理地图。[项目及协作边界](https://github.com/ccbogel/QualCoder/wiki) | 导航与报告要基于稳定对象 ID 和真实关联，不从名称猜关系。工作站继续承担研究对象组织，不临时复制一套全文编码软件。 |
| **MAXQDA / MAXMaps** | MAXMaps 可放置文档、编码、备忘录等研究对象及背景图；Geolinks 将对象连接到 KML 地点，KML 纳入项目，点击可打开外部地图。[图与研究对象](https://www.maxqda.com/help/maxmaps/objects-in-maxmaps)、[Geolinks](https://www.maxqda.com/help/links/geolinks?view=full) | MOD 跨项目导入会失去原项目对象关联；超过内部图像限额的素材走外部文件目录并需随 ZIP 交接。REFI-QDA 文本会转为纯文本，PDF 文本编码等存在导出限制。[地图交接](https://www.maxqda.com/help/maxmaps/exporting-and-printing-maps)、[REFI 限制](https://www.maxqda.com/help/report-and-export/export-and-import-refi-qda-projects) | 借鉴“选图上对象→看研究材料”的关联导航；不引入参与者地理坐标或 Google 地图调用。导出时不能只保存一张图而丢掉材料关系。 |
| **ATLAS.ti 桌面版** | 内部保存与外部 Project Bundle 是不同动作；完整 bundle 可含文档和编码、备忘录、评论、网络与链接；报表和 QDPX 是另外的导出路径。[项目管理](https://manuals.atlasti.com/Win/en/manual/Project/ProjectManagement.html)、[备份](https://manuals.atlasti.com/Win/en/manual/Project/ProjectManagementBackup.html)、[报告类型](https://manuals.atlasti.com/Win/en/manual/Reports/ReportTypes.html) | 新版项目不能由旧版直接打开；部分 bundle 可排除大音视频或链接材料，不能见到“导出成功”就推断完整。项目云是另一项能力，本轮不采用。[备份与部分 bundle](https://manuals.atlasti.com/Win/en/manual/Project/ProjectManagementBackup.html) | 完整性应验证记录数、稳定 ID、关系和附件字节，而非只验证下载动作。当前普通/加密全工作台备份保持完整；阅读摘要只是派生输出。 |
| **QGIS** | 管理栅格/矢量、图层属性、视图、关系和制图输出；GeoPackage 是 SQLite 容器，可存矢量、栅格、属性及项目。[数据格式](https://docs.qgis.org/3.44/en/docs/user_manual/managing_data_source/supported_data.html)、[项目与输出](https://docs.qgis.org/3.44/en/docs/user_manual/introduction/project_files.html) | .qgz 包含项目 XML 与辅助 SQLite，不保证外部数据源齐全；移动文件、数据库/服务不可用会造成断链。地图图片/PDF 是输出，不自动成为完整项目备份。[断链及项目结构](https://docs.qgis.org/3.44/en/docs/user_manual/introduction/project_files.html) | 精确 GIS 分析继续交给专业工具。工作站只保存有权使用的粗粒度匿名素材和图内百分比，不推断 CRS、经纬度或行政层级。 |
| **Omeka S / Mapping** | items 可表示地点、事件或对象，并互相关联；Mapping 支持图上标注、按查询聚合、点位与资源关联以及时间线。[资源关系](https://omeka.org/s/docs/user-manual/content/items/)、[Mapping 手册](https://omeka.org/s/docs/user-manual/modules/mapping/) | 它是网站出版系统，Mapping 面向公开页面，默认底图 OpenStreetMap.Mapnik 来自外部供应者且无服务保证；坐标/公开标签不是匿名性的保证。[产品定位](https://omeka.org/s/docs/user-manual/)、[底图和公开显示](https://omeka.org/s/docs/user-manual/modules/mapping/) | 借鉴“对象清单＋关联阅读”，不搬入服务器、公共展览、在线瓦片或精确位置查询。研究工作台材料继续留在本地。 |

资料版本限定：ATLAS.ti 本次当前网页标题为 26 Windows 手册；QGIS 采用能实际读取的 3.44 版本文档，未把它推断为最新发行版本；MAXQDA 使用当前 /help 路径而非搜索出现的 MAXQDA 12/旧 PDF。尝试的 QGIS 3.40 georeferencer HTML 未得到正文，相关能力没有据该空页面写入结论。涉及价格、用户数、版本排名及商业软件登录/许可证行为，本次不作推断。

## 0.4.1 已有基础：不重复开发

- 田野草图已经支持 PNG/JPEG 导入、项目归属、同项目田野点标注、键盘与百分比定位、保存/移动/移除，以及查看关联访问/访谈和新增关联记录。地图/标注删除不会删除田野点；替换图片需明确清空标注。现有 `LocalFieldMaps.tsx` 的关联访问/访谈条目是文字列表，尚不能直接打开已有记录；田野点选择是下拉框，没有同图“已标注/未标注”可检索清单。
- 文献已经有题名、作者、期刊、阅读理由、备注检索及状态/优先级过滤、编辑和 PDF 下载。容量显示使用完整 fullData，并非当前项目投影；已有 PDF 与完整 JSON 两个计量器，不把“增加容量提示”再写成全新功能。
- 截止日期、未来七天、逾期天数、编辑备注和完成状态已实现；本地午夜/focus/visibility 刷新已实现。关闭网页的系统通知仍没有实现，不把前台日历刷新与后台通知混称为提醒。
- 普通/认证加密备份保留全部 19 集合、所有项目、图像/PDF/标注；格式轴保持 v7/v1。当前 PDF 单个10/总20 MiB、图像单个2/总4 MiB、普通完整 JSON32 MiB和加密密文64 MiB边界不变。外观设置属于浏览器偏好，不进入研究备份。
- 本地地图没有经纬度、行政区目录、全国底图、在线瓦片或 GPS；导入不自动清理 EXIF/GPS，不确认法律授权或地图审查通过。全国地图的来源/许可/审查/完整性四门禁仍 BLOCKED。不得以别的产品“也能显示地图”作为放行依据。

源码依据：`src/features/fieldwork/LocalFieldMaps.tsx`、`FieldworkPage.tsx`、`src/features/literature/LiteraturePage.tsx`、`src/features/today/TodayPage.tsx`、`src/app/WorkspaceCenter.tsx`、`src/models/domain.ts`、`src/utils/workspace-capacity.ts`。原模块已存在访问/访谈编辑表单，可复用；无需另造第二套写入接口。

## 本轮建议：先完成两个只读导航能力，第三项作为可选后续

以下是对官方模式与本地源码的产品推断，不是声称这些工具提供完全相同的功能。

### 1. 研究对象导航，地图关联放在首位

用一个“研究导航”弹窗承接跨模块检索，不加第三层侧栏或第三方服务。默认只检索当前项目，用户明确选“检索所有项目”才展示别的项目；检索题名/别名、阅读理由、研究备注及结构化描述，结果说明类型和项目。图像/PDF base64、口令、注册表敏感字段、原始浏览器路径、外观设置不加入索引。

选择地图显示素材标题、同图关联田野点和同项目访问/访谈；选择点位可继续看关联记录，并跳到原模块。研究问题、主张、备忘录及其他对象使用明确 ID 的真实关系，不以同名、近似文字或 AI 推测生成关系。点击结果、关系或原模块入口不修改研究数据。

最低设计：17 种研究对象的只读派生索引；不持久化搜索词/全文索引，不新增数据库状态，锁屏/工作台切换立即销毁当前索引和选中详情。手机使用同一个弹窗，保留焦点/键盘关闭与完整英文；快捷键不劫持输入框或其他弹窗。

验收：两个合成项目含相同查询词但不同备注；默认范围只见本项目，明确跨项目后能查到第二项目；地图→点位→访问/访谈准确到稳定 ID；无坐标旧田野点正常出现且不生成虚假标注。检索前后导出的全工作台 JSON 去掉 exportedAt 后深比较完全相同，普通/加密刷新仍完整；锁屏后结果消失，解锁不得残留上一个工作台内容。

### 2. 项目研究概览与覆盖缺口

在同一研究导航中提供“项目概览”：按真实记录计数，显示研究问题、文献、田野点/图、访谈、分析、证据、主张和论文对象；点计数进入对应检索，不新增平行页面。先用“数量＋可打开记录”构成最小版本。后续可补同图“已标注/未标注”与访谈处理阶段，但不得从数量计算未经定义的研究质量评分，也不得自动推断证据支持主张。

地图选点若无关联访谈/访问，说明“尚未登记”并回到现有创建入口；没有图像的旧田野点仍计入田野点数，而不计入图像标注数。任务统计沿用现有完成/期限逻辑，今日共同目标不误算为每个项目的独立目标。

验收：A/B 项目分别有已标注、未标注和无坐标旧点；项目数与 JSON 实际 ID 集合一致。点击概览的类型计数只改变检索视图。研究导航隐藏空模块时仍能查看零计数，不将视图过滤传入 full-snapshot 写入/备份。离线打开、手机390×844、较大/更大字号与英文均可操作且无水平溢出。

### 3. 可读研究交接摘要：先设计，不强挤进导航首版

从当前项目派生一份可读 Markdown 摘要，标明项目、对象计数、日期、已列出的稳定对象关系和任务期限，默认不带私密备注、PDF/图片或精确位置信息。名称必须是“研究摘要”，明确它不能恢复完整工作台；完整普通/加密备份入口与语义不变。后续文献阅读表可提供受控 CSV/RIS/BibTeX 交接，但没有经过字段/公式/编码/再导入验证前不宣称 Zotero 往返无损。

CSV 如纳入实现，须验证公式样式前缀、引号/换行、Excel 重新保存行为；不为输出安全而改写数据库原文本。仅加双引号不能自动证明不会被解释为公式。[OWASP 官方测试与边界](https://wstg.owasp.org/latest/4-Web_Application_Security_Testing/07-Injection/21-CSV_Injection/)

验收：摘要与完整备份同时导出，前者明示派生范围，后者仍含所有项目/PDF/地图。UTF-8 中英、逗号/引号/换行和超长摘要可读，文献缺 DOI/年/PDF 时留空，不填造 DOI 或文件。导出前后 JSON 保持相同，不向网络上传。

## 后续路线图与明确不纳入项

| 顺序 | 用户收益与最小验证 | 边界 |
| --- | --- | --- |
| 下一步 | 地图同图点位列表、已标注/未标注筛选、已有访问/访谈详情直达；大素材本地放大/平移须保持 x/y 百分比语义并实测触摸/键盘 | 不引入 GPS、在线地名解析、精确坐标或行政层级；不把静态图片缩放误当地理定位 |
| 下一步 | 素材来源、版本、权利/用途说明的可选记录，旧资料显示“未登记” | 新持久化字段须定义版本和完整迁移；声明不是授权审查结论，保持 EXIF 风险明确 |
| 后续 | 期限导出 .ics 到用户自选日历；只在用户点击时本地下载，不使用云推送 | iCalendar RFC5545 区分 DATE 与时间、VTODO 截止语义及 VEVENT 非含结束日；需按实际目标客户端验证，不承诺关闭网页后的通知由本站提供。[官方标准](https://www.rfc-editor.org/rfc/rfc5545.html) |
| 后续 | 独立附件存储与分块认证备份，减少 base64 全工作台内存开销 | 先验证桌面/手机大库内存、完整迁移、认证失败不写入与原版本恢复，再评估容量；本轮不简单调大20/32 MiB |
| 单独立项 | 显式 Evidence↔Claim↔Manuscript 跟踪和轻量引文/片段引用，保留原材料 ID | 不把任意备注升级为证据，也不声称已完成 NVivo/Taguette/QualCoder 式全文编码或 QDPX 无损互操作 |
| 持续阻断 | 全国地理底图与公开地图 | 完成项目既定四门禁前不发布；地方草图工具不绕过门禁 |

本轮优先把已有记录“找得到、看得懂、回得去”，保留现有表单作为唯一写入口；无需账户、云同步、AI API、全文转录、自动参与者定位或新的通用 Todo 状态。检索/概览先作为纯派生视图完成真实桌面/触摸浏览器验证，再走最终 SHA 的 CI、CodeQL、Pages、完整备份与原生更新保留验收。
