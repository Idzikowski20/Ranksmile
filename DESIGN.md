# SerpBear — Design System Reference

> Źródło prawdy dla wszystkich elementów wizualnych projektu.  
> **Przed każdą zmianą UI przeczytaj ten plik i ściśle go przestrzegaj.**

---

## 1. Brand & Kontekst

- **Produkt:** SerpBear (wzorowany na Surfer SEO)
- **Audience:** authenticated users — SEO marketers, content teams
- **Motyw:** ciemny shell (sidebar + topbar) + jasne panele content (white cards on light gray)
- **Visual tone:** clean, functional, data-dense — zero dekoracji dla samych dekoracji

---

## 2. CSS Variables — Źródło tokenów

Wszystkie tokeny są zdefiniowane w `styles/globals.css` i dostępne globalnie.

### 2.1 Ciemne tokeny (shell)

```css
--color-text-primary:   #ffffff
--color-surface-base:   #000000
--color-surface-strong: #09090b   /* sidebar bg, body bg */
--color-surface-raised: #783afb   /* brand purple, akcentowy */
--color-text-tertiary:  #ff5b49   /* logo czerwono-pomarańczowy */
--color-border-strong:  #221e28   /* border sidebara */

--topbar-height: 58px
--topbar-bg:     #09090b
--topbar-panel:  #18181b
--topbar-muted:  #9f9fa9
--topbar-text:   #ffffff
```

### 2.2 Jasne tokeny (content areas)

```css
--white-base:  #ffffff
--gray-10:     #f4f4f5   /* card borders, skeleton bg */
--gray-20:     #e4e4e7   /* dividers, progress track, panel border */
--gray-40:     #d4d4d8   /* input borders, filter pill default */
--gray-60:     #9f9fa9   /* placeholders, muted icons */
--gray-100:    #3f3f47   /* labels, ghost button text */
--gray-120:    #2f2f34   /* dark button text, content title */
--gray-140:    #18181b   /* primary text in content area */
--gray-160:    #09090b   /* headings, active filter pill */

--purple-40:   #aa93fd   /* focus ring, input hover border */
--purple-70:   #783afb   /* brand, primary accent */
--purple-base: #783afb
--purple-100:  #4d08b5   /* dark purple hover */
```

---

## 3. Paleta kolorów — pełna

### 3.1 Neutralne (white-side)

| Token / Nazwa     | Hex       | Użycie                                   |
|-------------------|-----------|------------------------------------------|
| White             | `#FFFFFF` | card bg, dropdown bg, input bg           |
| gray-10           | `#F4F4F5` | card border, skeleton, surface subtle    |
| gray-20           | `#E4E4E7` | dividers, panel borders, progress track  |
| gray-40           | `#D4D4D8` | input border, filter pill border         |
| Surface subtle    | `#F8F8F9` | section bg, summary card, hover state    |
| Content area bg   | `#F8F9FF` | main content area background             |
| gray-60           | `#9F9FA9` | placeholders, muted icons, timestamps    |
| gray-muted        | `#71717B` | hints, meta, subtext                     |
| gray-100          | `#3F3F47` | labels, secondary text                   |
| gray-120          | `#2F2F34` | button text dark, content headings       |
| gray-140          | `#18181B` | primary text in content                  |
| gray-160          | `#09090B` | headings, active state, near-black       |

### 3.2 Brand / Accent

| Nazwa            | Hex       | Użycie                                    |
|------------------|-----------|-------------------------------------------|
| Purple 40        | `#AA93FD` | focus ring, input focus border            |
| Purple 70        | `#783AFB` | brand primary, hover dla dark button      |
| Purple 100       | `#4D08B5` | dark hover                                |
| Purple pale      | `#E1DBFE` | avatar bg, impression accent bg           |
| Purple chart     | `#8B73F6` | impressions line on chart                 |
| Blue chart       | `#74A9FF` | clicks line on chart                      |
| Blue area        | `#BEDBFF` | clicks area fill gradient                 |
| Blue pale        | `#DBEAFE` | clicks metric card accent bg              |
| Blue primary     | `#155DFC` | clicks metric icon color                  |
| Logo red-orange  | `#FF5B49` | logo accent (`--color-text-tertiary`)     |

