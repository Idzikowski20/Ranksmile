# RSDS verification (DoD)

## Smoke (editor with plugin connected)

- `typeof window.ranksmile === 'object'`
- `window.ranksmile.version` defined
- `typeof window.wpsurfer === 'undefined'`
- Disconnect AJAX action: `disconnect_ranksmile`

## Accessibility

- Focus-visible on `.rs-btn` / `.rs-nav__link` / inputs
- Keyboard nav through shell sidebar
- `prefers-reduced-motion` disables skeleton animation / transitions

## Visual regression baselines (manual / Playwright)

1. Dashboard Control Center + Plugin Health  
2. Action Bar on Articles vs Settings  
3. Empty Articles / GSC / Integrations  
4. Status connected / warning / error  
5. Notification Center flash after save  
6. Settings Advanced collapsed vs open  
7. Skeleton (optional)  
8. Email HTML preview  

## Performance budgets

| Asset | Limit |
|-------|-------|
| design-tokens + theme + components.bundle + legacy | < 100 KB combined source |
| DM Sans woff2 (3 files) | < 250 KB |
| Design-layer CSS HTTP requests | ≤ 4 |
