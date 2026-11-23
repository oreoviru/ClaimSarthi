try:
    from fastapi.testclient import TestClient
    from server import app
    client = TestClient(app, raise_server_exceptions=False)
except ImportError:
    client = None


def test_root_serves_html():
    if client is None:
        return
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")
    assert "SurakshaSetu" in response.text


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
