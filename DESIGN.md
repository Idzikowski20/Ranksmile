# SerpBear — Design System (Sentry-first)

> Źródło prawdy dla UI. **Przed każdą zmianą UI przeczytaj ten plik.**  
> Tokeny runtime: [`components/core/theme.tsx`](components/core/theme.tsx) + CSS vars w [`styles/globals.css`](styles/globals.css).

---

## 1. Brand & kontekst

- **Produkt:** SerpBear / Surfy — SEO content workspace (scoring, TipTap, AI).
- **Design language:** **Sentry** (shell, primitives, app pages) + wyjątek **editor zone** (scoring / TipTap layout KEEP).
- **Akcent brandowy:** Surfy orange **`#F29964`** (nie fiolet Surfera).
- **Tone:** clean, functional, data-dense — zero dekoracji dla dekoracji.
- **Audience:** zalogowani SEO / content teams.

---

## 1.1 Strefy

| Strefa | Zakres | Tokeny | Komponenty |
|--------|--------|--------|------------|
| **Sentry shell** | `SentryNav`, topbar, mobile nav | `theme.tsx` + `.sentry-*` / shell CSS | `components/core/*` |
| **Sentry app** | Dashboard, domains, keywords, AI vis, settings, billing | `theme.tsx` (Rubik, orange accent, Sentry grays) | `core` + `components/sentry-pages/*` |
| **Editor zone** | TipTap, Surfy chat, Content Score, AO, gauges | KEEP layout; score bands z `lib/scoreColor.ts`; akcent UI = `#F29964` gdzie toczone | Primitives z `core`; widgety w `components/surfer/` |

**Reguły:**
- Nowy kod **poza edytorem** → `components/core` + Emotion / CSS vars Sentry. **Bez** nowych Tailwind klas. Inline styles tylko dla pozycji runtime (popover, caret).
- Edytor (`components/articles/*`) — **KEEP** struktura TipTap/scoring; podmieniaj tylko primitives (`Button`, `Modal`, `Input`, `Textarea`, `Alert`).
- Unikalne widgety bez odpowiednika Sentry: `Gauge`, `ScoreGauge`, `SelectionBar`, `SortableHeader`, `SlidePanel` → `components/surfer/`.
- **Nie używaj Surfer purple `#783AFB` / `#653DE9` jako brand accent** w nowym UI. Legacy score colors mogą zostać w `scoreColor.ts` do czasu migracji gauge’y.

---

## 1.2 Sentry page patterns (`components/sentry-pages/`)

| Komponent | Użycie |
|-----------|--------|
| `SentryPage` | Scroll container, bg `#F8F8F9`, padding 24px |
| `SentryPageHeader` | Tytuł + subtitle + actions |
| `SentryPageFilters` | Filtry: time, dropdown, search |
| `SentryPanel` / `Header` / `Body` | Biała karta, border `#DAD9DE`, radius 8px |
| `SentryTable` + head/body/row/cell | Dane; uppercase gray headers; bez vertical borders |
| `SentryDetailLayout` | ~75% main + 300px aside |
| `SentrySettingsSection` / `Row` | Settings: label left / control right |
| `SentryEmptyState` | Pusty stan |

**CSS:** `.sentry-page-*`, `.sentry-panel-*`, `.sentry-table-*`, `.sentry-settings-*` w `globals.css`.

**Wykluczenia:** `pages/articles/[id]/*` (edytor), writing-mode, generating, deep-analysis progress.

---

## 2. Tokeny — źródło prawdy (`theme.tsx`)

Import: `import { theme } from 'components/core/theme'` (lub Emotion `Theme`).

### 2.1 Surfaces

| Token | Hex | Użycie |
|-------|-----|--------|
| `background.primary` | `#FFFFFF` | karty, inputy, panele |
| `background.secondary` | `#F8F8F9` | page bg, section |
| `background.tertiary` | `#F0F0F2` | nested / muted surface |
| Shell bg | `#252525` / `#09090b` | nav, topbar (`--sentry-shell-bg`) |
| Shell border | `#221e28` | rail border |

### 2.2 Content (tekst)

| Token | Hex | Użycie |
|-------|-----|--------|
| `content.headings` | `#181225` | headings |
| `content.primary` | `#302E36` | body |
| `content.secondary` | `#6A6772` | muted, meta |
| `content.accent` | `#E07D42` | link / accent text |
| `content.disabled` | `#878490` | disabled |
| Shell text | `#FFFFFF` / `#9F9FA9` | nav primary / muted |

### 2.3 Accent & interactive (Surfy / Sentry)

