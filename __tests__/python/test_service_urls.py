"""Unit tests for service_urls.nextjs_url resolution."""
import importlib
import os
import sys

import pytest

# Allow importing python-sidecar modules from repo root.
SIDECAR_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "python-sidecar"))
if SIDECAR_ROOT not in sys.path:
    sys.path.insert(0, SIDECAR_ROOT)


@pytest.fixture
def reload_service_urls(monkeypatch):
    def _reload(**env):
        for key in ("NEXTJS_URL", "APP_BASE_URL", "NEXT_PUBLIC_APP_URL", "RENDER", "RAILWAY_ENVIRONMENT", "VERCEL"):
            monkeypatch.delenv(key, raising=False)
        for key, value in env.items():
            if value is None:
                monkeypatch.delenv(key, raising=False)
            else:
                monkeypatch.setenv(key, value)
        import service_urls
        return importlib.reload(service_urls)
    return _reload


def test_deployed_ignores_local_nextjs_url(reload_service_urls):
    mod = reload_service_urls(RENDER="true", NEXTJS_URL="http://127.0.0.1:3000")
    assert mod.nextjs_url() == mod.PRODUCTION_APP_URL


def test_deployed_uses_explicit_public_url(reload_service_urls):
    mod = reload_service_urls(RENDER="true", NEXTJS_URL="https://my-app.vercel.app")
    assert mod.nextjs_url() == "https://my-app.vercel.app"


def test_local_dev_defaults_to_localhost(reload_service_urls):
    mod = reload_service_urls()
    assert mod.nextjs_url() == "http://127.0.0.1:3000"
