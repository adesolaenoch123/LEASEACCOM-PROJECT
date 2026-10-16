from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from supabase import Client, create_client

from config import settings


class AgreementService:
    """Rental agreement workflow for leaseaccom."""

    def __init__(self) -> None:
        self.client: Optional[Client] = None

        if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
            self.client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    async def list_agreements(self, user_id: str, role: str) -> List[Dict[str, Any]]:
        if not self.client:
            return []

        try:
            query = self.client.table("agreements").select("*")
            if role == "tenant":
                query = query.eq("tenant_id", user_id)
            elif role == "owner":
                query = query.eq("owner_id", user_id)
            elif role == "admin":
                pass
            else:
                query = query.eq("tenant_id", user_id)

            response = query.order("created_at", desc=True).execute()
            return response.data or []
        except Exception:
            return []

    async def get_agreement(self, agreement_id: str, user_id: str, role: str) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None

        try:
            query = self.client.table("agreements").select("*").eq("id", agreement_id)
            if role == "tenant":
                query = query.eq("tenant_id", user_id)
            elif role == "owner":
                query = query.eq("owner_id", user_id)
            response = query.single().execute()
            return response.data
        except Exception:
            return None

    async def create_agreement(self, payload: Dict[str, Any], tenant_id: str, owner_id: str) -> Dict[str, Any]:
        if not self.client:
            raise RuntimeError("Supabase backend is not configured.")

        existing = await self.get_for_application(str(payload["application_id"]))
        if existing:
            return existing

        data = {
            "tenant_id": tenant_id,
            "owner_id": owner_id,
            "status": "pending",
            **payload,
        }
        try:
            response = self.client.table("agreements").insert(data).execute()
            return response.data[0] if response.data else data
        except Exception:
            existing = await self.get_for_application(str(payload["application_id"]))
            if existing:
                return existing
            raise

    async def get_for_application(self, application_id: str) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None

        response = (
            self.client.table("agreements")
            .select("*")
            .eq("application_id", application_id)
            .maybe_single()
            .execute()
        )
        return response.data

    async def sign_agreement(
        self, agreement_id: str, user_id: str, role: str
    ) -> Optional[Dict[str, Any]]:
        if not self.client:
            raise RuntimeError("Supabase backend is not configured.")

        query = self.client.table("agreements").select("*").eq("id", agreement_id)
        participant_column = "owner_id" if role == "owner" else "tenant_id"
        agreement_response = query.eq(participant_column, user_id).maybe_single().execute()
        agreement = agreement_response.data
        if not agreement:
            return None

        signed_at = datetime.now(timezone.utc).isoformat()
        update: Dict[str, Any] = {"updated_at": signed_at}
        if role == "owner":
            update.update({"owner_agreed": True, "owner_agreed_at": signed_at})
            other_party_agreed = agreement.get("tenant_agreed")
        else:
            update.update({"tenant_agreed": True, "tenant_agreed_at": signed_at})
            other_party_agreed = agreement.get("owner_agreed")
        update["status"] = "signed" if other_party_agreed else "pending"

        result = (
            self.client.table("agreements")
            .update(update)
            .eq("id", agreement_id)
            .eq(participant_column, user_id)
            .select("*")
            .execute()
        )
        return result.data[0] if result.data else None