### 3.3 Semantyczne

| Nazwa           | Hex       | Użycie                              |
|-----------------|-----------|-------------------------------------|
| Success green   | `#1AB25E` | delta up arrow, positive change %   |
| Progress green  | `#137832` | onboarding progress bar fill        |
| Success bg      | `#F0FDF4` | Published badge background          |
| Success text    | `#15803D` | Published badge text                |
| Error red       | `#FF6F77` | delta down arrow, negative change % |
| Error bg        | `#FFF1F2` | error state panel background        |
| Error border    | `#FECACA` | error state panel border            |
| Error text      | `#B91C1C` | error state text                    |

### 3.4 Statusy / Activity badges

| Status     | Bg        | Text      | Dot       |
|------------|-----------|-----------|-----------|
| published  | `#F0FDF4` | `#15803D` | `#16A34A` |
| draft      | `#F9FAFB` | `#6B7280` | `#9CA3AF` |
| updated    | `#EFF6FF` | `#1D4ED8` | `#3B82F6` |
| created    | `#FAF5FF` | `#6D28D9` | `#783AFB` |

---

## 4. Typografia

### 4.1 Font family

```
"Inter Variable", "Inter", Arial, sans-serif
```
Zawsze używaj `var(--font-family-primary)` — nigdy hardcodowanej nazwy fontu.

### 4.2 Skala rozmiarów

| Token        | Wartość   | Użycie                              |
|--------------|-----------|-------------------------------------|
| --font-size-xs  | 12.25px  | token (rzadko używany wprost)       |
| 11px           | —        | chart axis labels                   |
| 12px           | —        | small meta, secondary info, badge   |
| 13px           | —        | compact UI: tags, sub-labels, sort  |
| **14px**       | **base** | body, buttons, filters, nav items   |
| 16px           | —        | account menu items                  |
| 18px           | —        | calendar month/year header          |
| 20px           | —        | metric card value, section title    |
| 24px           | —        | summary card main value             |

### 4.3 Font weights

| Weight | Użycie                                                        |
|--------|---------------------------------------------------------------|
| 400    | body text, regular labels, muted                             |
| 500    | nav items, secondary labels, card labels, weekday headers    |
| 600    | buttons, titles, headings, filter pills, sidebar active      |
| 700    | calendar month/year, calendar day numbers                    |

### 4.4 Line heights używane

- 16px → dla 13px tekstu
- 20px → dla 14px tekstu (standard)
- 24px → dla 16px tekstu
- 28px → dla 20px headingów
- 32px → dla 24px display values

### 4.5 Reguły typografii

- `-webkit-font-smoothing: antialiased` na body
- Letter-spacing: `0` (nie używaj domyślnego browser letter-spacing)
- Overflow text: `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`
- Multi-line clamp: `display: -webkit-box; -webkit-line-clamp: N; -webkit-box-orient: vertical`

---

## 5. Spacing

```css
--space-1: 3.5px
--space-2: 4.2px
--space-3: 5.6px
--space-4: 7px
--space-5: 10.5px
--space-6: 14px
--space-7: 21px
--space-8: 28px
```

**Praktyczne wartości używane w komponentach:**

| px   | Typowe użycie                                   |
|------|-------------------------------------------------|
| 2px  | gap w delta values                              |
| 4px  | tooltip padding, gap w badge                   |
| 6px  | sub-nav item padding v, gap w meta              |
| 8px  | standard gap, nav item padding, topbar gap      |
| 12px | filter bar gap, card grid gap                   |
| 14px | sidebar top items gap                           |
| 16px | card padding, section padding, header gap       |
| 20px | dropdown padding                                |
| 24px | onboarding card padding, header section gap     |
| 32px | sekcja gap (między sekcjami strony)             |
| 40px | header padding                                  |
| 48px | page top padding (dashboard)                    |

---

## 6. Border Radius

```css
--radius-xs: 7px
--radius-sm: 10.5px
--radius-md: 14px
--radius-lg: 21px
--radius-xl: 50px
--radius-2xl: 70px
```

**Praktyczne wartości z komponentów:**

