"""Outbound authority links: the Writer proposes, this module verifies.

The reference tool's articles carry two or three links to statutes and public
institutions, and those are a large part of why they read as written by someone who
knows the field. We cannot harvest them from the SERP — a check of the four competitors
ranking for "prywatny detektyw warszawa" found 519 outbound links and not one on an
authority host — so the only source is the writing model, which knows the act by name.

A model-proposed URL is a guess until something checks it, so nothing here trusts one:
every external anchor must be https, on an allowlisted public-institution host, and
actually resolve. Anything else is unwrapped and the article keeps the sentence without
the link.
"""
from __future__ import annotations

import asyncio
import re
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from pipeline.ssrf_guard import ssrf_safe_get

# Matched against the parsed hostname, never the raw URL: `https://evil.com/sejm.gov.pl`
# contains an allowlisted string but resolves to a hostile host. Mirrors AUTHORITY_HOST
# in lib/contentPlanner/knowledgePack/compileWritePlan.ts.
AUTHORITY_HOST = re.compile(
    r"(^|\.)(gov\.pl|gov|sejm\.gov\.pl|isap\.sejm\.gov\.pl|policja\.gov\.pl"
    r"|prokuratura\.gov\.pl|uodo\.gov\.pl|stat\.gov\.pl|nfz\.gov\.pl|ceidg\.gov\.pl"
    r"|biznes\.gov\.pl|europa\.eu|cert\.pl|edu\.pl)$|\.edu$",
    re.IGNORECASE,
)
#: A whole article citing more than this reads as a link farm, not as sourcing.
MAX_EXTERNAL_LINKS = 3
LINK_TIMEOUT_SECONDS = 8


def is_authority_url(url: str) -> bool:
    """https + allowlisted public-institution host. Shape only — says nothing about reachability."""
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    if parsed.scheme != "https" or not parsed.hostname:
        return False
    return bool(AUTHORITY_HOST.search(parsed.hostname))


async def _resolves(url: str) -> bool:
    """A 4xx/5xx or an unreachable host means the model invented the path."""
    try:
        response = await ssrf_safe_get(url, timeout=LINK_TIMEOUT_SECONDS)
    except Exception as exc:
        print(f"[external_links] dropped unreachable {url}: {type(exc).__name__}: {exc}")
        return False
    if response.status_code >= 400:
        print(f"[external_links] dropped {url}: HTTP {response.status_code}")
        return False
    return True


async def verify_external_links(html: str, site_url: str = "") -> tuple[str, int]:
    """Unwrap every external anchor that is not a reachable authority URL.

    Internal anchors are left to ``enforce_internal_links``, which owns the site
    allowlist. Returns ``(html, removed_count)``.
    """
    if not html.strip():
        return html, 0

    site_host = urlparse(site_url).hostname if site_url else None
    soup = BeautifulSoup(html, "html.parser")

    candidates: list[tuple[object, str]] = []
    doomed: list[object] = []
    for anchor in soup.find_all("a"):
        href = (anchor.get("href") or "").strip()
        if not href or href.lower().startswith(("mailto:", "tel:", "#")):
            continue
        try:
            parsed = urlparse(href)
        except ValueError:
            continue
        # Relative, or the client's own site: not ours to judge.
        if not parsed.netloc or (site_host and parsed.hostname == site_host):
            continue
        if is_authority_url(href):
            candidates.append((anchor, href))
        else:
            doomed.append(anchor)

    # Verified in parallel, but only the first few: each one is a live request, and an
    # article that proposed twenty links has already failed the quota below anyway.
    kept = 0
    if candidates:
        checked = candidates[:MAX_EXTERNAL_LINKS]
        results = await asyncio.gather(*(_resolves(url) for _anchor, url in checked))
        for (anchor, _url), ok in zip(checked, results):
            if ok:
                kept += 1
            else:
                doomed.append(anchor)
        doomed.extend(anchor for anchor, _url in candidates[MAX_EXTERNAL_LINKS:])

    for anchor in doomed:
        anchor.unwrap()

    if not doomed:
        return html, 0
    print(f"[external_links] kept {kept} authority link(s), unwrapped {len(doomed)}")
    # "minimal" escapes only <, > and &. The "html" formatter also turns every accented
    # character into a named entity, so unwrapping one link in a Polish article rewrote
    # its prose as "ofert&eogon;" — the text is UTF-8 all the way to storage.
    return soup.decode(formatter="minimal"), len(doomed)
