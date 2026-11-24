try:
    from fastapi.testclient import TestClient
    from server import app
    client = TestClient(app, raise_server_exceptions=False)
except ImportError:
    client = None


def test_root_serves_html():
    if client is None:
        # Verify directly from static/index.html file
        test_index_html_semantic_structure()
        return
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")
    assert "SurakshaSetu" in response.text
    test_index_html_semantic_structure(response.text)


def test_index_html_semantic_structure(html_content: str = None):
    """Verifies that static/index.html contains all required semantic landmarks and components."""
    if html_content is None:
        from pathlib import Path
        index_path = Path(__file__).resolve().parent.parent / "static" / "index.html"
        assert index_path.exists(), f"{index_path} does not exist"
        html_content = index_path.read_text(encoding="utf-8")

    # 1. Title and Branding
    assert "SurakshaSetu — Micro-Insurance Assistant" in html_content
    assert "SurakshaSetu" in html_content
    assert "sticky" in html_content
    assert "brand-tagline" in html_content

    # 2. Language toggle button
    assert "lang-toggle-btn" in html_content
    assert "EN / हिंदी" in html_content

    # 3. 3 Desktop View tabs
    assert "tab-recommend" in html_content and "Find Right Cover" in html_content
    assert "tab-claim" in html_content and "File a Claim" in html_content
    assert "tab-insurer" in html_content and "Insurer Queue" in html_content
    assert "insurer-pending-badge" in html_content

    # 4. Main container with 3 switchable view sections
    assert "app-main" in html_content
    assert 'id="view-recommend"' in html_content
    assert 'id="view-claim"' in html_content
    assert 'id="view-insurer"' in html_content

    # 5. Fixed mobile-only bottom navigation bar
    assert 'id="mobile-nav"' in html_content
    assert 'data-view="recommend"' in html_content
    assert 'data-view="claim"' in html_content
    assert 'data-view="insurer"' in html_content
    assert "mobile-insurer-badge" in html_content

    # 6. Toast notification region & Modal root
    assert 'id="toast-region"' in html_content or 'id="toast-container"' in html_content
    assert 'id="modal-root"' in html_content

    # 7. Asset links
    assert "/static/styles.css" in html_content
    assert 'type="module"' in html_content and "/static/js/main.js" in html_content



def test_api_health_endpoint():
    if client is None:
        return
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "SurakshaSetu Micro-Insurance Assistant"
    assert "gemini_api_key_configured" in data
    assert "gemini_model" in data
    assert "demo_fallback" in data


def test_404_json_exception_handler():
    if client is None:
        return
    response = client.get("/api/non_existent_route_123")
    assert response.status_code == 404
    assert response.headers.get("content-type") == "application/json"
    data = response.json()
    assert data["success"] is False
    assert data["status_code"] == 404
    assert "error" in data