| Wartość  | Użycie                                                        |
|----------|---------------------------------------------------------------|
| 3px      | favicon w sidebar                                             |
| 4px      | tooltip container                                             |
| 6px      | przyciski toolbara (import, primary), sub-nav items sidebar   |
| 8px      | sort dropdown, filter ghost buttons, nav items sidebar        |
| 10px     | wrapper search inputu w dropdown                             |
| 12px     | karty (metric, onboarding, section), app-content             |
| 16px     | date picker dropdown, account menu, learn cards              |
| 9999px   | filter pills, progress bar, avatar, calendar selected day    |

---

## 7. Shadows

```css
/* System shadows */
--shadow-1: rgba(0,0,0,0.05) 0px 1px 1px 0px,
            rgba(34,42,53,0.04) 0px 4px 6px 0px,
            rgba(47,48,55,0.05) 0px 24px 68px 0px,
            rgba(0,0,0,0.04) 0px 2px 3px 0px;
--shadow-2: rgba(0,0,0,0.2) 0px -1px 0px 0px inset,
            rgba(255,255,255,0.25) 0px 1px 0px 0px inset;
```

**Komponenty:**

| Komponent         | Shadow                                                                                                 |
|-------------------|--------------------------------------------------------------------------------------------------------|
| Metric card       | `0px 1px 2px 0px #1A1D280F`                                                                           |
| Sort/input button | `0px 1px 2px 0px rgba(26,29,40,0.06)`                                                                |
| Dropdown          | `0px 18px 40px 0px rgba(17,24,39,0.14), 0px 8px 18px 0px rgba(17,24,39,0.09), 0px 2px 6px 0px rgba(17,24,39,0.06)` |
| Account menu      | `0 14px 40px rgba(0,0,0,0.18)`                                                                        |
| Tooltip (dark)    | `0px 8px 16px 0px #181a220a, 0px 2px 8px 0px #181a2205, 0px 1px 2px 0px #181a220f`                  |
| Section inset     | `inset 0 0 0 1px #E4E4E7`                                                                             |
| Active filter pill| `inset 0 0 0 1px #09090B` (double border effect)                                                      |
| Input focus ring  | `0 0 0 2px rgba(120,58,251,0.1)`                                                                       |

---

## 8. Przyciski (Buttons)

### 8.1 Primary — ciemny (główna akcja CTA)

```
bg: #2F2F34          text: #ffffff
border: none         radius: 6px
padding: 6px 16px    font: 14px/600
hover bg: #783AFB    transition: background 0.15s
```

### 8.2 Primary split button

Dwa przyciski side-by-side, gap: 1px.
- Lewy: radius `6px 0 0 6px`
- Prawy: radius `0 6px 6px 0`, padding: 6px (tylko ikona)
- Oba: bg `#2F2F34`, hover `#783AFB`

### 8.3 Secondary — szary

```
bg: #F4F4F5          text: #2F2F34
border: none         radius: 6px
padding: 6px 16px    font: 14px/600
hover bg: #E4E4E7    transition: background 0.15s
```

### 8.4 Ghost filter (inline toolbar)

```
bg: transparent      text: #3F3F47
border: none         box-shadow: inset 0 0 0 1px #E4E4E7
radius: 8px          padding: 6px 16px
font: 14px/600       hover bg: #F4F4F5
```

### 8.5 Filter pill — default (chip z ikoną)

```
bg: #FFFFFF          text: #18181B
border: 1px solid #D4D4D8    radius: 9999px
padding: 8px 16px    font: 14px/600
min-width: 55px      gap: 8px (icon + label + chevron)
transition: border-color 150ms ease, box-shadow 150ms ease
```

### 8.6 Filter pill — active

```
border: 1px solid #09090B
box-shadow: inset 0 0 0 1px #09090B
text: #09090B
```

### 8.7 Date preset pill (w kalendarzu)

```
selected: bg #09090B, text #FFFFFF
default:  bg #F4F4F5, text #3F3F47
border: none         radius: 9999px
padding: 8px 16px    font: 14px
```

### 8.8 Sort button (tabela)

```
bg: transparent      border: 1px solid #D4D4D8
radius: 9999px       padding: 8px 16px
font: 14px/600       color: #18181B
```

