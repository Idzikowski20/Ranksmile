# RSDS Information Architecture

Admin = **Admin Shell** + **apps-in-shell** (not classic WP settings pages).

## Navigation

```text
Dashboard                    (default landing)

Content
 ├── Articles
└── Content Audit

Search
└── Google Search Console

Workspace
├── Integrations
└── Settings

Support
└── Help

Insights (stubs)
├── AI Visibility
├── Benchmark
└── Reports
```

## Patterns

- Card-first layout
- Unified Action Bar per section
- Global Status System + Empty + skeleton states
- Notification Center in shell (not scattered `admin_notice`)
- Future Insights modules unlock without menu rebuild
