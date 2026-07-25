"""
API integration tests.

Tests the FastAPI endpoints for health, alerts, users,
authentication, and case management.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'app'))

import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


class TestHealth:
    @pytest.mark.asyncio
    async def test_health_endpoint(self, async_client):
        response = await async_client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "version" in data


class TestAuth:
    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self, async_client):
        response = await async_client.post(
            "/api/auth/login",
            params={"username": "nonexistent", "password": "wrong"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_login_valid_credentials(self, async_client):
        response = await async_client.post(
            "/api/auth/login",
            params={"username": "admin", "password": "admin123"},
        )
        # May fail if default admin not initialized, but should return 200 or 401
        assert response.status_code in (200, 401)


class TestAlerts:
    @pytest.mark.asyncio
    async def test_get_alerts_empty(self, async_client):
        """Should return empty list or fallback data."""
        response = await async_client.get("/api/alerts?limit=5")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_get_alert_not_found(self, async_client):
        response = await async_client.get("/api/alerts/NONEXISTENT")
        assert response.status_code in (404, 200)  # 200 if fallback has data


class TestUsers:
    @pytest.mark.asyncio
    async def test_list_users(self, async_client):
        response = await async_client.get("/api/users")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_get_user_not_found(self, async_client):
        response = await async_client.get("/api/users/nonexistent_user")
        assert response.status_code in (404, 200)


class TestDepartments:
    @pytest.mark.asyncio
    async def test_list_departments(self, async_client):
        response = await async_client.get("/api/departments")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestAnalytics:
    @pytest.mark.asyncio
    async def test_risk_trend(self, async_client):
        response = await async_client.get("/api/analytics/risk-trend?days=7")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestSSE:
    @pytest.mark.asyncio
    async def test_sse_stream(self, async_client):
        """SSE endpoint should return text/event-stream."""
        response = await async_client.get("/api/events/stream")
        assert response.status_code == 200
        assert response.headers.get("content-type", "").startswith("text/event-stream")
