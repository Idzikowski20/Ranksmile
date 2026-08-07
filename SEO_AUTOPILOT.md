# SEO Autopilot — Instrukcja uruchomienia

## 1. Zainstaluj zależności Next.js (TipTap)

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-highlight
```

## 2. Uruchom migrację bazy danych

```bash
npm run db:migrate
```

Tworzy tabele: `articles`, `site_context`, `publish_targets`.

## 3. Skonfiguruj zmienne środowiskowe

Skopiuj `.env.example` → `.env.local` i uzupełnij:

```env
PYTHON_SIDECAR_URL=http://localhost:8001
CRON_SECRET=losowy-string-min-32-znaki
ANTHROPIC_API_KEY=sk-ant-...
```

## 4. Uruchom Python sidecar

```bash
cd python-sidecar

# Stwórz .env
cp .env.example .env
# Uzupełnij ANTHROPIC_API_KEY i opcjonalnie SERPAPI_KEY

# Zainstaluj zależności
pip install -r requirements.txt
python -m spacy download pl_core_news_sm
python -m spacy download en_core_web_sm

# Uruchom
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

## 5. Uruchom Ranksmile

```bash
npm run dev
```

Przejdź do: http://localhost:3000/articles

---

## Jak używać

### Generowanie artykułu
1. Otwórz **Artykuły SEO** w bocznym menu
2. Kliknij **Generuj artykuł**
3. Wybierz domenę i wpisz keyword
4. Poczekaj na wygenerowanie (Python sidecar + Claude API)
5. Artykuł otworzy się w edytorze z live Content Score po prawej

### Edytor artykułu (`/articles/[id]`)
- **TipTap editor** — rich text z H1/H2/H3, listy, cytaty
- **Content Score Panel** (prawa strona) — live score 0-100 + NLP Terms
- **Zapisz** — zapisuje edytowaną treść do SQLite
- **Akceptuj / Odrzuć** — zmiana statusu draftu
- **Regeneruj** — tworzy nowy artykuł dla tego samego keyword
- **🌐 WP** — publikuje do WordPress przez REST API
- **▲ Next.js** — publikuje do własnego Next.js endpoint

### Konfiguracja publish targets
Przez API: `POST /api/articles/publish-targets`
```json
{
  "domain_id": 1,
  "type": "wordpress",
  "url": "https://mójblog.pl",
  "api_key": "username:application_password"
}
```

### Automatyczny cron (Railway)
`cron.js` (dedykowany serwis Railway) uruchamia joba **codziennie o 8:00**.
Wymaga zmiennej `CRON_SECRET` i skonfigurowanych `topics` w `site_context`.

---

## Struktura nowych plików

```
ranksmile/
├── pages/articles/
│   ├── index.tsx              ← lista artykułów
│   └── [id]/index.tsx         ← edytor + score panel
├── pages/api/articles/
│   ├── index.ts               ← GET/POST/DELETE artykułów
│   ├── [id].ts                ← GET/PUT/DELETE jednego artykułu
│   ├── generate.ts            ← POST: trigger generowania
│   ├── publish.ts             ← POST: publikacja WP/Next.js
│   ├── accept.ts              ← POST: akceptuj/odrzuć
│   └── publish-targets.ts     ← CRUD konfiguracji publikacji
├── pages/api/cron/
│   └── daily.ts               ← handler cron (wywoływany z cron.js)
├── components/articles/
│   ├── ArticleEditor.tsx      ← TipTap wrapper
│   ├── ContentScorePanel.tsx  ← gauge + NLP terms
│   ├── ArticleList.tsx        ← tabela artykułów
│   └── GenerateModal.tsx      ← modal generowania
├── lib/
│   ├── contentScore.ts        ← formuła scorera
│   ├── wordpressPublish.ts    ← WP REST API client
│   └── richieSchema.ts        ← JSON-LD generator
├── database/migrations/
│   └── 1747440000000-add-articles-tables.js
├── python-sidecar/
│   ├── main.py                ← FastAPI app
│   ├── requirements.txt
│   ├── analyzers/
│   │   ├── site_analyzer.py   ← scrape strony użytkownika
│   │   ├── serp_analyzer.py   ← SerpAPI + TF-IDF
│   │   └── meta_generator.py  ← meta title/desc/URL
│   └── pipeline/
│       └── article_pipeline.py ← Claude multi-step pipeline
└── cron.js                    ← Cron schedule
```