### 8.9 Ghost icon button (bez tekstu)

```
bg: transparent      border: none
padding: 0           color: #3F3F47
hover color: #2F2F34  transition: color 0.15s
```

### 8.10 Ghost text link / skip button

```
bg: transparent      border: none
padding: 0           font: 14px/400
color: #52525C       cursor: pointer
```

### 8.11 Navigation button (sidebar header toggle)

```
bg: transparent      border: none
radius: 8px          padding: 6px 8px
color: rgba(255,255,255,0.9)
cursor: pointer
```

### 8.12 Calendar day button

```
width: 36px    height: 36px    border-radius: 9999px
border: none   font: 14px/700

default:  bg transparent, color #18181B
selected: bg #18181B, color #FFFFFF
disabled: opacity 0.3, cursor not-allowed
```

### Stany wszystkich przycisków

| Stan       | Opis                                                             |
|------------|------------------------------------------------------------------|
| default    | wg specyfikacji powyżej                                          |
| hover      | zmiana bg / border / color wg wariantu, transition 150ms        |
| focus-visible | outline widoczny, focus ring (purple ring dla input)          |
| active     | slight darkening (zależy od wariantu)                           |
| disabled   | opacity 0.4–0.5, cursor not-allowed, pointer-events: none       |
| loading    | spinner lub opacity 0.7, cursor wait                            |

---

## 9. Inputs

### 9.1 Standard search input (duży — w dropdown filterów)

```
height: 38px         border: 1px solid #D4D4D8
border-radius: 10px  padding: 0 8px
font: 14px/400       color: #18181B
bg: transparent      outline: none
shadow: 0px 1px 2px 0px #1a1d280f
placeholder color: #9F9FA9
```

Wrapper: `display: flex; align-items: center; border: 1px solid #D4D4D8; border-radius: 10px; box-shadow: ...`

### 9.2 Compact search input (toolbar — 32px)

```
height: 32px         padding-left: 32px (ikona)
padding-right: 12px  border: 1px solid #D4D4D8
border-radius: 8px   font: 13px/400
color: #2F2F34       bg: #FFFFFF
outline: none        shadow: 0px 1px 2px 0px rgba(26,29,40,0.06)

focus:
  border-color: #AA93FD
  box-shadow: 0px 1px 2px 0px rgba(26,29,40,0.06), 0 0 0 2px rgba(120,58,251,0.1)
  
transition: border-color 0.2s, box-shadow 0.2s
```

Ikona search: 16×16, color `#9F9FA9`, absolutnie pozycjonowana `left: 8px`.

### 9.3 Sort dropdown trigger

```
height: 32px         padding: 0 12px
border: 1px solid #D4D4D8  border-radius: 8px
font: 13px/600       color: #2F2F34
bg: #FFFFFF          shadow: 0px 1px 2px 0px rgba(26,29,40,0.06)
```
Chevron: 20×20, color `#9F9FA9`, flex-shrink: 0.

### 9.4 Select (transparentny — calendar)

```
position: absolute   inset: 0
opacity: 0           cursor: pointer
```
Label nad nim wyświetla wartość (18px/700, `#18181B`) + ChevronDown 18px.

### 9.5 Stary InputField (legacy)

```css
/* Tailwind: p-2 border border-gray-200 rounded focus:outline-none w-[210px] */
border: 1px solid #e5e7eb  (gray-200)
border-radius: 4px
padding: 8px
width: 210px
focus: border #bfdbfe (blue-200)
error: border #f87171 (red-400)
```
**Uwaga:** Nowy kod powinien używać inputów z sekcji 9.1–9.3, nie legacy Tailwind.

---

## 10. Karty (Cards)

### 10.1 Metric card (Performance)

```
border: 1px solid #F4F4F5
border-radius: 12px
padding: 16px
bg: #FFFFFF
shadow: 0px 1px 2px 0px #1A1D280F
min-height: 110px
display: flex; align-items: center; justify-content: space-between
```

