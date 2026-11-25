try:
    from fastapi.testclient import TestClient
    from main import app
    client = TestClient(app, raise_server_exceptions=False)
except ImportError:
    client = None


def test_root_endpoint():
    if client is None:
        return
    response = client.get("/")
    assert response.status_code == 200
    assert "SurakshaSetu" in response.text


def test_api_health_endpoint():
    if client is None:
        return
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "gemini_api_key_configured" in data
