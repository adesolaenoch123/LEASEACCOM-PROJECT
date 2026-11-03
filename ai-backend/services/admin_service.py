from __future__ import annotations

from typing import Any, Dict, Optional
import re
from difflib import SequenceMatcher

from supabase import Client, create_client

from config import settings


class AdminService:
    """Admin operations for leaseaccom dashboards and moderation flows."""

    def __init__(self) -> None:
        self.client: Optional[Client] = None

        if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
            self.client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    async def get_summary(self) -> Dict[str, Any]:
        if not self.client:
            return {
                "total_properties": 0,
                "approved_properties": 0,
                "pending_verifications": 0,
                "total_users": 0,
                "message": "Supabase backend configuration is not set yet.",
            }

        try:
            properties = self.client.table("properties").select("id, verification_status").execute()
            users = self.client.table("profiles").select("id").execute()
            approval_count = 0
            pending_count = 0
            for row in properties.data or []:
                if row.get("verification_status") == "approved":
                    approval_count += 1
                elif row.get("verification_status") in {"pending", "submitted", "in_review"}:
                    pending_count += 1

            return {
                "total_properties": len(properties.data or []),
                "approved_properties": approval_count,
                "pending_verifications": pending_count,
                "total_users": len(users.data or []),
            }
        except Exception:
            return {
                "total_properties": 0,
                "approved_properties": 0,
                "pending_verifications": 0,
                "total_users": 0,
                "message": "Admin summary could not be loaded from Supabase yet.",
            }

    async def list_properties(self) -> list[dict]:
        if not self.client:
            return []

        try:
            response = self.client.table("properties").select("*").order("created_at", desc=True).execute()
            return response.data or []
        except Exception:
            return []

    async def find_duplicate_properties(self) -> list[dict]:
        """Return explainable likely duplicate pairs; this never changes listings."""
        properties = await self.list_properties()
        pairs = []
        for index, left in enumerate(properties):
            for right in properties[index + 1:]:
                title_a = self._normalize(left.get("title"))
                title_b = self._normalize(right.get("title"))
                address_a = self._normalize(left.get("address") or left.get("location"))
                address_b = self._normalize(right.get("address") or right.get("location"))
                city_a = self._normalize(left.get("city"))
                city_b = self._normalize(right.get("city"))
                title_score = SequenceMatcher(None, title_a, title_b).ratio() if title_a and title_b else 0
                address_score = SequenceMatcher(None, address_a, address_b).ratio() if address_a and address_b else 0
                same_owner = bool(left.get("owner_id") and left.get("owner_id") == right.get("owner_id"))
                same_city = bool(city_a and city_a == city_b)
                same_price = self._price_close(left.get("price"), right.get("price"))
                reasons = []
                if address_score >= 0.82:
                    reasons.append("very similar address/location")
                if title_score >= 0.86:
                    reasons.append("very similar title")
                if same_owner and same_city and same_price and title_score >= 0.65:
                    reasons.append("same owner, city, similar price and title")
                if reasons:
                    pairs.append({"first": left, "second": right, "confidence": round(max(address_score, title_score), 2), "reasons": reasons})
        return pairs

    @staticmethod
    def _normalize(value: Any) -> str:
        return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()

    @staticmethod
    def _price_close(first: Any, second: Any) -> bool:
        try:
            a, b = float(first), float(second)
            return max(a, b) > 0 and abs(a - b) / max(a, b) <= 0.1
        except (TypeError, ValueError):
            return False

    async def bulk_preview(self, status: str = "pending", city: str | None = None) -> list[dict]:
        rows = await self.list_properties()
        status = status.lower().strip()
        return [row for row in rows
                if str(row.get("verification_status") or row.get("listing_status") or "").lower() == status
                and (not city or city.lower() in str(row.get("city") or "").lower())]

    async def bulk_update_properties(self, property_ids: list[str], status: str) -> dict:
        if not self.client:
            raise RuntimeError("Supabase backend is not configured.")
        if status not in {"approved", "rejected"}:
            raise ValueError("Bulk status must be approved or rejected.")
        # Update only records that are still pending, so a stale preview cannot
        # overwrite a decision made by another administrator.
        changed = []
        for property_id in property_ids:
            response = (self.client.table("properties").update({
                "verification_status": status,
                "listing_status": "live" if status == "approved" else "rejected",
            }).eq("id", property_id).eq("verification_status", "pending").select("id").execute())
            changed.extend(response.data or [])
        return {"updated": len(changed), "requested": len(property_ids), "ids": [row["id"] for row in changed]}
