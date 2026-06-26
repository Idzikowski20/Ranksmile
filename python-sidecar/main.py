"""
SEO Autopilot — Python Sidecar (FastAPI)
Uruchomienie: uvicorn main:app --host 0.0.0.0 --port 8001 --reload
"""
import os
import re
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from bs4 import BeautifulSoup

from analyzers.site_analyzer import analyze_site
from analyzers.serp_analyzer import analyze_serp, extract_competitor_outlines
from analyzers.meta_generator import generate_meta
from analyzers.image_generator import generate_article_image
from analyzers.ai_visibility import run_ai_visibility
from analyzers.ai_readability import run_ai_readability
from analyzers.content_classifier import classify
from analyzers.ranking_scorer import predict_ranking
from analyzers.plagiarism import run_plagiarism
from pipeline.article_pipeline import run_pipeline, suggest_internal_links, generate_brand_knowledge

app = FastAPI(
    title="SEO Autopilot Sidecar",
    description="Python sidecar dla SerpBear — generuje artykuły SEO przez Claude API",
    version="1.0.0",
)

# CORS — zezwól na Next.js dev i produkcję
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ArticleRef(BaseModel):
    id: int
    title: str
    url: str

class GenerateRequest(BaseModel):
    url: str               # URL strony użytkownika
    keyword: str           # target keyword
    language: str = "pl"
    tone: str = "professional"
    existing_articles: list[ArticleRef] = []  # artykuły na tej samej domenie do internal linkingu
    # Wizard params (Select content type → Context & instructions → Writing mode)
    content_type: str = "blog"
    instructions: str = ""
    internal_links: bool = True
    external_links: bool = True
    review_outline: bool = False
    brand_knowledge: str = ""   # shared Brand Knowledge (context for the model)
    voice_tone: str = ""        # selected Custom Voice reference text — drives tone/style


class GenerateResponse(BaseModel):
    model_config = {"arbitrary_types_allowed": True}

    article_html: str
    meta_title: str
    meta_description: str
    meta_url: str
    article_schema: dict    # JSON-LD schema (zmieniono z schema_json — konflikt z Pydantic)
    score_data: dict        # { terms, words_target, words_min, words_max, headings_* }
    internal_links: list
    site_audit: dict = {}   # pełny audyt techniczny SEO z site_analyzer


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


@app.post("/generate", response_model=GenerateResponse)
async def generate_article(req: GenerateRequest):
    """
    Główny endpoint — pipeline:
    1. Audyt techniczny SEO strony (site_analyzer)
    2. SERP analysis + TF-IDF
    3. Generacja artykułu przez DeepSeek (3-fazowa)
    4. Meta dane
    5. Internal links
    6. Priorytetyzowane rekomendacje
    """
    deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")
    if not deepseek_key:
        raise HTTPException(
            status_code=500,
            detail="DEEPSEEK_API_KEY not configured. Set it in python-sidecar/.env"
        )

    # 1. Analiza strony
    print(f"[generate] Analyzing site: {req.url}")
    site_context = await analyze_site(req.url)

    # 2. SERP analysis
    print(f"[generate] Analyzing SERP for keyword: {req.keyword}")
    serp_data = await analyze_serp(req.keyword, req.language)

    # 3. Generuj artykuł przez Claude
    print(f"[generate] Running AI pipeline...")
    article_html = await run_pipeline(
        site_context=site_context,
        serp_data=serp_data,
        keyword=req.keyword,
        language=req.language,
        tone=req.tone or site_context.get("tone", "professional"),
        target_words=serp_data.get("words_target", 2200),
        content_type=req.content_type,
        instructions=req.instructions,
        external_links=req.external_links,
        brand_knowledge=req.brand_knowledge,
        voice_tone=req.voice_tone,
    )

    # 4. Meta dane
    print(f"[generate] Generating meta...")
    meta = generate_meta(article_html, req.keyword, req.language)

    # 5. Internal links (skip when disabled in the wizard)
    links = await suggest_internal_links(
        article_html=article_html,
        site_url=req.url,
        existing_articles=[a.model_dump() for a in req.existing_articles],
    ) if req.internal_links else []

    import datetime as dt

    # 6. Schema JSON-LD (Richie.js-compatible — pełny BlogPosting)
    site_url = req.url.rstrip('/')
    article_url = f"{site_url}/{meta['meta_url']}"
    now_iso = dt.datetime.utcnow().isoformat() + "Z"

    schema = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "@id": article_url,
        "headline": meta["meta_title"],
        "description": meta["meta_description"],
        "url": article_url,
        "datePublished": now_iso,
        "dateModified": now_iso,
        "author": {
            "@type": "Organization",
            "name": site_context.get("title", req.url),
            "url": site_url,
        },
        "publisher": {
            "@type": "Organization",
            "name": site_context.get("title", req.url),
            "url": site_url,
        },
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": article_url,
        },
        "keywords": [
            req.keyword,
            *[t["term"] for t in serp_data.get("terms", [])[:10]],
        ],
    }

    # Score data — z SERP analizy
    score_data = {
        "terms": serp_data.get("terms", []),
        "words_target": serp_data.get("words_target", 2200),
        "words_min": serp_data.get("words_min", 1500),
        "words_max": serp_data.get("words_max", 3000),
        "headings_target": serp_data.get("headings_target", 15),
        "headings_min": serp_data.get("headings_min", 10),
        "headings_max": serp_data.get("headings_max", 25),
    }

    # Wyciągnij dane audytu z site_context + priorytetyzowane rekomendacje
    recommendations = _build_recommendations(site_context, serp_data)
    site_audit = {
        "meta": site_context.get("meta", {}),
        "headings": site_context.get("headings", {}),
        "content": site_context.get("content", {}),
        "images": site_context.get("images", {}),
        "schema": site_context.get("schema", {}),
        "tech": site_context.get("tech", {}),
        "issues": site_context.get("issues", []),
        "issue_count": site_context.get("issue_count", 0),
        "issue_count_error": site_context.get("issue_count_error", 0),
        "issue_count_warning": site_context.get("issue_count_warning", 0),
        "score": site_context.get("score", 0),
        "recommendations": recommendations,
    }

    print(f"[generate] Done! Article length: {len(article_html)} chars, site audit score: {site_audit['score']}")

    return GenerateResponse(
        article_html=article_html,
        meta_title=meta["meta_title"],
        meta_description=meta["meta_description"],
        meta_url=meta["meta_url"],
        article_schema=schema,
        score_data=score_data,
        internal_links=links,
        site_audit=site_audit,
    )


