"""OpenRouteService adapter for the Bengaluru control-tower demo.

All calls are made server-side so ORS_API_KEY is never exposed in Vite.
"""
from __future__ import annotations

import asyncio
import math
import os
import time
from dataclasses import dataclass
from typing import Any

import httpx


Coordinate = tuple[float, float]  # latitude, longitude


@dataclass
class CacheEntry:
    value: dict[str, Any]
    expires_at: float


class OperationalRoutingService:
    def __init__(self) -> None:
        self.api_key = os.getenv("ORS_API_KEY", "").strip()
        self.base_url = os.getenv("ORS_BASE_URL", "https://api.openrouteservice.org/v2").rstrip("/")
        self._route_cache: dict[str, CacheEntry] = {}
        self._isochrone_cache: dict[str, CacheEntry] = {}

    @property
    def provider_status(self) -> str:
        return "openrouteservice" if self.api_key else "demo-fallback"

    @staticmethod
    def _key(*values: object) -> str:
        return "|".join(str(value) for value in values)

    @staticmethod
    def _cached(cache: dict[str, CacheEntry], key: str) -> dict[str, Any] | None:
        entry = cache.get(key)
        return entry.value if entry and entry.expires_at > time.monotonic() else None

    @staticmethod
    def _route_fallback(start: Coordinate, end: Coordinate) -> dict[str, Any]:
        """Clearly marked preview geometry used only until ORS_API_KEY is configured."""
        midpoint = ((start[0] + end[0]) / 2 + 0.002, (start[1] + end[1]) / 2 - 0.002)
        return {
            "type": "Feature",
            "properties": {"provider": "demo-fallback", "isFallback": True},
            "geometry": {"type": "LineString", "coordinates": [[start[1], start[0]], [midpoint[1], midpoint[0]], [end[1], end[0]]]},
        }

    @staticmethod
    def _isochrone_fallback(center: Coordinate, minutes: int) -> dict[str, Any]:
        points: list[list[float]] = []
        radius_deg = max(0.006, minutes * 0.00135)
        for index in range(25):
            angle = (math.pi * 2 * index) / 24
            points.append([center[1] + math.cos(angle) * radius_deg, center[0] + math.sin(angle) * radius_deg * 0.78])
        return {
            "type": "FeatureCollection",
            "features": [{"type": "Feature", "properties": {"provider": "demo-fallback", "isFallback": True, "value": minutes * 60}, "geometry": {"type": "Polygon", "coordinates": [points]}}],
        }

    async def route(self, start: Coordinate, end: Coordinate, alternatives: bool = False) -> dict[str, Any]:
        key = self._key("route", start, end, alternatives)
        cached = self._cached(self._route_cache, key)
        if cached:
            return cached
        if not self.api_key:
            return self._route_fallback(start, end)

        payload: dict[str, Any] = {"coordinates": [[start[1], start[0]], [end[1], end[0]]]}
        if alternatives:
            payload["alternative_routes"] = {"target_count": 1, "weight_factor": 1.4, "share_factor": 0.6}
        headers = {"Authorization": self.api_key, "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.post(f"{self.base_url}/directions/driving-car/geojson", json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
        feature = data["features"][0]
        feature.setdefault("properties", {})["provider"] = "openrouteservice"
        feature["properties"]["isFallback"] = False
        self._route_cache[key] = CacheEntry(feature, time.monotonic() + 90)
        return feature

    async def isochrone(self, center: Coordinate, minutes: int = 10, risk_multiplier: float = 1.0) -> dict[str, Any]:
        effective_seconds = max(180, int(minutes * 60 * risk_multiplier))
        key = self._key("isochrone", center, minutes, round(risk_multiplier, 2))
        cached = self._cached(self._isochrone_cache, key)
        if cached:
            return cached
        if not self.api_key:
            return self._isochrone_fallback(center, minutes)

        headers = {"Authorization": self.api_key, "Content-Type": "application/json"}
        payload = {"locations": [[center[1], center[0]]], "range": [effective_seconds], "range_type": "time"}
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.post(f"{self.base_url}/isochrones/driving-car", json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
        for feature in data.get("features", []):
            feature.setdefault("properties", {})["provider"] = "openrouteservice"
            feature["properties"]["isFallback"] = False
        self._isochrone_cache[key] = CacheEntry(data, time.monotonic() + 300)
        return data

    async def evaluate_many(self, requests: list[tuple[Coordinate, Coordinate]]) -> list[dict[str, Any]]:
        return await asyncio.gather(*(self.route(start, end, alternatives=True) for start, end in requests))