Struktura:
- Label: 14px/500, `#3F3F47`
- Value: 20px/600 lh:28px, `#18181B`
- Change: 12px lh:16px — pozytywna `#1AB25E`/600, negatywna `#FF6F77`/600, prefix `±%`
- Change suffix: `#52525C` " vs previous period"
- Icon accent box: 8px padding, border-radius 8px, bg/color wg metryki

### 10.2 Summary card (keyword positions)

```
bg: #F8F8F9    border-radius: 12px    padding: 16px
display: flex  flex: 1               flex-direction: column
gap: 10px
```

Label: 14px/600, `#3F3F47` + InfoIcon 16px, `#52525C`
Value: 24px/500 lh:32px, `#18181B`

### 10.3 Learn card (dashboard)

```
border: 1px solid #F4F4F5
border-radius: 16px
overflow: hidden
display: flex; flex-direction: column
transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease
```

Thumbnail: aspect-ratio 16/9, bg `#F4F4F5`
Content: padding 16px, flex column, gap 8px
- Label: 13px/500, `#9F9FA9`
- Title: 14px/600, `#000000`, max 3 lines clamp
- Meta: 13px/500, `#9F9FA9`, margin-top: auto

### 10.4 Onboarding card

```
border: 1px solid #F4F4F5
border-radius: 12px
padding: 24px
display: flex; flex-direction: column; gap: 16px
```

Progress bar: height 4px, bg `#E4E4E7`, radius 9999, fill `#137832`

### 10.5 Section panel (biały)

```
border: 1px solid #E4E4E7
border-radius: 12px
bg: #FFFFFF
padding: 16px
```

### 10.6 Section outer wrapper (szary)

```
bg: #F8F8F9
box-shadow: inset 0 0 0 1px #E4E4E7
border-radius: 12px
```

---

## 11. Nawigacja

### 11.1 Global Topbar

```
height: 58px (--topbar-height)
bg: #09090b
padding: 8px 16px 0
position: sticky; top: 0; z-index: 100
font: 14px/600, family: var(--font-family-primary)
color: #FFFFFF
display: flex; align-items: center; justify-content: space-between; gap: 12px
```

Logo: `color: #FF5B49` (--color-text-tertiary), 20px
Separator caret: 18px, `#9F9FA9` (--topbar-muted)
Breadcrumb link: color `#9F9FA9`, hover → `#FFFFFF` (opacity 0.85)
Current section: color `#FFFFFF`

### 11.2 Sidebar

```
width: 224px
bg: #09090b (var(--color-surface-strong))
border-right: 1px solid #221e28 (var(--color-border-strong))
padding: 0 0 16px 0
overflow-y: auto
flex-shrink: 0
hidden na mobile (hidden lg:flex)
```

**Nav item (top level):**
```
display: flex; flex-direction: row; align-items: center
gap: 8px      padding: 8px     border-radius: 8px
font: 14px/500  color: rgba(255,255,255,0.7)
hover: color #FFFFFF, bg-layer opacity 1
active: color #FFFFFF, bg #2F2F34 (via bg-layer)
transition: color 150ms ease
```

**Domain sub-nav item:**
```
padding: 5px 8px   border-radius: 6px
font: 13px          padding-left: indent 8px extra
default: color rgba(255,255,255,0.55), bg transparent
hover: bg rgba(255,255,255,0.06), color rgba(255,255,255,0.85)
active: bg #2F2F34, color #FFFFFF, font-weight 600
transition: color 120ms, background 120ms
```

**Domain header button (toggle):**
```
padding: 6px 8px    border-radius: 8px
font: 13px/600      color: rgba(255,255,255,0.9)
favicon: 16×16px, border-radius: 3px
chevron: 14px, rgba(255,255,255,0.4), rotate -90deg when closed
```

**Tools section label:**
```
font: 13px/600    color: #71717b
padding-left: 6px    border: none, bg: transparent
```

### 11.3 Domain sub-layout header (DomainSubLayout)

Sekcja tytułu wewnątrz content area, powyżej treści strony.
Zawiera nazwę domeny, breadcrumb section, opcjonalne actions.

### 11.4 Mobile bottom nav

Widoczny tylko na < 1024px (lg), hidden na desktop.

---

## 12. Ikony

### Zasady