@app.post("/generate-image")
async def generate_image_endpoint(body: dict):
    """Generuje obraz dla artykułu SEO."""
    keyword = body.get("keyword", "")
    title = body.get("title", keyword)
    style = body.get("style", "professional")
    if not keyword:
        raise HTTPException(status_code=400, detail="keyword is required")
    print(f"[image] Generating image for: {keyword}")
    result = await generate_article_image(keyword, title, style)
    print(f"[image] Done: {result['source']} → {result['url'][:80]}...")
    return result


@app.post("/analyze-site")
async def analyze_site_endpoint(body: dict):
    """Pomocniczy endpoint — tylko analiza strony."""
    url = body.get("url", "")
    if not url:
        raise HTTPException(status_code=400, detail="url is required")
    return await analyze_site(url)


@app.post("/brand-knowledge")
async def brand_knowledge_endpoint(body: dict):
    """Scrape a company URL and let AI draft the Brand Knowledge fields."""
    url = body.get("url", "")
    if not url:
        raise HTTPException(status_code=400, detail="url is required")
    if not os.getenv("DEEPSEEK_API_KEY", ""):
        raise HTTPException(status_code=500, detail="DEEPSEEK_API_KEY not configured")
    print(f"[brand-knowledge] Analyzing {url}")
    site = await analyze_site(url)
    meta = site.get("meta", {}) or {}
    content = site.get("content", {}) or {}
    return await generate_brand_knowledge(
        url,
        meta.get("title", "") or site.get("title", ""),
        meta.get("description", ""),
        content.get("text", ""),
    )


@app.post("/plagiarism")
async def plagiarism_endpoint(body: dict):
    """Exact-phrase plagiarism scan against the web via serper.dev."""
    text = body.get("text", "")
    own_domain = body.get("domain", "")
    lang = body.get("language", "pl")
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="text is required")
    print(f"[plagiarism] Scanning {len(text)} chars (own={own_domain})")
    return await run_plagiarism(text, own_domain, lang)


@app.post("/analyze-serp")
async def analyze_serp_endpoint(body: dict):
    """Pomocniczy endpoint — tylko analiza SERP."""
    keyword = body.get("keyword", "")
    language = body.get("language", "pl")
    if not keyword:
        raise HTTPException(status_code=400, detail="keyword is required")
    return await analyze_serp(keyword, language)


@app.post("/competitor-outlines")
async def competitor_outlines_endpoint(body: dict):
    """Research & Outline — zwraca heading structure konkurencyjnych stron."""
    keyword = body.get("keyword", "")
    language = body.get("language", "pl")
    num = body.get("num", 5)
    if not keyword:
        raise HTTPException(status_code=400, detail="keyword is required")
    print(f"[competitor-outlines] Fetching top {num} for: {keyword}")
    try:
        outlines = await extract_competitor_outlines(keyword, language, num)
        return {"competitors": outlines}
    except Exception as e:
        print(f"[competitor-outlines] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai-visibility")
