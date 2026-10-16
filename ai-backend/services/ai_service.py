from __future__ import annotations

import re

import httpx

from config import settings
from tools.property_search import PropertySearchTool


class AIService:
    """leaseaccom AI service with an OpenAI-compatible LLM integration and a Supabase-backed property search tool."""

    def __init__(self) -> None:
        self.model = settings.LLM_MODEL
        self.property_search_tool = (
            PropertySearchTool() if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY else None
        )

    @staticmethod
    def _extract_search_filters(message: str) -> dict:
        cleaned = re.sub(r"[^a-zA-Z0-9\s-]", " ", message.lower())
        text = " ".join(cleaned.split())

        filters: dict = {}

        city_match = re.search(r"\bin\s+([a-z0-9\s-]+?)(?:\s+(?:apartment|apartments|house|houses|studio|studios|flat|flats|budget|under|max|for|near|around)|$)", text)
        if city_match:
            city = city_match.group(1).strip()
            if city and len(city) <= 40:
                filters["city"] = city.title()

        type_match = re.search(r"\b(apartment|apartments|house|houses|studio|studios|flat|flats)\b", text)
        if type_match:
            value = type_match.group(1).lower()
            if value.endswith("s"):
                value = value[:-1]
            filters["type"] = value

        max_price_match = re.search(r"(?:under|budget|max|up to|less than|below)\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)", text)
        if not max_price_match:
            max_price_match = re.search(r"\$\s*(\d+(?:,\d{3})*(?:\.\d+)?)", text)
        if max_price_match:
            raw_price = max_price_match.group(1).replace(",", "")
            filters["max_price"] = float(raw_price)

        return filters

    @staticmethod
    def _extract_search_terms(message: str) -> str:
        cleaned = re.sub(r"[^a-zA-Z0-9\s-]", " ", message.lower())
        terms = [term.strip() for term in cleaned.split() if term.strip()]
        return " ".join(terms[:8])

    async def _search_property_context(self, message: str) -> list[dict]:
        if not self.property_search_tool:
            return []

        filters = self._extract_search_filters(message)
        query = self._extract_search_terms(message)
        if not query and not filters:
            return []

        try:
            return await self.property_search_tool.search_properties(query=query, filters=filters)
        except Exception:
            return []

    async def _call_llm(self, user_message: str, property_context: list[dict]) -> str:
        if not settings.LLM_API_KEY:
            return (
                "leaseaccom AI is configured and ready for an LLM connection, but no API key has been set yet. "
                "Add LLM_API_KEY and the provider settings in the backend .env file to enable live responses."
            )

        system_prompt = (
            "You are leaseaccom AI, a helpful assistant for property searching, tenant questions, owner workflows, "
            "and trust and safety guidance. Keep responses concise, helpful, and grounded in leaseaccom property data. "
            "Do not claim to have access to data you do not have."
        )

        if property_context:
            context_block = "\n".join(
                f"- {item.get('title', 'Property')} | city: {item.get('city', 'n/a')} | type: {item.get('type', 'n/a')} | price: {item.get('price', 'n/a')}"
                for item in property_context
            )
            system_prompt += f"\nRelevant leaseaccom properties:\n{context_block}"

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "temperature": 0.2,
        }

        headers = {
            "Authorization": f"Bearer {settings.LLM_API_KEY}",
            "Content-Type": "application/json",
        }

        url = f"{settings.LLM_API_BASE_URL.rstrip('/')}/chat/completions"

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()

        data = response.json()
        return data["choices"][0]["message"]["content"].strip()

    async def generate_response(
        self,
        message: str,
        conversation_id: str | None = None,
    ) -> str:
        if not message or not message.strip():
            raise ValueError("A message is required.")

        user_message = message.strip()
        conversation_label = conversation_id or "new"
        property_context = await self._search_property_context(user_message)

        try:
            return await self._call_llm(user_message, property_context)
        except Exception:
            if property_context:
                formatted = [
                    f"{item.get('title', 'Property')} in {item.get('city', 'n/a')} ({item.get('type', 'n/a')}) - {item.get('price', 'n/a')}"
                    for item in property_context
                ]
                return (
                    "I found matching leaseaccom listings for your request in conversation "
                    f"'{conversation_label}':\n- " + "\n- ".join(formatted) +
                    "\nPlease confirm the city, budget, and property type, and I can refine the list further."
                )

            return (
                "leaseaccom AI is ready, but the live LLM connection is not configured yet. "
                "Set LLM_API_KEY in the backend .env file and restart the service to enable AI responses."
            )