- Wszystkie ikony to **inline SVG** — brak external icon library
- Atrybuty: `aria-hidden="true"` na dekoracyjnych
- Stroke ikony: `strokeWidth="2"`, `strokeLinecap="round"`, `strokeLinejoin="round"`
- Fill ikony: `fill="currentColor"` — kolor dziedziczony z CSS
- Rozmiary zawsze jawne: `width` i `height` na `<svg>`

### Rozmiary standardowe

| Rozmiar | Kontekst                                     |
|---------|----------------------------------------------|
| 14×14   | domain sub-nav ikony                         |
| 16×16   | sidebar main nav ikony                       |
| 18×18   | filter pills, action ikony w contentcie      |
| 20×20   | toolbar buttons, chart dots                  |
| 24×24   | toolbar icon-only buttons                    |

### Delta indicators (zmiana metryki)

```
up:      trójkąt 8×6, fill #1AB25E
down:    trójkąt 8×6, fill #FF6F77
neutral: kółko 6px diameter, bg #D4D4D8
```

### Chart legend dots

```
8×8px, border-radius: 9999px
clicks:      #74A9FF
impressions: #8B73F6
```

### Metric accent icons (EyeIcon)

```
18×18, fill currentColor
clicks bg:      #DBEAFE, color #155DFC
impressions bg: #E1DBFE, color #783AFB
ctr/position:   #F4F4F5, color #2F2F34
```

---

## 13. Wykres liniowy (LineChart)

```
Container: position relative, height 400px, width 100%
SVG viewBox: dynamiczny, preserveAspectRatio: none
```

**Kolory linii:**
- Clicks: stroke `#74A9FF`, strokeWidth 2.2
- Impressions: stroke `#8B73F6`, strokeWidth 2.2

**Gradient area fill:**
- Clicks: `#BEDBFF` → transparent (stopOpacity 0.28 → 0)
- Impressions: `#C5B8FE` → transparent

**Grid:**
- Poziome linie: `#F4F4F5`, strokeWidth 1

**Osie:**
- Tekst osi: 12px, `#52525C`, family: `var(--font-family-primary)`
- Ticki X: linia `#E4E4E7`, label uppercase `MMM DD`

**Hover:**
- Linia pionowa: `#D4D4D8`, strokeWidth 1, strokeDasharray `6 6`
- Dot clicks: radius 5.5, fill `#74A9FF`
- Dot impressions: radius 5.5, fill `#8B73F6`
- Transition na dot: `cx 90ms linear, cy 90ms linear`

**Tooltip:**
```
bg: #18181B         color: #FFFFFF
border-radius: 4px  padding: 4px 8px
font: 13px/400      max-width: 340px
shadow: 0px 8px 16px 0px #181a220a, ...
position: absolute  z-index: 150
transition: left 90ms linear, top 90ms linear
pointer-events: none
animation: growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)
```

---

## 14. Dropdown / Popover

```
position: absolute
top: calc(100% + 12px)
z-index: 150
bg: #FFFFFF
shadow: 0px 18px 40px 0px rgba(17,24,39,0.14),
        0px 8px 18px 0px rgba(17,24,39,0.09),
        0px 2px 6px 0px rgba(17,24,39,0.06)
animation: growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)
```

**Date picker dropdown:**
```
width: min(580px, calc(100vw - 2rem))
border-radius: 16px
padding: 20px
```

**Location dropdown:**
```
min-width: 300px    border-radius: 12px
padding: 6px 0
```

**Dropdown list item:**
```
padding: 8px 12px    border-radius: 8px
font: 14px/400       color: #3F3F47
hover: bg #F4F4F5
active/selected: bg #F4F4F5, color #09090B, font-weight 600
CheckIcon: #783AFB, 18×18
```

**Account menu:**
```
width: 360px         border-radius: 16px
border: 1px solid #E4E4E7
shadow: 0 14px 40px rgba(0,0,0,0.18)
top: calc(100% + 12px)
```

---

## 15. Kalendarz (Date Picker)

### Header miesiąca

```
font: 18px/700    color: #18181B
select: overlay transparentny (opacity 0) — label pokazuje wartość
ChevronDown: 18px
gap: 12px między miesiącem a rokiem
```