| Token | Hex | Użycie |
|-------|-----|--------|
| **Accent** | `#F29964` | primary CTA fill, focus, active, Surfy |
| Accent chonk | `#C97D52` | embossed underside (Button primary) |
| Accent text link | `#E07D42` | `Button` link / content.accent |
| Focus ring | `#F29964` | `theme.focus.default` |
| Transparent accent | `#F299641C` / `#F2996426` | soft tint bg |

### 2.4 Borders

| Token | Hex | Użycie |
|-------|-----|--------|
| `border.primary` | `#DAD9DE` | karty, panele, dividers |
| `border.secondary` | `#E6E6E9` | subtle |
| `border.accent.vibrant` | `#F29964` | focus / selected |

### 2.5 Semantic

| Rola | Vibrant | Content | Użycie |
|------|---------|---------|--------|
| Success | `#00F261` / `#009800` | `#008900` | positive, pass |
| Warning | `#FFCE00` | `#A45200` | warn |
| Danger | `#FF002B` | `#D50000` | error, delete |
| Promotion | `#FC5CB4` | `#C8007E` | rare promo |

**Legacy editor deltas** (Content Score): `#1AB25E` up / `#FF6F77` down — KEEP w scoring do migracji; nowy kod Sentry → semantic z `theme.tokens`.

### 2.6 CSS vars (shell / hybrid)

```css
--sentry-accent: #f29964;
--sentry-shell-bg: #252525;
--zone-editor-bg: #f8f9ff;   /* editor canvas — lekki cool tint OK */
--zone-content-bg: #ffffff;
--font-family-primary: …;   /* body / content */
--font-family-shell: Rubik, "Avenir Next", …;
```

---

## 3. Typografia

| Context | Family |
|---------|--------|
| Shell / Sentry UI | Rubik (`theme.font.family.sans` / `--font-family-shell`) |
| Content / editor body | `var(--font-family-primary)` |
| Mono (kody, IDs) | `theme.font.family.mono` — **tylko dane**, nie labels wszędzie |

**Rozmiary (`theme.font.size`):** xs 11 · sm 12 · md 14 (base) · lg 16 · xl 20 · 2xl 24 · 3xl 32.

**Weights:** regular 400, medium 500 (Sentry). Unikaj 700+ poza dużymi display numbers w scoring.

**Nigdy:** hardcode Inter/Arial/Roboto jako brand face. Używaj CSS vars / `theme.font`.

---

## 4. Spacing, radius, elevation

Z `theme.space` / `theme.radius` / `theme.elevation`:

| Space | px |
|-------|-----|
| xs–md | 4–8 |
| lg–xl | 12–16 |
| 2xl–3xl | 24–32 |

| Radius | px | Użycie |
|--------|-----|--------|
| sm–md | 5–6 | małe controls |
| **lg** | **8** | karty Sentry, Button md, panele |
| xl | 12 | większe karty / dropdown |
| full | 999 | **tylko** avatary / progress track — nie domyślne filter chips |

**Chonk elevation** (Button): surface lifted by `1–2px` z `chonk` kolor underside — nie szeroki black bloom.

**Focus:** `0 0 0 2px #fff, 0 0 0 4px #F29964` (przez `theme.focusRing`).

---

## 5. Buttons — używaj `components/core` `Button`

| Variant | Wygląd |
|---------|--------|
| `primary` | fill `#F29964`, chonk `#C97D52`, text white |
| `secondary` | white + gray chonk, text `#181225` |
| `danger` | `#FF002B` |
| `warning` | `#FFCE00`, text black |
| `link` / `transparent` | bez fill; link accent `#E07D42` |

Sizes: `md` 36px · `sm` 32px · `xs` 24–28px.

**Nie:** gradient fill, glowy blur, hover translateY („boop”), filled+ghost para jako default CTA row, hover skok na fiolet `#5a1fd6` / `#783AFB`.

---

## 6. Inputs / forms

- Height: `theme.form.md` (36) / `sm` (32).
- Border: `#DAD9DE`; focus border + ring accent `#F29964`.
- Placeholder / secondary: `#6A6772` / `#878490`.
- Prefer `core` `Input`, `Textarea`, `Select`, `Form`.

---

## 7. Karty i panele

```
background: #FFFFFF
border: 1px solid #DAD9DE
border-radius: 8px   /* Sentry panel — nie 12px Surfer card default */
```

Page bg: `#F8F8F9`. Unikaj `#F8F9FF` poza `--zone-editor-bg`.

---

## 8. Ikony

- **Tylko inline SVG** — bez Lucide / icon CDN.
- `aria-hidden="true"` na dekoracyjnych.
- Stroke ~1.5–2; `currentColor`.
- **Bez** ikony w kolorowym tile/squircle jako default list item.

---

