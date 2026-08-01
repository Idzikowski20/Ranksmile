# Ranksmile — Design System (Koala UI v11)

> Źródło prawdy dla UI. **Przed każdą zmianą UI przeczytaj ten plik.**  
> Tokeny runtime: [`components/koala/tokens/`](components/koala/tokens/) + CSS vars w [`styles/globals.css`](styles/globals.css).  
> Rejestr komponentów (ponytail): [`components/koala/REGISTRY.md`](components/koala/REGISTRY.md).

---

## 1. Brand & kontekst

- **Produkt:** Ranksmile / Smily — SEO content workspace (scoring, TipTap, AI).
- **Design language:** **Koala UI v11** (primitives, product templates, tokens). Nazwy / logo **Ranksmile** (nie Koala).
- **Akcent brandowy:** Dark Orange **`#F84416`** (`brandMain` / `Components/Button/Brand/bg-brand`).
- **Font:** **DM Sans** (heading + body).
- **Logo:** Smily bounce mark — Ranksmile assety, nie Koala imagotype.
- **Tone:** clean, product SaaS — zgodne z Koala product templates.
- **Audience:** zalogowani SEO / content teams.

---

## 1.1 Strefy

| Strefa | Zakres | Tokeny | Komponenty |
|--------|--------|--------|------------|
| **App shell** | Nav, topbar, mobile | `koala/tokens` + CSS vars | `components/koala/product/AppShell` |
| **App content** | Dashboard, settings, domains, … | semantic Light | `koala/primitives` + `koala/product` + `koala/layout` |
| **Editor zone** | TipTap, Smily chat, Content Score, AO | KEEP layout; chrome z Koala tokens | Primitives z koala; widgety w `components/ranksmile/` |

**Reguły:**
- Nowy kod → `components/koala/*` + Emotion / CSS vars. **Bez** nowych Tailwind klas (poza istniejącym base).
- Przed importem z Figmy → sprawdź `REGISTRY.md`.
- Edytor — **KEEP** TipTap/scoring; podmieniaj tylko primitives.
- Unikalne widgety Ranksmile: `Gauge`, `SelectionBar`, … → `components/ranksmile/`.
- Legacy purple `#783AFB` — tylko w `scoreColor.ts` jeśli potrzeba.

---

## 2. Tokeny

Import: `import { theme, semantic, palette } from 'components/koala/tokens'`.

### 2.1 Brand & surfaces (Light)

| Token | Hex | Użycie |
|-------|-----|--------|
| Brand | `#F84416` | CTA, focus, active |
| `bg-primary` | `#FFFFFF` | karty, inputy |
| `bg-secondary` | `#F5F5F5` | page / muted |
| `bg-tertiary` | `#FAFAFA` | nested |
| Text primary | `#1A1A1A` | headings / body |
| Text secondary | `#575757` | muted |
| Text tertiary | `#767676` | meta |
| Border | `#E5E5E5` | karty, dividers |

### 2.2 Radius

| Token | Wartość |
|-------|---------|
| Button default | `12px` |
| Button lg | `14px` |
| Card default | `16px` |

### 2.3 Typography scale

`text-xs` (12/16) … `text-9xl` (128/144) — szczegóły w `tokens/typography.ts`. Weight: 400 / 500 / 700.

### 2.4 Palette families

Grey Neutral, Dark Orange (brand), Orange, Red, Yellow, Green, Dark Green, Soft Green, Blue, Dark Blue, Purple, Pink, Cream, Slate — pełne skale 50–950 w `tokens/colors.ts` (Figma `3950:55876`).

---

## 3. Layout primitives

- `KoalaPage`, `KoalaPageHeader`, `KoalaPanel`, `KoalaTable` — w `components/koala/layout` (zastępują Sentry page patterns).
- Auth: centered minimal light z Product Templates (Sign In / Sign Up / Forgot / Verification).
- Dashboard shell: sidebar + content z Dashboard template `6339:38730`.

---

## 4. Ikony

Koala **Icon_Bold** = Phosphor **Bold** (`@phosphor-icons/react`). Używaj `Icon` z `components/koala/icons`.

---

## 5. Anti-slop

- Bez Sentry dark shell (`#252525`) w nowym UI.
- Bez starego accent `#F29964` w nowym UI (legacy tylko do czasu pełnego cutover).
- Bez Inter / Rubik jako brand font — DM Sans.
- Emotion + CSS vars; nie kopiuj Tailwind z outputu Figma MCP 1:1.

---

## 6. Semantic Tokens Only (design debt)

W nowym i zmienianym kodzie UI używaj **wyłącznie** tokenów semantycznych:

- **OK:** `var(--koala-text-primary)`, `var(--koala-bg-secondary)`, `var(--koala-border-primary)`, `var(--koala-status-success)`, Emotion `semantic.*`.
- **Forbidden:** surowe palety (`var(--gray-*)`, `var(--orange-500)`), hex surface/text/border w `style={{}}`.
- Chromatic wyjątki tylko w `components/koala/tokens/*`, brand `#F84416`, lub `product/helpers/` (intent / KD scale).

### Forbidden theming inline

Nie używaj `style={{}}` dla: `color`, `background`, `backgroundColor`, `border`, `borderColor`, `boxShadow`. Layout (`gap`, `flex`, `width`) jest OK.

### Articles boundary

| Warstwa | Reguła |
|---------|--------|
| Article **chrome** (listy, modale shell, statusy, panele surface) | tokenized |
| Article **content** (TipTap, scoring, highlight/diff) | KEEP / untouched |

### Badge

Canonical: `components/koala/core` `Badge` — contract: `appearance`/`variant`, `size` (`sm`|`md`|`lg`), optional `icon`. Domenowe chipy → `components/koala/product/helpers/`.

Debt: `npm run token:debt` · budget: `npm run check:koala-tokens`.
