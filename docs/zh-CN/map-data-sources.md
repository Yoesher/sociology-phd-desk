# 中国研究地图：数据来源与合规门禁

> 状态：**BLOCKED**
> 核验日期：2026-08-12；v0.3.0 发布时复核：2026-08-15
> 适用范围：Phase 3D / Issue [#8](https://github.com/Yoesher/sociology-phd-desk/issues/8) 与发布时 Issue [#37](https://github.com/Yoesher/sociology-phd-desk/issues/37)，均为 `CLOSED_NOT_PLANNED`
> 收口状态：仅文档 [PR #16](https://github.com/Yoesher/sociology-phd-desk/pull/16) 已合并为 [`ca4429f`](https://github.com/Yoesher/sociology-phd-desk/commit/ca4429facfa124e85c3dba37f9ce7da270a82601)，exact-`main` CI 与 Pages 通过；没有地图交付。

本文件记录中国研究地图在提交任何生产行政区目录、边界几何或公开交互地图之前必须通过的来源、许可、审图和完整性核验。它不是法律意见；涉及地图公开展示、数据再分发或格式转换时，维护者仍需取得主管部门或合格地图服务机构的正式确认。

## 当前门禁

| 门禁 | 结果 | 说明 |
| --- | --- | --- |
| `MAP_SOURCE_VERIFIED` | `BLOCKED` | 已找到权威标准地图和基础地理数据，但没有找到同时满足项目层级、公开再分发与交互转换要求的已核验来源组合。 |
| `MAP_LICENSE_VERIFIED` | `BLOCKED` | 官方基础地理数据服务条款未授予将数据打包进 GitHub 仓库、GitHub Pages、公开分叉与归档的再分发权。 |
| `MAP_APPROVAL_METADATA` | `BLOCKED` | 项目尚无针对最终桌面、移动、缩放、配色和交互形态的审图批准文件、审图号、批准样图、日期和有效期。 |
| `NATIONAL_MAP_COMPLETENESS` | `BLOCKED / NOT TESTABLE` | 在没有获准的最终资产前，无法验证全国省—地—县层级、港澳台、南海诸岛、钓鱼岛及移动端不裁切等完整性要求。 |

任一门禁不是 `PASS`，Phase 3D 地图实现就不能合并或部署。中国研究地图因此暂缓实施并排除在 `v0.2.0` 之外；该结论不阻塞本版本中的理论研究、导航、论文与投稿整合或稳定化工作。

## 2026-08-15 发布时复核

维护者针对 `v0.3.0` 只对已知官方一手页面进行了窄范围复核，没有下载数据、批量采集目录、登录地图服务或执行爬虫：

- [1:100 万公众版基础地理信息数据](https://www.webmap.cn/commres.do?method=result100W)仍明确说明下载内容是矢量数据而非最终地图，公开成图须依法履行地图审核程序。
- [全国地理信息资源目录服务条款](https://www.webmap.cn/main.do?clickFlag=about&method=otherService)仍规定，未经主管机构允许，不得有偿或无偿转让数据，也不得将其作为向外分发的数据库、产品或服务的一部分。
- [标准地图服务](https://bzdt.tianditu.gov.cn/)没有向本项目提供覆盖响应式交互转换、GitHub 仓库、Pages、分叉与归档的书面许可；项目也没有最终成品的审图号、批准样图、有效期和资产哈希。
- [民政部行政区划代码服务](https://dmfw.mca.gov.cn/XzqhVersionPublish.html)仍不能替代边界几何权利、公开地图审图或港澳台完整下级层级来源。

因此四项结果原值保留。发布时 Issue [#37](https://github.com/Yoesher/sociology-phd-desk/issues/37#issuecomment-5300741522)按 `not planned` 关闭；这表示实施条件未满足，不表示地图已完成。由于本轮冻结合同把地图设为 `v0.3.0` 必选项，`v0.3.0` 处于 **BLOCKED / NOT RELEASED**，不得创建发布分支、tag 或 GitHub Release。

## 候选来源核验

### 1. 自然资源部标准地图服务

- **Provider / URL：** 自然资源部标准地图服务，<https://bzdt.tianditu.gov.cn/>
- **Dataset：** 带审图号的标准地图下载与自助制图服务。
- **Coverage / level：** 提供全国标准地图展示，但不是本项目所需的省—地—县结构化目录与可编辑几何的开放数据授权。
- **Version / date：** 网站当前提供的具体标准地图版本和审图号随所选产品而异；项目尚未选定、下载或提交任何资产。
- **License / redistribution：** 官方说明允许直接使用带审图号的标准地图；放大、缩小、裁切等编辑以及自助制图输出在公开使用前需要送审。网站页脚同时限制未经许可的复制或镜像。没有证据表明可把地图转换成响应式 SVG、GeoJSON 或其他交互资产后以 MIT 仓库内容公开再分发。
- **Approval metadata：** 项目没有针对最终展示形态的审图材料或审图号。网站或原标准地图的审图号不能自动覆盖本项目转换后的交互实现。
- **Transformations：** 当前未执行。计划中的简化、裁切、重新投影、配色、分层、响应式缩放和交互高亮均必须先获得明确许可并纳入审图。
- **Limitations / update path：** 仅“原样直接使用”与本项目交互需求不兼容；需通过正式审图服务或合格地图服务机构确认后续版本与更新流程。
- **Gate result：** `BLOCKED`。

### 2. 全国地理信息资源目录服务：1:100 万公众版基础地理信息数据

- **Provider / URL：** 全国地理信息资源目录服务，<https://www.webmap.cn/commres.do?method=result100W>
- **Dataset：** 1:100 万公众版基础地理信息数据（2021 版，数据现势性标注为 2019 年），含行政境界等基础矢量层，并覆盖台湾、海南、钓鱼岛及南海诸岛等全国范围要素。
- **Coverage / level：** 全国基础地理信息；页面并未证明它能够独立提供本项目要求的、当前有效的完整省—地—县研究目录及港澳台下级层级。
- **Version / date：** 2021 版；现势性 2019 年。
- **License / redistribution：** [服务条款](https://www.webmap.cn/main.do?clickFlag=about&method=otherService)只授予有限、非排他的使用权；未经主管机构许可，不得有偿或无偿转让，也不得把数据作为向外分发的数据库、产品或服务的组成部分。该条款不支持直接打包进 GitHub、Pages、公开分叉或归档。
- **Approval metadata：** 页面明确提示，该数据是基础矢量而非最终地图；据此编制并公开的地图仍须依法送审。项目尚无批准记录。
- **Transformations：** 当前未下载、转换或提交。任何抽取、简化、裁切、重新投影或生成前端资产的行为均待书面权利确认和审图。
- **Limitations / update path：** 数据现势性与当前行政区划之间存在时间差；使用时还需建立年度代码和边界更新流程。
- **Gate result：** `BLOCKED`。

### 3. 民政部行政区划代码

- **Provider / URL：** 民政部行政区划代码服务，<https://dmfw.mca.gov.cn/XzqhVersionPublish.html>
- **Dataset：** 中华人民共和国县以上行政区划代码；当前页面标注统计时点截至 2025-12-31。历史 2023 页面：<https://www.mca.gov.cn/mzsj/xzqh/2023/202301xzqh.html>。
- **Coverage / level：** 可支持内地县以上行政区划与 34 个省级代码的核对。官方历史页明确说明香港、澳门、台湾的地市和区县信息暂缺，因此不能单独满足完整 drill-down。
- **Version / date：** 当前服务按年度发布；本项目尚未固化或提交任何生产快照。
- **License / redistribution：** 当前核验未找到足以覆盖仓库再分发、公开分叉、长期归档与衍生数据发布的明确许可文本。
- **Approval metadata：** 行政区划代码不是地图审图批准，也不授予边界几何权利。
- **Transformations：** 当前未抓取或生成目录；没有对缺失港澳台下级层级进行任何推断或补造。
- **Limitations / update path：** 没有官方英文名称字段；不能运行时机翻后冒充来源字段。代码更新管理可参考[《行政区划代码管理办法》](https://www.moj.gov.cn/pub/sfbgw/flfggz/flfggzbmgz/202512/t20251204_528920.html)，但仍需另行解决再分发与地图边界权利。
- **Gate result：** `BLOCKED`。

### 4. 香港政府开放数据：行政区界线

- **Provider / URL：** 香港特别行政区政府资料一线通，<https://data.gov.hk/en-data/dataset/hk-had-json1-hong-kong-administrative-boundaries>
- **Dataset：** 香港行政区界线数据。
- **Coverage / level：** 仅覆盖香港本地，不能解决全国来源或台湾、澳门层级。
- **Version / date：** 以数据集页面当前元数据为准；本项目未下载或固化版本。
- **License / redistribution：** [使用条款](https://data.gov.hk/en/terms-and-conditions)允许在条件约束下使用和再分发，但该来源不是本仓库 MIT 许可的一部分，且不能扩展为其他地区的权利授权。
- **Approval metadata：** 地方开放数据条款不替代全国地图最终展示的审图要求。
- **Transformations：** 当前未执行。
- **Limitations / update path：** 只能作为将来获准方案中的局部来源；需要单独保留署名、版本和条款记录。
- **Gate result：** `BLOCKED`（全国门禁未满足）。

### 5. 澳门特别行政区地图绘制暨地籍局：地理及土地界线

- **Provider / URL：** 澳门地图绘制暨地籍局，<https://www.dscc.gov.mo/zh-hans/geo_land_boundary_details/article/geo_land_boundary.html>
- **Dataset：** 澳门地理及土地界线官方资料。
- **Coverage / level：** 仅澳门本地。
- **Version / date：** 以官方页面当前发布信息为准；本项目未固化版本。
- **License / redistribution：** 当前核验没有得到允许将边界数据纳入 MIT GitHub 仓库、公开分叉与 Pages 的明确许可。
- **Approval metadata：** 未获得适用于本项目最终交互地图的审图文件。
- **Transformations：** 当前未执行。
- **Limitations / update path：** 权威性不等于开放再分发权；需书面许可和版本更新安排。
- **Gate result：** `BLOCKED`。

### 6. 地图管理法规与公开地图内容规范

- **Provider / URL：** [《地图管理条例》](https://www.gov.cn/zhengce/zhengceku/2015-12/14/content_10403.htm)、[地图审核管理规定](https://www.mfa.gov.cn/web/wjb_673085/zzjg_673183/bjhysws_674671/bhflfg/dtdmxgfl/202303/P020230313586143347764.pdf)、[公开地图内容表示规范](https://www.mfa.gov.cn/web/wjb_673085/zzjg_673183/bjhysws_674671/bhflfg/dtdmxgfl/202303/P020230313585504979937.pdf)。
- **Requirement：** 直接使用主管部门提供的具有审图号的公益性地图且未改变内容时，可适用相应规定；编辑、交互化或重新编制的成品不能据此推定免审。全国地图和涉及港澳台的地图审核具有专门权限要求，互联网地图审图号存在有效期要求。
- **Completeness：** 公开地图内容规范要求正确表示中国大陆、海南岛、台湾岛、南海诸岛、钓鱼岛等重要要素；规范本身不是边界数据许可。
- **Service path：** 国家政务服务平台地图审核事项：<https://gjzwfw.www.gov.cn/fwmh/item/v3/item_11100000MB032716991000115035000.do>。页面列示申请材料、最终样图和资质材料等要求，并标注法定办理时限；具体适用性需由主管部门确认。
- **Gate result：** `BLOCKED`。

## 未采用的替代方案

- 不采用来源不明或授权不覆盖本项目的 GitHub、GADM、Natural Earth 等边界数据来“先做出来”。
- 不手绘中国轮廓，不补画岛屿，不用随机矩形、空 SVG、灰色剪影或伪造行政区层级冒充全国地图。
- 不把标准地图截图裁切、描摹或转换成 SVG/GeoJSON。
- 不请求外部地图瓦片或 API，不引入 API key，也不向地图服务发送项目、备注、别名或任何研究内容。
- 不把测试用 `TEST-*` / `DEMO-*` 合成层级放入生产包，也不把合成测试称为全国完整性证明。

## 解阻条件

Phase 3D 只有在以下证据全部落盘并经维护者复核后才可继续实现和公开部署：

1. 确定最终权威来源或具有相应资质的地图服务机构，并固定数据集名称、版本、发布日期和内容哈希。
2. 取得书面许可，明确覆盖 GitHub 仓库、GitHub Pages、全球公开访问、分叉、归档、格式转换、抽取、简化、配色、响应式缩放和交互展示。
3. 针对最终桌面、移动、缩放、覆盖层和交互成品完成地图审核，记录审图号、批准样图、批准日期、有效期、续期责任和资产哈希。
4. 分别解决全国年度行政区代码和港澳台层级来源；没有来源的层级保持不存在，不得推断或虚构。
5. 自动和真实浏览器检查覆盖 34 个省级单位、港澳台、南海诸岛、钓鱼岛、普通省/自治区/直辖市/SAR/台湾来源路径、县级终止和所有目标视口不裁切。
6. 保证行政区目录与几何只从同源静态、已批准资产加载；用户研究数据继续保存在当前本地工作台，不进入地图资产或外部服务。

## 当前仓库边界

本次 BLOCKED 收口只提交了文档与项目状态记录。PR #16 已合并，Issues #8/#37 已按 `not planned` 关闭；这些流程状态不会把任何门禁改成 PASS。仓库中不得新增 `public/map/**`、中国 SVG/GeoJSON/TopoJSON、行政区生产主数据、外部地图请求或启用地区写入的生产代码。Phase 3D 在自身门禁通过前保持暂缓；本轮地图必选的 `v0.3.0` 不能发布。
