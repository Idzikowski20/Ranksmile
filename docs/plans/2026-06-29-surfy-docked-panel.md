# Surfy → Docked Light Right-Panel (Twenty-style) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development or executing-plans. Steps use `- [ ]`.

**Goal:** Move Surfy from the floating dark bottom modal into a docked LIGHT pane in the editor's right column (toggled like Version History), styled like Twenty CRM's AI chat, with a real context-token-usage ring.

**Architecture:** Lift all Surfy state + handlers out of `ArticleEditor.tsx` into a `useSurfy(editorRef, ctx)` hook called in `pages/articles/[id]/index.tsx`. Render `<SurfyChatPanel>` in the right panel's bottom card (new `showSurfy` branch beside `showHistory`). The bubble-menu/toolbar "Ask Surfy" buttons call an `onAskSurfy` callback up to the page. Remove the floating modal entirely.

**Tech stack:** Next 12 pages-router, inline styles, `react-markdown`+`remark-gfm` for the assistant body, existing SSE agent (`/api/articles/surfy-agent`, `/api/articles/ask-surfy`), design.md light tokens (white `#fff`, border `#e4e4e7`/`#f4f4f5`, text `#18181b`/`#52525c`/`#9f9fa9`, accent `#783afb`, input focus `#AA93FD` + `rgba(120,58,251,0.1)`), `var(--font-family-primary)`.

**Token mapping (Twenty → Surfy):** ring = `lastInputTokens / CONTEXT_WINDOW` (deepseek-chat ≈ 64000). Thresholds: <60% accent, 60–80% amber `#d97706`, >80% red `#ef4444`. Hover card: Context window (% + used/window + bar), Last message (input/output tokens), Conversation (running totals). Real tokens from the agent `done` event (already returns `usage.{inputTokens,outputTokens,totalTokens}`).

---

### Task 1: `lib/ai/contextWindow.ts` — model context-window registry + helpers
**Files:** Create `lib/ai/contextWindow.ts`; Test `__tests__/lib/ai/contextWindow.test.ts`
- [ ] Export `CONTEXT_WINDOW_TOKENS = 64000` and `contextUsageColor(pct)` → `'#ef4444' | '#d97706' | '#783afb'` (>80 / >60 / else). Add `formatTokensAbbrev(n)` (e.g. 12.3k / 980) reusing `formatTokens` from `lib/ai/sse.ts` or re-exporting.
- [ ] Test thresholds (59→accent, 60.1→amber, 80.1→red) and abbreviation.

### Task 2: `components/articles/ContextUsageRing.tsx` — real-usage ring + hover card (light)
**Files:** Create `components/articles/ContextUsageRing.tsx`
- [ ] Props `{ conversationTokens, contextWindow, lastInput, lastOutput, totalInput, totalOutput }`. SVG ring (size 16, stroke 2, rotate -90) coloured by `contextUsageColor(pct)`, `pct = min(conversationTokens/contextWindow*100,100)`. No number inside the ring.
- [ ] Hover card (light `#fff`, border `#e4e4e7`, radius 12, shadow `0 8px 24px rgba(24,26,34,0.16)`): "Context window" row (`pct%` + `used / window tokens` + thin bar), "Last message" (input/output), "Conversation" (totals). Tabular-nums. Replaces `TokenCircle` usage in the docked panel.

### Task 3: `components/articles/SurfyMarkdown.tsx` — assistant markdown body (light)
**Files:** Create `components/articles/SurfyMarkdown.tsx`; package.json (add `react-markdown` + `remark-gfm` pinned)
- [ ] `npm i react-markdown@9 remark-gfm@4 --save-exact` (verify versions install).
- [ ] Render markdown with light styles per Twenty mapping: h1 1.6em/h2 1.3em/h3 1.15em (weight 600, `#18181b`), p line-height 1.5, bold 600, links `#783afb` (underline on hover), inline code on `#f4f4f5` radius 6 mono, code blocks bordered `#e4e4e7` bg `#f8f9ff` scroll-x, ul/ol disc/decimal pad-left 24, blockquote 3px `#e4e4e7` left border `#52525c`, tables bordered `#e4e4e7` header bg `#f4f4f5`. Keep current `parseInlineFormatting`-equivalent behavior but via react-markdown.

