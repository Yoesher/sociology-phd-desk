# China Research Map: data-source and compliance gate

> Status: **BLOCKED**
> Reviewed: 2026-08-12
> Scope: Phase 3D / Issue [#8](https://github.com/Yoesher/sociology-phd-desk/issues/8)

This file records the provenance, licensing, map-review, and completeness evidence required before the China Research Map may ship any production administrative catalog, boundary geometry, or public interactive map. It is not legal advice. Public map display, data redistribution, and format conversion still require formal confirmation from the competent authority or a qualified mapping provider.

## Current gates

| Gate | Result | Reason |
| --- | --- | --- |
| `MAP_SOURCE_VERIFIED` | `BLOCKED` | Authoritative standard maps and base geographic data exist, but no source set has been verified to satisfy the required hierarchy, public redistribution, and interactive-transformation scope. |
| `MAP_LICENSE_VERIFIED` | `BLOCKED` | The official base-data terms reviewed do not grant redistribution through a GitHub repository, GitHub Pages, public forks, and archives. |
| `MAP_APPROVAL_METADATA` | `BLOCKED` | The project has no approval file, map-review number, approved specimen, date, or validity period for its final desktop, mobile, zoom, color, and interaction design. |
| `NATIONAL_MAP_COMPLETENESS` | `BLOCKED / NOT TESTABLE` | Without an approved final asset, the province–prefecture–county hierarchy, Hong Kong, Macao, Taiwan, South China Sea islands, Diaoyu Dao, and no-cropping requirements cannot be tested. |

If any gate is not `PASS`, Phase 3D cannot merge or deploy, Phase 3E/3F cannot begin, and `v0.2.0` cannot be created.

## Candidate-source review

### 1. Ministry of Natural Resources Standard Map Service

- **Provider / URL:** Ministry of Natural Resources Standard Map Service, <https://bzdt.tianditu.gov.cn/>.
- **Dataset:** Downloadable standard maps carrying map-review numbers and a self-service map-making facility.
- **Coverage / level:** National standard-map presentation, not an open-data grant for the structured province–prefecture–county catalog and editable geometry this project requires.
- **Version / date:** Varies with the selected standard-map product. The project has not selected, downloaded, or committed an asset.
- **License / redistribution:** Official guidance permits direct use of standard maps carrying review numbers. Editing—including enlargement, reduction, or cropping—and self-service output requires review before public use. The site footer also restricts copying or mirroring without permission. No evidence grants conversion to responsive SVG, GeoJSON, or another interactive asset followed by redistribution as MIT repository content.
- **Approval metadata:** The project has no review record or number for its final presentation. A site or source-map review number does not automatically approve a transformed interactive implementation.
- **Transformations:** None performed. Simplification, cropping, reprojection, recoloring, layering, responsive scaling, and interactive highlighting require explicit permission and review first.
- **Limitations / update path:** “Direct use without alteration” does not satisfy the product interaction contract. A competent authority or qualified map service must confirm the review and renewal process.
- **Gate result:** `BLOCKED`.

### 2. National Catalogue Service for Geographic Information: 1:1,000,000 public base data

- **Provider / URL:** National Catalogue Service for Geographic Information, <https://www.webmap.cn/commres.do?method=result100W>.
- **Dataset:** 2021 edition of the 1:1,000,000 public basic geographic information dataset, with currency marked as 2019. It includes administrative-boundary and other base vector layers and describes national coverage including Taiwan, Hainan, Diaoyu Dao, and the South China Sea islands.
- **Coverage / level:** National base geography. The page does not establish that this dataset alone provides a current and complete research hierarchy down to county level for the mainland, Hong Kong, Macao, and Taiwan.
- **Version / date:** 2021 edition; 2019 currency.
- **License / redistribution:** The [service terms](https://www.webmap.cn/main.do?clickFlag=about&method=otherService) grant a limited, non-exclusive right of use. Without permission from the competent authority, data may not be transferred for payment or free of charge or included in a database, product, or service distributed externally. This does not authorize bundling in GitHub, Pages, public forks, or archives.
- **Approval metadata:** The service identifies the download as base vectors rather than a finished map. A map compiled from it for public display remains subject to review. The project has no approval record.
- **Transformations:** Nothing has been downloaded, converted, or committed. Extraction, simplification, cropping, reprojection, and frontend asset generation will not be used or committed until written rights and map-review requirements are confirmed.
- **Limitations / update path:** The dataset’s currency predates current administrative divisions; any use would require an annual code and boundary update plan.
- **Gate result:** `BLOCKED`.

### 3. Ministry of Civil Affairs administrative-division codes

- **Provider / URL:** Ministry of Civil Affairs division-code service, <https://dmfw.mca.gov.cn/XzqhVersionPublish.html>.
- **Dataset:** Codes for administrative divisions at and above county level in the People’s Republic of China. The current service states a 2025-12-31 statistical cut-off. Historical 2023 page: <https://www.mca.gov.cn/mzsj/xzqh/2023/202301xzqh.html>.
- **Coverage / level:** It can support verification of mainland divisions at and above county level and the 34 province-level codes. The official historical page says prefecture/county information for Hong Kong, Macao, and Taiwan is temporarily unavailable, so it cannot support complete drill-down on its own.
- **Version / date:** Published by year; the project has not frozen or committed a production snapshot.
- **License / redistribution:** This review did not find an explicit grant covering repository redistribution, public forks, long-term archives, and derived-data publication.
- **Approval metadata:** Administrative codes are not map-review approval and do not grant geometry rights.
- **Transformations:** No catalog has been scraped or generated. Missing Hong Kong, Macao, or Taiwan levels have not been inferred or invented.
- **Limitations / update path:** There are no official English-name fields to support claiming runtime machine translation as source data. The [Measures for the Administration of Administrative Division Codes](https://www.moj.gov.cn/pub/sfbgw/flfggz/flfggzbmgz/202512/t20251204_528920.html) can guide code updates, but redistribution and geometry rights remain separate gates.
- **Gate result:** `BLOCKED`.

### 4. Hong Kong government open data: administrative boundaries

- **Provider / URL:** Hong Kong SAR Government DATA.GOV.HK, <https://data.gov.hk/en-data/dataset/hk-had-json1-hong-kong-administrative-boundaries>.
- **Dataset:** Hong Kong administrative-boundary data.
- **Coverage / level:** Hong Kong only; it does not resolve national provenance or Macao and Taiwan hierarchies.
- **Version / date:** As stated in the live dataset metadata; no version has been downloaded or frozen by this project.
- **License / redistribution:** The [terms of use](https://data.gov.hk/en/terms-and-conditions) permit use and redistribution subject to conditions. That source is not relicensed as part of this repository’s MIT license and cannot grant rights for other regions.
- **Approval metadata:** Local open-data terms do not replace review of the final national map presentation.
- **Transformations:** None performed.
- **Limitations / update path:** It could only be one local component of a future approved solution, with attribution, version, and terms preserved separately.
- **Gate result:** `BLOCKED` because the national gate remains unmet.

### 5. Macao Cartography and Cadastre Bureau: geographic and land boundaries

- **Provider / URL:** Macao Cartography and Cadastre Bureau, <https://www.dscc.gov.mo/zh-hans/geo_land_boundary_details/article/geo_land_boundary.html>.
- **Dataset:** Official Macao geographic and land-boundary information.
- **Coverage / level:** Macao only.
- **Version / date:** As published on the official page; the project has not frozen a version.
- **License / redistribution:** This review did not obtain explicit permission to include the boundary data in an MIT GitHub repository, public forks, and Pages.
- **Approval metadata:** No review file applies to this project’s final interactive map.
- **Transformations:** None performed.
- **Limitations / update path:** Authority does not by itself confer open redistribution rights. Written permission and an update arrangement are still required.
- **Gate result:** `BLOCKED`.

### 6. Map regulations and public-map content rules

- **Provider / URL:** [Regulations on Map Administration](https://www.gov.cn/zhengce/zhengceku/2015-12/14/content_10403.htm), [Measures for Map Review](https://www.mfa.gov.cn/web/wjb_673085/zzjg_673183/bjhysws_674671/bhflfg/dtdmxgfl/202303/P020230313586143347764.pdf), and [Specifications for the Presentation of Public Map Content](https://www.mfa.gov.cn/web/wjb_673085/zzjg_673183/bjhysws_674671/bhflfg/dtdmxgfl/202303/P020230313585504979937.pdf).
- **Requirement:** Direct, unaltered use of an authority-provided public-interest map carrying a review number may fall under the relevant exception. Edited, interactive, or newly compiled output cannot be presumed exempt. National maps and maps involving Hong Kong, Macao, or Taiwan have specific review-authority requirements, and internet-map review numbers have a validity period.
- **Completeness:** The public-map content specification requires correct presentation of mainland China, Hainan, Taiwan, the South China Sea islands, Diaoyu Dao, and other important features. The specification is not a geometry-data license.
- **Service path:** National Government Services map-review item: <https://gjzwfw.www.gov.cn/fwmh/item/v3/item_11100000MB032716991000115035000.do>. The page lists application, final-specimen, and qualification materials and a statutory processing period; the competent authority must confirm applicability.
- **Gate result:** `BLOCKED`.

## Rejected shortcuts

- Do not use boundary data from an arbitrary GitHub repository, GADM, Natural Earth, or another source whose authority and permission do not cover this product.
- Do not hand-draw a China outline, fill missing islands, use random rectangles, an empty SVG, a grey silhouette, or fabricated administrative levels as a “national map.”
- Do not crop, trace, or convert a standard-map screenshot into SVG or GeoJSON.
- Do not request external map tiles or APIs, introduce an API key, or send project names, notes, aliases, or research content to a map service.
- Do not include `TEST-*` / `DEMO-*` synthetic hierarchies in the production bundle or present synthetic tests as national-completeness evidence.

## Unblocking requirements

Phase 3D may resume only after all of the following evidence is committed and maintainer-reviewed:

1. Select a final authoritative source or qualified mapping provider and freeze dataset name, version, publication date, and content hashes.
2. Obtain written rights covering GitHub, GitHub Pages, global public access, forks, archives, format conversion, extraction, simplification, recoloring, responsive scaling, and interactive rendering.
3. Complete map review for the final desktop, mobile, zoom, overlay, and interaction output; record the review number, approved specimen, approval date, validity period, renewal owner, and asset hashes.
4. Resolve the annual national division-code source and separate Hong Kong, Macao, and Taiwan hierarchy sources. Unsupported levels must remain absent; they may not be inferred.
5. Run automated and real-browser checks for all 34 province-level units, Hong Kong, Macao, Taiwan, South China Sea islands, Diaoyu Dao, source-driven province/autonomous-region/municipality/SAR/Taiwan paths, county-level termination, and no cropping at every target viewport.
6. Load catalog and geometry only from same-origin, approved static assets. User research data must remain in the current local workspace and never enter map assets or external services.

## Current repository boundary

This BLOCKED closeout adds only this document, its Chinese counterpart, and project-state records. The repository must not gain `public/map/**`, a China SVG/GeoJSON/TopoJSON asset, a production administrative catalog, an external map request, or production code that stores unverified region references. Phase 3D, Phase 3E, Phase 3F, and `v0.2.0` remain blocked.