### Nagłówki dni tygodnia

```
font: 14px/500    color: #52525C
padding-bottom: 8px    text-align: center
```

### Komórka dnia

```
width: 14.285%     height: 38px
```

### Przycisk dnia

```
width: 36px    height: 36px    border: none
font: 14px/700

default:   bg transparent, color #18181B
selected:  bg #18181B, color #FFFFFF, border-radius 9999px
in-range:  td bg #F4F4F5 (na poziomie td, nie button)
disabled:  opacity 0.3, cursor not-allowed
outside:   opacity 0.65
today:     color #3F3F47 (nie inny styl)
```

### Nawigacja miesięcy (chevron)

```
width: 36px    height: 36px
border: none   bg: transparent
color: #18181B  cursor: pointer
```

---

## 16. Modal / Overlay

**Legacy Modal (Tailwind):**
```
overlay: bg rgba(255,255,255,0.7) (white/70)
container: bg white, shadow-md, rounded-md, padding 20px
border-top: 1px solid #F3F4F6
max-width: 340px / lg:max-w-md
position: absolute, top: 25% lub center
```

**Nowe modalne (keyword modal, generate modal):**
Brak w starym Modalu — używaj wzorca z overlay `rgba(0,0,0,0.5)` i białym panelem z `border-radius: 16px`.

**Zamknij przycisk w modalu:**
```
position: absolute    right: 8px    top: 8px
padding: 8px          color: #9CA3AF
hover: color #374151, rotate 90deg
transition: color, transform
```

---

## 17. Toast / Notyfikacje

```
/* react-hot-toast */
bg: #FFFFFF          color: #111827
border: 1px solid #E4E4E7
font: 13px           family: var(--font-family-primary)
position: bottom-center
```

---

## 18. Tabela (Performance table)

### Nagłówek tabeli

```
font: 13px/500    color: #71717B
text-align: right (metryki), left (label)
border-bottom: 1px solid #F4F4F5
padding: 8px 12px
```

### Wiersz tabeli

```
border-bottom: 1px solid #F4F4F5
padding: 10px 12px    font: 13px/400

URL link: color #783AFB, hover underline
Path text: color #52525C, font: 12px
Metric value: text-align right, font: 13px/500
Delta: display flex, align center, justify flex-end, gap 4px
```

---

## 19. Layout

### Struktura shell

```
.app-shell
  GlobalTopbar (58px, sticky)
  .app-shell-body (flex row, flex 1, min-h 0)
    Sidebar (224px, lg:flex, hidden mobile)
    main.app-content (flex 1, bg #f8f9ff, border-radius 12px)
  MobileBottomNav (hidden lg)
```

### Padding body

Na desktop: `body { padding: 8px }` → tworzy ciemne marginy wokół shell.

### Content area

```
bg: #F8F9FF    border-radius: 12px (lg)
overflow: hidden (desktop) / auto (mobile)
min-height: 100vh (mobile)
```

### Page content max-width

```
Dashboard / Articles: maxWidth: 880px, margin: 0 auto
Performance:          unset (pełna szerokość)
Activity Log:         maxWidth: 680px
```

---

## 20. Animacje / Motion

```css
--motion-instant: 150ms
--motion-fast:    200ms
--motion-normal:  300ms
--motion-slow:    500ms
```

### Konkretne użycia

| Element                    | Animacja                                              |
|----------------------------|-------------------------------------------------------|
| Dropdown open              | `growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)`        |
| Sidebar sub-nav            | `max-height 200ms ease-out`                           |
| Tools section              | `max-height 200ms ease-out`, chevron `250ms ease`     |
| Nav item hover             | `color 150ms ease`                                    |
| Nav item bg                | `opacity 150ms ease`                                  |
| Button hover               | `background 0.15s`, `color 0.15s`                     |
| Filter pill                | `border-color 150ms ease, box-shadow 150ms ease`      |
| Input focus                | `border-color 0.2s, box-shadow 0.2s`                  |
| Chart tooltip position     | `left 90ms linear, top 90ms linear`                   |
| Chart dot                  | `cx 90ms linear, cy 90ms linear`                      |
| Calendar chevron           | `transform 200ms`                                     |
| Learn card hover           | `transform 0.2s ease, box-shadow 0.2s ease`           |
| Progress bar fill          | `width 0.3s ease`                                     |
| Settings panel             | `CSSTransition 300ms, classNames: settings_anim`      |