### Task 4: `components/articles/SurfyMessage.tsx` — one chat message (light, Twenty-style)
**Files:** Create `components/articles/SurfyMessage.tsx`
- [ ] User: grey bubble `#f4f4f5`, `fit-content`, right-aligned, radius 8, padding `8px 12px`, weight 500, `#18181b`, pre-wrap.
- [ ] Assistant: transparent, full-width, left-aligned, `#18181b`, renders `<SurfyMarkdown>`; optional action-label pill.
- [ ] List gap 16, no avatars (small "Surfy" label optional above assistant).

### Task 5: `hooks/useSurfy.ts` — lift all Surfy state + handlers out of ArticleEditor
**Files:** Create `hooks/useSurfy.ts`; modify `components/articles/ArticleEditor.tsx` (remove the moved state/handlers + floating modal JSX)
- [ ] Move into the hook: `surfyOpen/minimized/loading/history/response/streamText/activity/tokens/usageDetail/selection/prompt`, refs (`abort/original/meta`), `readSurfyAgentStream`, `handleSurfySubmit`, `handleSurfyApply`, `confirmPublish`, suggested prompts, autoscroll. The hook takes `{ getEditor, keyword, scoreData, internalArticles, metaTitle, metaDescription, commentAuthor, commentArticleId, articleKeyword, onAiActivity }` and returns state + actions.
- [ ] Keep selection capture: `openSurfy()` reads `getEditor().state.selection` for selection mode.
- [ ] ArticleEditor: delete the floating modal block (header/body/composer) and the moved handlers; add `onAskSurfy?: (sel) => void` prop; the bubble-menu/toolbar "Ask Surfy" now call `onAskSurfy`.

### Task 6: `components/articles/SurfyChatPanel.tsx` — the docked light pane
**Files:** Create `components/articles/SurfyChatPanel.tsx`
- [ ] Header: back/close (`onClose`), "Surfy" + alpha tag, `ContextUsageRing`. Light `#fff`, border-bottom `#f4f4f5`, padding 16.
- [ ] Body: flex column scroll (gap 16, padding 16), maps history via `SurfyMessage`, live stream (shimmer + tool-step rows), "What Surfy did"/pending publish/apply buttons (light themed). Auto-scroll to bottom.
- [ ] Composer: bordered box (`#d4d4d8`, focus `#AA93FD` + ring), suggestions, autogrow textarea (`Ask, search or create anything…`), round purple send. Footer note.
- [ ] Props = the `useSurfy` return.

### Task 7: Wire into the page + toolbar toggle; remove floating modal usage
**Files:** modify `pages/articles/[id]/index.tsx`
- [ ] Call `useSurfy(...)` with page context + `getEditor`. Add `showSurfy` state.
- [ ] Add an "Ask Surfy" `IconBtn` in the right-panel toolbar (beside Version History) that toggles `showSurfy` (and closes history). Add the collapsed-bar variant too.
- [ ] In the bottom card render: `showSurfy ? <SurfyChatPanel .../> : showHistory ? <VersionHistoryPanel/> : <ContentScorePanel/>`.
- [ ] Pass `onAskSurfy={(sel)=>{ setShowHistory(false); openSurfy(sel); setShowSurfy(true); }}` to `ArticleEditor`.
- [ ] Keep `onAiActivity` driving the amber glow.

### Task 8: Real token usage end-to-end
**Files:** modify `pages/api/articles/surfy-agent.ts` (already returns usage) + `useSurfy.ts`
- [ ] Agent `done` already sends `usage.{inputTokens,outputTokens,totalTokens}`. In the hook, track `lastInput/lastOutput` (from this turn) and running `totalInput/totalOutput`; `conversationTokens = lastInput` (≈ context sent). Feed `ContextUsageRing`.
- [ ] Delete `TokenCircle` import from the (removed) modal; keep `TokenCircle.tsx` only if still used elsewhere, else remove.

### Task 9: Verify
- [ ] `npx tsc --noEmit` clean; `npx jest __tests__/lib/ai` green; `next build` passes.
- [ ] Manual: toolbar toggle opens/closes; bubble-menu Ask Surfy opens docked panel with selection; markdown renders; streaming + tool steps show; apply changes works + autosaves; ring shows real % with hover card; amber glow still fires.

---

## Self-review notes
- Coupling risk: the editor instance is reached only via `editorRef.current.getEditor()` (already the page's pattern) — the hook must null-guard it.
- The floating modal removal (Task 5) is the largest diff; do it AFTER SurfyChatPanel renders correctly so there's no dead period.
- Keep `ask-surfy` (selection) + `surfy-agent` (article) routing unchanged.
