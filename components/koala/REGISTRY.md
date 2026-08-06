# Koala UI — Component Registry (ponytail gate)

Before importing anything from Figma, search this file and `components/koala/**`.
If it exists → reuse. If not → import once and append a row.

**Rules**
- Theme I/O: components never read `localStorage` / cookies / `prefers-color-scheme` — only `useKoalaTheme()` (`theme/KoalaThemeProvider.tsx`).
- Dashboard → `ChartWidget` → `Chart` (never import `koala/charts` from pages/dashboard).
- Chart series use `kind` (`traffic` | `rank` | …), not raw colors.
- One component · one responsibility · one public API.
- **Semantic tokens only** — no palette vars / theming hex in `style={{}}` (see `DESIGN.md` §6).
- Status / intent / trend / difficulty chips → `product/helpers/*` or core `Badge` — never local `IntentBadge` / `YesBadge`.
- Token audit: `npm run check:koala-tokens` · debt report: `npm run token:debt`.

| Name | Figma node | Component | Screenshot (e2e) | Owner | Status |
|------|------------|-----------|------------------|-------|--------|
| Color scales | `3950:55876` | `tokens/colors.ts` | — | ranksmile-frontend | Stable |
| Cursors (macOS set) | `3950:57573` | `tokens/cursors.ts` + `styles/cursors.css` + `public/cursors/*` | — | ranksmile-frontend | Stable |
| Typography | `3950:179138` | `tokens/typography.ts` | — | ranksmile-frontend | Stable |
| Effects | `5828:163350` | `tokens/effects.ts` | — | ranksmile-frontend | Stable |
| Semantic tokens | Variables | `tokens/semantic.ts` | — | ranksmile-frontend | Stable |
| Themes L/D/C/M | Themes | `tokens/themes.ts` + `theme/KoalaThemeProvider.tsx` | auth-sign-in-* | ranksmile-frontend | Stable |
| Button | `3950:55874` | `primitives/Button.tsx` | gallery-button-* | ranksmile-frontend | Stable |
| Badge (contract) | `3950:55510` | `core/badge/badge.tsx` (`appearance`/`size`/`icon`) | — | ranksmile-frontend | Stable |
| Chip | `11196:273025` | `core/chip/chip.tsx` | — | ranksmile-frontend | Stable |
| Checkbox | `3950:55875` | `core/checkbox/checkbox.tsx` | — | ranksmile-frontend | Stable |
| Avatar | `3950:49867` | `core/avatar.tsx` (`badge`: status/flag/certificate) | — | ranksmile-frontend | Stable |
| KeywordIntentBadge | Product | `product/helpers/KeywordIntentBadge.tsx` | — | ranksmile-frontend | Stable |
| KeywordDifficultyDot | Product | `product/helpers/KeywordDifficultyDot.tsx` | — | ranksmile-frontend | Stable |
| TrendDeltaBadge | Product | `product/helpers/TrendDeltaBadge.tsx` | — | ranksmile-frontend | Stable |
| SourceStatusBadge | Product | `product/helpers/SourceStatusBadge.tsx` | — | ranksmile-frontend | Stable |
| StatusBadge (pipeline) | Product | `primitives/StatusBadge.tsx` | — | ranksmile-frontend | Stable |
| Card | Product | `product/Card.tsx` | gallery-card-* | ranksmile-frontend | Stable |
| Tooltip | `3950:179137` | `core/tooltip` | gallery-tooltip-* | ranksmile-frontend | Stable |
| Dialog | `2612:115790` | `primitives/Modal.tsx` | gallery-dialog-* | ranksmile-frontend | Stable |
| Select | `3950:55879` | `core/select/select.tsx` (+ `CompactSelect`) | gallery-select-* | ranksmile-frontend | Stable |
| ProgressBar | `7674:106575` | `core/progressBar/progressBar.tsx` | — | ranksmile-frontend | Draft |
| EmailTagInput | Product | `core/emailTagInput/emailTagInput.tsx` (Input + dismissable Chip) | — | ranksmile-frontend | Draft |
| WidgetShell (+ state) | Dashboard | `product/widgets.tsx` | gallery-widget-* | ranksmile-frontend | Stable |
| Chart (presets SoT) | Product / Figma charts | `charts/Chart.tsx` | gallery-widget / dashboard-chart | ranksmile-frontend | Stable |
| Sparkline (appearances) | `6988:208171` | `charts/Sparkline.tsx` | gallery-widget | ranksmile-frontend | Stable |
| Chart presets | Viz layer | `charts/presets.ts` (internal) | — | ranksmile-frontend | Stable |
| ChartWidget / MetricWidget | Dashboard | `product/widgets.tsx` | dashboard-chart | ranksmile-frontend | Stable |
| RadialComparisonWidget | `9963:582207` | `product/RadialComparisonWidget.tsx` | — | ranksmile-frontend | Draft |
| DataTable (+ Head/Cell) | `6944:212812` / `6955:31325` | `core/dataTable/dataTable.tsx` | — | ranksmile-frontend | Stable |
| DataToolbar (filter/sort/selection) | `9421:371318` | `product/DataToolbar.tsx` | — | ranksmile-frontend | Stable |
| TablePattern | Product | `product/TablePattern.tsx` | — | ranksmile-frontend | Stable |
| KoalaTable (HTML) | Layout | `layout/Table.tsx` | — | ranksmile-frontend | Stable |
| Gallery | — | `gallery/KoalaGallery.tsx` | gallery-* | ranksmile-frontend | Deprecated (e2e KEEP until retarget) |
| Dashboard Overview | `6992:33142` | `pages/dashboard` + widgets | dashboard-widget-row | ranksmile-frontend | Stable |
| Dashboard Analytics ref | `7762:48760` | composition only | — | ranksmile-frontend | Draft |
| Sidebar | `4903:6905` | `shell/Sidebar.tsx` | dashboard-shell (stub) | ranksmile-frontend | Stable |
| Dashboard regions stub | — | `gallery/DashboardRegions.tsx` | dashboard-* | ranksmile-frontend | Experimental |
| SidebarPlan (Upgrade PRO) | footer + texture `7956:407782` | `shell/SidebarPlanItem.tsx` + `/koala/starry-black.png` | — | ranksmile-frontend | Stable |
| Popover | templates | `primitives/Popover.tsx` | — | ranksmile-frontend | Stable |
| Form System | `7906:208746` | `forms/Field.tsx` + `forms/index.ts` | — | ranksmile-frontend | Stable |
| FileUpload | Settings | `forms/FileUpload.tsx` | — | ranksmile-frontend | Stable |
| MenuList | `6106:100172` | `core/menuList.tsx` | — | ranksmile-frontend | Stable |
| Toast | Product | `lib/toast.tsx` | — | ranksmile-frontend | Stable |
| FeedbackPopover | Product | `product/FeedbackPopover.tsx` | — | ranksmile-frontend | Stable |
| ActivityFeed | `10251:72895` | `product/ActivityFeed.tsx` | — | ranksmile-frontend | Stable |
| DangerZone | Settings | `forms/DangerZone.tsx` | — | ranksmile-frontend | Stable |
| CreateTeamDialog | `7900:165760` | `product/CreateTeamDialog.tsx` | — | ranksmile-frontend | Draft |
| Enable2FADialog | `10018:306013` | `product/Enable2FADialog.tsx` | — | ranksmile-frontend | Draft |
| Automations calendar | `6230:327018` / `9472:40560` | `components/automations/AutomationsCalendar.tsx` | — | ranksmile-frontend | Draft |
| Add automation event dialog | `5874:190606` | `components/automations/AddEventDialog.tsx` | — | ranksmile-frontend | Draft |
| BenefitItem | `3089:39824` | `product/BenefitItem.tsx` | — | ranksmile-frontend | Draft |
| PricingCard | `10592:400069` / `1622:8972` | `product/PricingCard.tsx` | — | ranksmile-frontend | Draft |
| ComparePricingTable | `3141:79102` | `product/ComparePricingTable.tsx` | — | ranksmile-frontend | Draft |
| PlanDefinition (SoT) | — | `lib/pricing/planDefinition.ts` | — | ranksmile-frontend | Draft |

**Modal stack:** Dialog → Drawer → Popover → Toast. Never nest Dialog under Dialog.

**Status:** `Draft` | `Stable` | `Deprecated` | `Experimental`