async def ai_visibility_endpoint(body: dict):
    """AI Search visibility check for one article/keyword."""
    keyword = body.get("keyword", "")
    own_domain = body.get("own_domain", "")
    competitor_domains = body.get("competitor_domains", [])
    article_content = body.get("article_content", "")
    if not keyword:
        raise HTTPException(status_code=400, detail="keyword is required")
    return await run_ai_visibility(keyword, own_domain, competitor_domains, article_content)


@app.post("/ai-readability")
async def ai_readability_endpoint(body: dict):
    """LLM rubric: how well the article is structured for AI/readers (10 criteria)."""
    article_content = body.get("article_content", "")
    keyword = body.get("keyword", "")
    return await run_ai_readability(article_content, keyword)


class PipelineRequest(BaseModel):
    jobId: str
    payload: dict  # { url, keyword, language, tone, existing_articles }


@app.post("/pipeline/deep-analysis")
async def pipeline_deep_analysis(req: PipelineRequest):
    """
    Event-driven pipeline endpoint.
    Called by TypeScript after INSERTing job into analysis_jobs.
    Python runs the 5-stage pipeline, pushes progress via job-progress endpoint.
    Returns {status, result} — TypeScript writes this to analysis_jobs.result.
    """
    from pipeline.runner import PipelineRunner

    nextjs_url = os.getenv("NEXTJS_URL", "http://127.0.0.1:3000")
    print(f"[pipeline] Starting deep analysis for job {req.jobId}")

    ctx = PipelineRunner.build_deep_analysis_ctx(
        req.jobId, req.payload, nextjs_url
    )
    runner = PipelineRunner(PipelineRunner.build_deep_analysis_pipeline(), ctx)

    try:
        result = await runner.run()
        print(f"[pipeline] Job {req.jobId} completed successfully")
        return {"status": "done", "result": result}
    except Exception as exc:
        print(f"[pipeline] Job {req.jobId} failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ── Score Content Endpoint ──────────────────────────────────────────

def _extract_site_context_from_html(html: str, explicit_title: str = "", explicit_meta_description: str = "") -> dict:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
        tag.decompose()
    text = soup.get_text(separator=" ", strip=True)

    title_tag = soup.find("title")
    html_title = title_tag.get_text(strip=True) if title_tag else ""
    title_text = explicit_title or html_title

    desc_tag = soup.find("meta", attrs={"name": "description"})
    html_desc = desc_tag.get("content", "")[:300] if desc_tag else ""
    desc_text = explicit_meta_description or html_desc

    og_title = soup.find("meta", property="og:title")
    og_desc = soup.find("meta", property="og:description")
    og_image = soup.find("meta", property="og:image")
    canonical = soup.find("link", rel="canonical")

    headings = soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"])
    word_count = len(text.split())
    paragraphs = [p for p in soup.find_all("p") if len(p.get_text(strip=True)) > 30]

    return {
        "meta": {
            "title": title_text,
            "title_length": len(title_text),
            "description": desc_text,
            "description_length": len(desc_text),
            "og_title": og_title.get("content", "") if og_title else "",
            "og_description": og_desc.get("content", "") if og_desc else "",
            "og_image": og_image.get("content", "") if og_image else "",
            "canonical": canonical.get("href", "") if canonical else "",
        },
        "content": {
            "word_count": word_count,
            "paragraph_count": len(paragraphs),
            "text": text,
        },
        "headings": {"total": len(headings)},
        "issues": [],
    }


def _compute_content_score(plain_text: str, word_count: int, heading_count: int, paragraph_count: int, score_data: dict) -> int:
    words_target = score_data.get("words_target") or 2200
    headings_target = score_data.get("headings_target") or 15
    paragraphs_target = score_data.get("paragraphs_target") or 20

    word_score = min(30, round((word_count / max(1, words_target)) * 30))
    heading_score = min(15, round((heading_count / max(1, headings_target)) * 15))
    para_score = min(15, round((paragraph_count / max(1, paragraphs_target)) * 15))

    text = plain_text.lower()
    terms = score_data.get("terms", [])
    if terms:
        covered = 0
        for t in terms:
            term = str(t.get("term", "")).lower()
            target = max(1, int(t.get("target_count", 1)))
            count = len(re.findall(r"\b" + re.escape(term) + r"\b", text))
            if count >= max(1, round(target * 0.7)):
                covered += 1
        term_score = round((covered / len(terms)) * 40)
    else:
        term_score = 0

    return min(100, word_score + heading_score + para_score + term_score)


@app.post("/score-content")
async def score_content_endpoint(body: dict, request: Request):
    token = request.headers.get("x-internal-token", "")
    expected = os.getenv("INTERNAL_PIPELINE_TOKEN", "")
    if expected and token != expected:
        raise HTTPException(status_code=401, detail="unauthorized")

    html = body.get("html", "")
    keyword = body.get("keyword", "")
    score_data = body.get("score_data", {})
    explicit_title = body.get("title", "")
    explicit_meta_description = body.get("meta_description", "")

    if not html:
        raise HTTPException(status_code=400, detail="html is required")

    deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")

    try:
        site_context = _extract_site_context_from_html(html, explicit_title, explicit_meta_description)

        serp_data = {
            "words_target": score_data.get("words_target") or 2200,
            "headings_target": score_data.get("headings_target") or 15,
            "paragraphs_target": score_data.get("paragraphs_target") or 20,
        }

        content_class = await classify(html)

        wc = site_context["content"]["word_count"]
        hc = site_context["headings"]["total"]
        pc = site_context["content"]["paragraph_count"]
        content_score = _compute_content_score(site_context["content"]["text"], wc, hc, pc, score_data)

        result = await predict_ranking(
            keyword=keyword,
            content_score=content_score,
            site_context=site_context,
            serp_data=serp_data,
            content_class=content_class,
            deepseek_key=deepseek_key,
        )

        return result

    except Exception as exc:
        print(f"[score-content] Error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ── Optimization Advisor ──────────────────────────────────────────────
# Inspirowane multi-agent SEO pipeline: łączy audyt strony z danymi SERP
# i generuje priorytetyzowaną listę rekomendacji.

def _build_recommendations(site_context: dict, serp_data: dict) -> list[dict]:
    """Buduje priorytetyzowaną listę rekomendacji z audytu + SERP."""
    recommendations = []

    # 1. Najpierw błędy krytyczne z audytu (severity=error)
    for issue in site_context.get("issues", []):
        if issue["severity"] == "error":
            recommendations.append({
                "priority": "critical",
                "category": issue.get("check", "Technical"),
                "action": issue.get("recommendation", issue.get("message", "")),
                "impact": "high",
                "effort": estimate_effort(issue.get("check", "")),
            })

    # 2. Ostrzeżenia z audytu (severity=warning)
    for issue in site_context.get("issues", []):
        if issue["severity"] == "warning":
            recommendations.append({
                "priority": "high",
                "category": issue.get("check", "Technical"),
                "action": issue.get("recommendation", issue.get("message", "")),
                "impact": "medium",
                "effort": estimate_effort(issue.get("check", "")),
            })

    # 3. Rekomendacje treściowe z SERP
    word_count = site_context.get("content", {}).get("word_count", 0)
    serp_words_target = serp_data.get("words_target", 0)
    if serp_words_target and word_count < serp_words_target * 0.7:
        recommendations.append({
            "priority": "medium",
            "category": "Content Depth",
            "action": f"Content is {word_count} words vs. SERP average of {serp_words_target}. Add {serp_words_target - word_count}+ words to match competitor depth.",
            "impact": "high",
            "effort": "medium",
        })

    headings = site_context.get("headings", {})
    serp_heading_target = serp_data.get("headings_target", 0)
    current_headings = headings.get("total", 0)
    if serp_heading_target and current_headings < serp_heading_target * 0.7:
        recommendations.append({
            "priority": "medium",
            "category": "Content Structure",
            "action": f"Page has {current_headings} headings vs. SERP avg {serp_heading_target}. Add more H2/H3 sections to structure content better.",
            "impact": "medium",
            "effort": "low",
        })

    # 4. Rekomendacja structured data
    if site_context.get("schema", {}).get("count", 0) == 0:
        recommendations.append({
            "priority": "medium",
            "category": "Structured Data",
            "action": "Add JSON-LD structured data (Article, FAQ, or BreadcrumbList) to enable rich results in Google SERP.",
            "impact": "medium",
            "effort": "low",
        })

    # Sort: critical → high → medium
    priority_order = {"critical": 0, "high": 1, "medium": 2}
    recommendations.sort(key=lambda r: priority_order.get(r["priority"], 3))

    return recommendations


def estimate_effort(check: str) -> str:
    """Estymuje poziom wysiłku dla danego checka SEO."""
    low_effort = {"Meta Title", "Meta Description", "H1 Tag", "Viewport", "Heading Hierarchy", "Image Alt Text", "OG Title", "OG Description", "OG Image"}
    if check in low_effort:
        return "low"
    medium_effort = {"Content Length", "Paragraphs", "H2 Tags", "Structured Data", "Image Dimensions", "Hreflang"}
    if check in medium_effort:
        return "medium"
    return "high"