## 9. Motion

- Prefer `theme.motion.*` (120 / 160 / 240 ms).
- Min. interakcja: ~150ms ease (legacy inline OK).
- Dropdown: `growOut` / enter curve; z-index z `theme.zIndex` (dropdown 1020, modal 10000).
- **Content visible by default** — nigdy `opacity: 0` entrance bez fallbacku.
- `prefers-reduced-motion` dla scroll/ambient.

---

## 10. Shell

| Element | Spec |
|---------|------|
| Topbar | ~58px, sticky, dark `#09090b` / `#252525` |
| Nav rail | dark, border `#221e28` |
| Content | light `#F8F8F9` |
| Mobile | `MobileBottomNav`; rail hidden on small |

---

## 11. Editor zone (wyjątek)

- Layout TipTap / Write & Optimize / Surfy dock — **KEEP**.
- Score gauges / bands: `lib/scoreColor.ts` (może trzymać legacy purple bands).
- Surfy primary actions = accent `#F29964` (jak `Button` primary).
- Autosave / AO review — istniejące wzorce; nie „Surfer redesign”.
- Nowe kontrolki w edytorze → `core` Button/Modal, nie custom purple CTA.

---

## 12. Anti-slop checklist (SerpBear)

Zadaptowane z [pols.dev/slop.md](https://pols.dev/slop.md) pod **product UI** (nie landing). Sprawdź przed shipem UI:

1. **Bez Lucide / icon-pack look** — inline SVG, spójny stroke.
2. **Bez gradient pills** (blue→purple / candy) i glowy CTA.
3. **Bez purple-as-default brand** — accent = `#F29964`; fiolet tylko legacy score.
4. **Bez hover-boop** (translateY/scale na buttonach).
5. **Bez filled + outlined CTA pair** jako domyślny rząd akcji.
6. **Bez icon-in-colored-tile** jako bullet/feature default.
7. **Bez `opacity:0` entrance** — content widoczny bez JS animation.
8. **Bez full-page grid / aurora blobs / cream editorial bg**.
9. **Bez Inter/Space Grotesk jako signature** — Rubik shell + primary var.
10. **Bez fat all-around shadows** — chonk / tight directional / tonal edge.
11. **Clear the cut** — nic nie obcięte przez `overflow` / fixed height.
12. **Centering verified** — ikony/liczby w circle/badge optycznie wyśrodkowane.
13. **Kontrast tekstu** — czytelny na fill (zwłaszcza primary button).
14. **Pills sparingly** — status chip OK; nie chip wokół każdego metadatum.
15. **Dead controls** — tab/toggle musi działać albo nie udawać interakcji.

Unikanie listy ≠ design. Trzymaj spójność z `theme.tsx` i jedną strefą wizualną na ekran.

---

## 13. DO / DON'T

### DO
- Tokeny z `theme.tsx` / tej dokumentacji
- `Button` / `Modal` / `Input` z `components/core`
- Stany: default, hover, focus-visible, disabled
- Transition / motion z theme
- Inline SVG + `aria-hidden`

### DON'T
- Nowe kolory „na oko” (zwłaszcza `#783AFB` jako CTA)
- `outline: none` bez własnego focus
- Nowe Tailwind utility classes w fresh code
- Mieszanie dark shell z dark content cards
- Surfer-style dark `#2F2F34` button + purple hover w Sentry app

---

## 14. QA przed merge UI

- [ ] Accent / focus = `#F29964` (nie purple)
- [ ] Font: CSS var / Rubik shell — bez hardcode Inter
- [ ] Karty: border `#DAD9DE`, radius 8px (Sentry)
- [ ] Buttons z `core` lub wizualnie zgodne z chonk
- [ ] Hover / focus-visible / disabled
- [ ] Anti-slop §12 — zero gradient pill / boop / opacity-0 trap
- [ ] Ikony: inline SVG
- [ ] Mobile: shell + bottom nav OK
- [ ] Editor zone: nie rozwalić TipTap/scoring layout

---

## 15. Mapowanie legacy → Sentry

| Stare (Surfer docs) | Nowe (Sentry) |
|---------------------|---------------|
| Brand purple `#783AFB` | Accent `#F29964` |
| Purple focus `#AA93FD` | Focus `#F29964` |
| Dark CTA `#2F2F34` → hover purple | `Button` primary orange chonk |
| Card border `#F4F4F5`, radius 12 | `#DAD9DE`, radius 8 |
| Content bg `#F8F9FF` | Page `#F8F8F9` (editor canvas może zostać cool tint) |
| Inter as brand | Rubik shell + `--font-family-primary` |
| Inline-everything app-wide | `core` + Emotion poza edytorem |