### @keyframes growOut

```css
@keyframes growOut {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}
```

---

## 21. Scrollbar

```css
/* Dark (sidebar) */
.styled-scrollbar-dark {
  scrollbar-color: #2a2a2e transparent;
  scrollbar-width: thin;
}
.styled-scrollbar-dark::-webkit-scrollbar { width: 4px; }
.styled-scrollbar-dark::-webkit-scrollbar-thumb { background: #2a2a2e; border-radius: 2px; }

/* Content area (class .styled-scrollbar) */
/* analogiczny ale jaśniejszy — domyślny browser thin */
```

---

## 22. Avatar / Account

```
Avatar small:  width 24px, height 24px, border-radius 8px, bg #E1DBFE
Avatar large:  width 32px, height 32px, border-radius 9999px, bg #F4F4F5
Font: weight 700, color #18181B
Trigger: padding 4px, border-radius 999px, bg #18181B (--topbar-panel)
```

---

## 23. Status / Badges (Activity Log)

```
border-radius: 20px
padding: 1px 8px
font: 11px/600
```

Tabela kolorów: patrz sekcja 3.4.

---

## 24. Progress bar

```
height: 4px
background: #E4E4E7
border-radius: 9999px
overflow: hidden

fill:
  background: #137832
  border-radius: 9999px
  transition: width 0.3s ease
```

---

## 25. Checklist items (onboarding)

```
display: inline-flex    align-items: center    gap: 8px
font: 14px/20px         color: #000000
text-decoration: none

Checkbox circle:
  width: 16px    height: 16px    border-radius: 9999px
  border: 2px solid #52525C
```

---

## 26. Reguły — DO / DON'T

### ✅ DO

- Używaj `var(--font-family-primary)` zawsze
- Używaj wartości hex z tej dokumentacji — nie wymyślaj nowych
- Definiuj stany: default, hover, focus-visible, active, disabled, error
- Używaj `border-radius: 12px` dla kart, `9999px` dla pills
- Stosuj `transition` na wszystkich interaktywnych elementach (min. 150ms)
- Ikony jako inline SVG z `aria-hidden="true"`
- `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` dla truncated text
- `animation: growOut` dla dropdownów/popoverów

### ❌ DON'T

- Nie używaj fontów innych niż Inter Variable
- Nie wprowadzaj nowych kolorów bez dodania ich tutaj
- Nie pomiń stanów hover/focus na interaktywnych elementach
- Nie używaj `outline: none` bez zastąpienia własnym focus styles
- Nie mieszaj ciemnego shell z jasnym content (sidebar = dark, main content = light)
- Nie używaj `box-shadow` z innymi wartościami niż zdefiniowane wyżej
- Nie używaj Tailwind dla nowych komponentów (stary kod tak — nowy kod używa inline styles)
- Nie twórz nowych kart z innym border-radius niż 12px lub 16px

---

## 27. QA Checklist

Przed mergem każdej zmiany UI sprawdź:

- [ ] Font family: `var(--font-family-primary)` wszędzie
- [ ] Kolory: wszystkie z tej dokumentacji
- [ ] Hover state: zdefiniowany na każdym przycisku/linku
- [ ] Focus visible: widoczny ring (purple `rgba(120,58,251,0.1)`)
- [ ] Disabled state: opacity + cursor not-allowed
- [ ] Transition: min. `150ms ease` na wszystkich interaktywnych
- [ ] Border-radius: karty 12px, pills 9999px, dropdowny 12–16px
- [ ] Shadows: tylko z listy w sekcji 7
- [ ] Icons: inline SVG, aria-hidden, strokeWidth 2 (stroke) lub currentColor (fill)
- [ ] Text truncation: ellipsis dla overflow
- [ ] Dropdown: growOut animation + z-index 150
- [ ] Mobile: hidden sidebar (hidden lg:flex), MobileBottomNav visible
