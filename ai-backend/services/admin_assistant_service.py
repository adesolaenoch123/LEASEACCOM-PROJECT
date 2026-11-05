from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
import json
import re
from typing import Any

import httpx

from config import settings
from services.admin_service import AdminService


class AdminAssistantService:
    """Admin-only read, analysis, draft, workflow, and confirmation-gated action tools."""
    TABLES = {
        "users": "profiles", "listings": "properties", "verifications": "owner_verifications",
        "viewings": "viewings", "applications": "applications", "conversations": "conversations",
        "notifications": "notifications", "payments": "payments", "plans": "subscriptions",
        "reports": "reports", "audit": "audit_logs", "email": "email_queue",
    }
    def __init__(self) -> None:
        self.admin = AdminService()
        self.client = self.admin.client

    def rows(self, table: str, limit: int = 500) -> list[dict]:
        if not self.client:
            raise RuntimeError("Supabase backend is not configured.")
        response = self.client.table(table).select("*").order("created_at", desc=True).limit(limit).execute()
        return response.data or []

    @staticmethod
    def _days(row: dict) -> int:
        raw = row.get("created_at") or row.get("submitted_at") or row.get("updated_at")
        try:
            value = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
            if value.tzinfo is None: value = value.replace(tzinfo=timezone.utc)
            return max(0, (datetime.now(timezone.utc) - value).days)
        except (TypeError, ValueError): return 0

    @staticmethod
    def _brief(row: dict) -> dict:
        keep = ("id", "title", "full_name", "email", "account_type", "city", "location", "price", "verification_status", "listing_status", "status", "created_at", "owner_id", "user_id", "property_id", "action", "entity_type", "detail")
        return {k: row.get(k) for k in keep if row.get(k) is not None}

    def duplicates(self) -> list[dict]:
        rows = self.admin.client.table("properties").select("*").limit(2000).execute().data or [] if self.client else []
        pairs = []
        norm = lambda value: re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()
        for i, a in enumerate(rows):
            for b in rows[i+1:]:
                title = SequenceMatcher(None, norm(a.get("title")), norm(b.get("title"))).ratio()
                address = SequenceMatcher(None, norm(a.get("address") or a.get("location")), norm(b.get("address") or b.get("location"))).ratio()
                details = SequenceMatcher(None, norm(a.get("description")), norm(b.get("description"))).ratio()
                def photos(row: dict) -> set[str]:
                    values = row.get("images") if isinstance(row.get("images"), list) else []
                    values = values + [row.get("image"), row.get("cover_image")]
                    return {str(value).split("?")[0].rstrip("/").lower() for value in values if value and str(value).startswith(("http://", "https://"))}
                shared_photos = photos(a).intersection(photos(b))
                owner = bool(a.get("owner_id") and a.get("owner_id") == b.get("owner_id"))
                city = bool(norm(a.get("city")) and norm(a.get("city")) == norm(b.get("city")))
                try: price = max(float(a.get("price") or 0), float(b.get("price") or 0)) > 0 and abs(float(a.get("price") or 0)-float(b.get("price") or 0))/max(float(a.get("price") or 0),float(b.get("price") or 0)) < .12
                except (TypeError, ValueError): price = False
                reasons = []
                if address >= .8: reasons.append("similar location/address")
                if title >= .82: reasons.append("similar title")
                if shared_photos: reasons.append(f"{len(shared_photos)} shared photo URL(s)")
                if details >= .9: reasons.append("very similar description")
                if owner and city and price and title >= .6: reasons.append("same owner, city and similar price/title")
                if reasons and max(title, address, details) >= .72 or shared_photos:
                    pairs.append({"first": self._brief(a), "second": self._brief(b), "confidence": round(max(title,address,details,1.0 if shared_photos else 0),2), "reasons": reasons})
        return pairs

    def missing_info(self) -> dict:
        listings = self.rows("properties")
        required = ("title", "city", "location", "description", "price", "type", "image")
        incomplete = []
        for row in listings:
            missing = [key for key in required if row.get(key) in (None, "", 0)]
            if not row.get("images") and not row.get("image"): missing.append("images")
            if missing: incomplete.append({"record": self._brief(row), "missing": sorted(set(missing))})
        verifications = self.rows("owner_verifications", 1000)
        verification_gaps = []
        for row in verifications:
            missing = [key for key in ("id_file_url", "proof_file_url", "nin") if not row.get(key)]
            if missing and str(row.get("status", "pending")).lower() == "pending":
                verification_gaps.append({"record": self._brief(row), "missing": missing})
        return {"incomplete_listings": incomplete, "verification_gaps": verification_gaps}

    def suspicious(self) -> list[dict]:
        alerts = []
        properties = self.rows("properties")
        reports = self.rows("reports", 1000)
        dupes = self.duplicates()
        for pair in dupes:
            alerts.append({"type":"possible_duplicate", "severity":"review", **pair})
        reports_by_property = Counter(str(r.get("property_id")) for r in reports if r.get("property_id") and str(r.get("status", "open")).lower() in ("open", "pending"))
        for pid, count in reports_by_property.items():
            if count >= 3: alerts.append({"type":"repeated_reports", "severity":"high", "property_id":pid, "report_count":count})
        owner_counts = Counter(str(r.get("owner_id")) for r in properties if r.get("owner_id"))
        for owner, count in owner_counts.items():
            if count >= 15: alerts.append({"type":"high_listing_volume", "severity":"review", "owner_id":owner, "listing_count":count})
        return alerts

    def urgent_messages(self) -> list[dict]:
        """Flag message text that may need prompt human attention; never auto-reply."""
        urgent_terms = ("urgent", "emergency", "unsafe", "scam", "fraud", "threat", "harass", "police", "injury", "broken", "leak", "fire")
        messages = self.rows("messages", 2000)
        flagged = []
        for row in messages:
            body = str(row.get("body") or "")
            found = [term for term in urgent_terms if term in body.lower()]
            if found:
                flagged.append({"message_id": row.get("id"), "conversation_id": row.get("conversation_id"), "created_at": row.get("created_at"), "signals": found, "message_preview": body[:500]})
        return flagged

    def application_flags(self) -> list[dict]:
        """Find duplicate applications and same-tenant/property date collisions."""
        apps = self.rows("applications", 3000)
        seen: dict[tuple[str, str, str], dict] = {}
        flags = []
        for row in apps:
            tenant = str(row.get("tenant_id") or "")
            prop = str(row.get("property_id") or "")
            move_in = str(row.get("move_in_date") or "")
            key = (tenant, prop, move_in)
            if tenant and prop and key in seen and str(row.get("status")) not in {"withdrawn", "rejected"}:
                flags.append({"type": "possible_duplicate_application", "first": self._brief(seen[key]), "second": self._brief(row), "reason": "same tenant, property, and move-in date"})
            elif tenant and prop and str(row.get("status")) not in {"withdrawn", "rejected"}:
                seen[key] = row
        return flags

    def payment_flags(self) -> list[dict]:
        payments = self.rows("payments", 3000)
        flags = []
        for row in payments:
            status = str(row.get("status") or "").lower()
            age = self._days(row)
            if status == "failed" or (status == "pending" and age >= 1):
                flags.append({"record": {k: row.get(k) for k in ("id", "user_id", "property_id", "amount", "currency", "type", "purpose", "status", "created_at") if row.get(k) is not None}, "waiting_days": age, "signal": "failed payment" if status == "failed" else "payment pending for at least one day"})
        return flags

    def property_performance(self) -> list[dict]:
        properties = self.rows("properties", 2000)
        applications = self.rows("applications", 5000)
        try:
            views = self.rows("property_views", 10000)
        except Exception:
            views = []
        views_by_id = Counter(str(row.get("property_id")) for row in views if row.get("property_id"))
        apps_by_id = Counter(str(row.get("property_id")) for row in applications if row.get("property_id"))
        results = []
        for prop in properties:
            property_id = str(prop.get("id") or "")
            view_count = views_by_id[property_id] or int(prop.get("views_count") or 0)
            app_count = apps_by_id[property_id]
            results.append({"property": self._brief(prop), "views": view_count, "applications": app_count, "application_rate": round(app_count / view_count, 3) if view_count else None})
        return sorted(results, key=lambda row: (row["applications"], row["views"]), reverse=True)

    def pricing_benchmarks(self) -> list[dict]:
        properties = self.rows("properties", 3000)
        groups: dict[tuple[str, str, str], list[float]] = {}
        for row in properties:
            try:
                price = float(row.get("price") or 0)
            except (TypeError, ValueError):
                continue
            if price <= 0:
                continue
            key = (str(row.get("city") or "Unknown"), str(row.get("type") or "Unknown"), str(row.get("period") or "year"))
            groups.setdefault(key, []).append(price)
        import statistics
        benchmarks = []
        for (city, kind, period), values in groups.items():
            if len(values) < 3:
                continue
            median = statistics.median(values)
            benchmarks.append({"city": city, "property_type": kind, "price_period": period, "comparable_count": len(values), "median_price": median, "suggested_review_range": [round(median * 0.9, 2), round(median * 1.1, 2)], "note": "Market comparison only; verify property condition and local demand before changing a price."})
        return benchmarks

    def viewing_calendar(self, days: int = 30) -> dict:
        today = datetime.now(timezone.utc).date()
        end = today + timedelta(days=max(1, min(days, 365)))
        rows = self.rows("viewings", 3000)
        upcoming = []
        for row in rows:
            raw = row.get("preferred_date") or row.get("viewing_date")
            try:
                date_value = datetime.fromisoformat(str(raw)).date()
            except (TypeError, ValueError):
                continue
            if today <= date_value <= end and str(row.get("status") or "").lower() not in {"cancelled", "declined"}:
                upcoming.append({"viewing": self._brief(row), "date": str(date_value), "time": row.get("preferred_time")})
        return {"upcoming_viewings": sorted(upcoming, key=lambda item: item["date"]), "availability_note": "The app stores viewing requests but not property availability blocks, so open rental dates cannot be inferred from this calendar."}

    def dispute_summary(self) -> dict:
        rows = self.rows("reports", 1000)
        open_reports = [row for row in rows if str(row.get("status") or "open").lower() in {"open", "pending", "investigating"}]
        return {"open_report_count": len(open_reports), "reports": [{"record": self._brief(row), "summary": str(row.get("subject") or row.get("reason") or row.get("details") or row.get("body") or "No report details recorded")[:700], "waiting_days": self._days(row)} for row in open_reports]}

    def maintenance_candidates(self) -> list[dict]:
        reports = self.rows("reports", 1000)
        terms = ("repair", "broken", "leak", "maintenance", "electric", "water", "damage", "fault", "plumbing", "mould", "mold")
        tasks = []
        for row in reports:
            body = " ".join(str(row.get(key) or "") for key in ("subject", "reason", "details", "body"))
            if any(term in body.lower() for term in terms) and str(row.get("status") or "open").lower() in {"open", "pending", "investigating"}:
                tasks.append({"report_id": row.get("id"), "property_id": row.get("property_id"), "priority": "high" if any(term in body.lower() for term in ("unsafe", "electric", "fire", "leak")) else "normal", "suggested_task": body[:500], "status": "suggested_only"})
        return tasks

    def move_in_brief(self) -> dict:
        applications = self.rows("applications", 2000)
        agreements = self.rows("agreements", 2000)
        accepted = [row for row in applications if str(row.get("status") or "").lower() == "accepted"]
        agreements_by_app = {str(row.get("application_id")): row for row in agreements if row.get("application_id")}
        return {"accepted_applications": [{"application": self._brief(row), "agreement": self._brief(agreements_by_app[str(row.get("id"))]) if str(row.get("id")) in agreements_by_app else None, "checklist": ["Confirm move-in date", "Confirm rent and deposit", "Share verified access instructions", "Record property condition"]} for row in accepted], "note": "No door codes or private access credentials are stored or generated by the assistant."}

    def overdue(self, days: int = 3) -> list[dict]:
        checks = (("properties", ("pending", "submitted")), ("owner_verifications", ("pending",)), ("applications", ("submitted", "under_review")), ("reports", ("open", "pending")))
        found = []
        for table, statuses in checks:
            for row in self.rows(table, 2000):
                status = str(row.get("verification_status") or row.get("status") or row.get("listing_status") or "").lower()
                age = self._days(row)
                if status in statuses and age >= days:
                    found.append({"type":table, "record":self._brief(row), "waiting_days":age})
        return sorted(found, key=lambda x:x["waiting_days"], reverse=True)

    def analytics(self, period_days: int = 30) -> dict:
        now = datetime.now(timezone.utc); start = now - timedelta(days=period_days)
        metrics = {}
        for name, table in (("users","profiles"),("listings","properties"),("applications","applications"),("payments","payments"),("reports","reports")):
            rows = self.rows(table, 5000)
            recent = []
            for row in rows:
                try:
                    dt = datetime.fromisoformat(str(row.get("created_at","")).replace("Z","+00:00"))
                    if dt.tzinfo is None: dt=dt.replace(tzinfo=timezone.utc)
                    if dt >= start: recent.append(row)
                except ValueError: pass
            metrics[name] = {"total":len(rows), "period_count":len(recent)}
            if name == "listings": metrics[name]["top_cities"] = Counter(str(x.get("city") or "Unknown") for x in recent).most_common(10)
            if name == "reports": metrics[name]["open"] = sum(1 for x in rows if str(x.get("status","")).lower() in ("open","pending"))
        return {"period_days":period_days, "metrics":metrics}

    def summary(self, period_days: int = 1) -> dict:
        data = self.analytics(period_days)
        data["pending_listings"] = sum(1 for r in self.rows("properties") if str(r.get("verification_status") or r.get("listing_status") or "").lower()=="pending")
        data["pending_verifications"] = sum(1 for r in self.rows("owner_verifications") if str(r.get("status","")).lower()=="pending")
        data["overdue_count"] = len(self.overdue(3))
        data["suspicious_alert_count"] = len(self.suspicious())
        return data

    def draft(self, message: str) -> dict:
        lowered = message.lower()
        if "reject" in lowered: kind, subject, body = "rejection", "Update about your LeaseAccom submission", "Hello, thank you for submitting this information. We reviewed it and need to decline it for now. Reason: [add specific, verified reason]. You may update the information and contact support if you need help."
        elif "verification" in lowered: kind, subject, body = "verification_followup", "More information needed for your verification", "Hello, we are reviewing your LeaseAccom verification. Please provide: [list missing documents or details]. We will continue the review once received."
        elif "service" in lowered or "notice" in lowered: kind, subject, body = "service_notice", "LeaseAccom service update", "Hello, we are contacting you with an update about LeaseAccom: [insert verified update]. Please contact support if you have questions."
        else: kind, subject, body = "support_reply", "Re: Your LeaseAccom enquiry", "Hello, thanks for contacting LeaseAccom. [Add a response based on the customer’s case and verified account details]. Please let us know if you need further help."
        return {"kind":kind,"subject":subject,"body":body,"send_action":"not_sent_review_required"}

    def workflow_rules(self) -> list[dict]:
        return self.rows("admin_workflow_rules", 200)

    def create_rule(self, payload: dict, actor_id: str) -> dict:
        if not self.client: raise RuntimeError("Supabase backend is not configured.")
        row={"name":payload["name"],"rule_type":payload["rule_type"],"conditions":payload.get("conditions",{}),"enabled":bool(payload.get("enabled",True)),"created_by":actor_id}
        result=self.client.table("admin_workflow_rules").insert(row).execute()
        return (result.data or [row])[0]

    def evaluate_workflows(self) -> dict:
        """Evaluate saved admin rules and create one notification per due rule."""
        rules=self.workflow_rules(); now=datetime.now(timezone.utc); fired=[]
        admins=self.client.table("profiles").select("id").eq("account_type","admin").execute().data or []
        for rule in rules:
            if not rule.get("enabled",True): continue
            kind=rule.get("rule_type"); conditions=rule.get("conditions") or {}; last=rule.get("last_run_at")
            try:
                last_dt=datetime.fromisoformat(str(last).replace("Z","+00:00")) if last else None
                if last_dt and last_dt.tzinfo is None: last_dt=last_dt.replace(tzinfo=timezone.utc)
            except ValueError: last_dt=None
            cooldown=timedelta(days=7 if kind=="weekly_report" else 1)
            if last_dt and now-last_dt<cooldown: continue
            if kind=="overdue_reminder":
                items=self.overdue(int(conditions.get("days",3)))
                title="Admin work needs attention"; body=f"{len(items)} item(s) have been waiting at least {conditions.get('days',3)} days. Open the admin AI for details."
                if not items: continue
            elif kind=="suspicious_activity":
                items=self.suspicious(); title="Activity review alert"; body=f"{len(items)} suspicious activity signal(s) need review. These are flags, not conclusions."
                if not items: continue
            elif kind in {"daily_report","weekly_report"}:
                days=7 if kind=="weekly_report" else 1; summary=self.summary(days); items=[]
                title="Daily admin report" if days==1 else "Weekly admin report"; body=f"{days}-day report: {summary['metrics']['users']['period_count']} new users, {summary['metrics']['listings']['period_count']} new listings, {summary['metrics']['applications']['period_count']} applications, {summary['metrics']['payments']['period_count']} payments, {summary['metrics']['reports']['period_count']} reports."
            else: continue
            for admin in admins:
                self.client.table("notifications").insert({"user_id":admin["id"],"title":title,"message":body,"type":"admin","link":"admin/admin.html","read":False}).execute()
            self.client.table("admin_workflow_rules").update({"last_run_at":now.isoformat()}).eq("id",rule["id"]).execute()
            fired.append({"rule_id":rule["id"],"title":title,"items":len(items)})
        return {"evaluated":len(rules),"fired":fired}

    def action_history(self, limit: int = 100) -> list[dict]:
        return self.rows("audit_logs", min(max(limit,1),500))

    def confirm(self, payload: dict, actor: dict) -> dict:
        if not payload.get("confirmed"): raise ValueError("Explicit confirmation is required.")
        op=payload.get("operation"); ids=payload.get("record_ids") or []
        if not ids or len(ids)>100: raise ValueError("Select between 1 and 100 records.")
        tablemap={"listing_review":"properties","owner_verification":"owner_verifications","report_resolution":"reports","user_status":"profiles","plan_assignment":"profiles"}
        if op not in tablemap: raise ValueError("Unsupported admin action.")
        table=tablemap[op]; status=payload.get("status")
        allowed={"listing_review":{"approved","rejected"},"owner_verification":{"verified","rejected"},"report_resolution":{"resolved"},"user_status":{"active","suspended"},"plan_assignment":{"free","professional","business","enterprise"}}
        if status not in allowed[op]: raise ValueError("Invalid status for this action.")
        if op=="plan_assignment":
            response=self.client.table(table).update({"plan":status,"subscription_plan":status}).in_("id",ids).execute()
        else:
            col="verification_status" if op=="listing_review" else ("account_status" if op=="user_status" else "status")
            update={col:status}
            if op=="listing_review": update["listing_status"]="live" if status=="approved" else "rejected"
            query=self.client.table(table).update(update).in_("id",ids)
            if op in {"listing_review", "owner_verification"}: query=query.eq(col,"pending")
            if op=="report_resolution": query=query.in_("status",["open","pending"])
            response=query.execute()
        changed=response.data or []
        self.client.table("audit_logs").insert({"actor_id":actor.get("id"),"actor_email":actor.get("email"),"action":"assistant_"+op,"entity_type":table,"entity_id":",".join(ids),"detail":payload.get("instruction") or "Confirmed AI assistant action"}).execute()
        return {"updated":len(changed),"records":[self._brief(r) for r in changed],"action":op,"status":status}

    async def respond(self, message: str) -> dict:
        """Use the admin-only tools for facts, then let the configured model phrase the answer.

        The model never selects or executes database operations. Tool results and proposed
        actions remain authoritative, and mutations still go through the confirmation route.
        """
        result = self._respond_with_rules(message)
        if not settings.LLM_API_KEY:
            return result

        try:
            if result.get("draft"):
                result["draft"] = await self._generate_draft(message, result["draft"])
            result["response"] = await self._phrase_response(message, result)
        except Exception:
            # A model outage must not prevent the existing admin tools from working.
            pass
        return result

    async def _generate_draft(self, instruction: str, fallback: dict) -> dict:
        """Generate a review-only message draft; never send it to a customer."""
        kind = str(fallback.get("kind") or "admin_message")
        if kind == "translation":
            task = "Translate the admin-provided text into the target language they request. Preserve meaning and tone; do not add facts."
        elif kind == "listing_description":
            task = "Write clear rental listing copy using only facts in the admin's instruction. Use bracketed placeholders for missing property facts; do not invent amenities, safety features, or proximity claims."
        elif kind == "review_response":
            task = "Draft a polite public response to the review text provided by the admin. Do not claim facts or promise remedies that were not provided."
        else:
            task = "Write a concise, professional LeaseAccom admin message. Use only information in the instruction. Put bracketed placeholders where facts are missing."
        payload = {
            "model": settings.LLM_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        f"{task} Never claim anything was sent or published. "
                        "Return only a JSON object with string fields subject and body."
                    ),
                },
                {"role": "user", "content": instruction},
            ],
            "temperature": 0.3,
            "max_tokens": 450,
            "response_format": {"type": "json_object"},
        }
        headers = {
            "Authorization": f"Bearer {settings.LLM_API_KEY}",
            "Content-Type": "application/json",
        }
        url = f"{settings.LLM_API_BASE_URL.rstrip('/')}/chat/completions"
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        draft = json.loads(content)
        subject = str(draft.get("subject", "")).strip()
        body = str(draft.get("body", "")).strip()
        if not subject or not body:
            return fallback
        return {**fallback, "subject": subject[:200], "body": body[:4000], "send_action": "not_sent_review_required"}

    @staticmethod
    def _safe_response_context(result: dict) -> dict:
        """Summarize tool output without sending record-level personal data to the LLM."""
        context: dict[str, Any] = {
            "tool_summary": result.get("response", ""),
            "confirmation_required": bool(result.get("confirmation_required")),
        }
        proposal = result.get("proposed_operation")
        if proposal:
            context["proposed_action"] = {
                "operation": proposal.get("operation"),
                "status": proposal.get("status"),
                "record_count": len(proposal.get("record_ids") or []),
            }

        def summarize(value: Any) -> Any:
            if isinstance(value, list):
                return {"count": len(value)}
            if not isinstance(value, dict):
                return None
            safe: dict[str, Any] = {}
            for key, item in value.items():
                if isinstance(item, (int, float, bool)) or item is None:
                    safe[key] = item
                elif isinstance(item, list):
                    safe[key] = {"count": len(item)}
                elif isinstance(item, dict):
                    child = summarize(item)
                    if child:
                        safe[key] = child
            return safe

        if "data" in result:
            context["data_summary"] = summarize(result["data"])
        if result.get("draft"):
            context["draft_type"] = result["draft"].get("kind")
        if result.get("suggested_rule"):
            context["suggested_rule"] = {
                "name": result["suggested_rule"].get("name"),
                "rule_type": result["suggested_rule"].get("rule_type"),
            }
        return context

    async def _phrase_response(self, message: str, result: dict) -> str:
        context = self._safe_response_context(result)
        system_prompt = (
            "You are the private LeaseAccom admin dashboard assistant. Answer only from the "
            "trusted tool summary provided. Do not invent records, facts, or completed actions. "
            "The backend, not you, selected all results and proposed actions. If confirmation_required "
            "is true, clearly say the action is only proposed and still needs the administrator's "
            "confirmation. Keep the answer concise and useful. Do not request or reveal personal data."
        )
        payload = {
            "model": settings.LLM_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Request: {message}\nTrusted admin tool summary: {context}"},
            ],
            "temperature": 0.2,
            "max_tokens": 300,
        }
        headers = {
            "Authorization": f"Bearer {settings.LLM_API_KEY}",
            "Content-Type": "application/json",
        }
        url = f"{settings.LLM_API_BASE_URL.rstrip('/')}/chat/completions"
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
        answer = response.json()["choices"][0]["message"]["content"].strip()
        return answer or result.get("response", "I couldn't prepare a response.")

    def _respond_with_rules(self, message: str) -> dict:
        text=message.strip(); low=text.lower()
        if not text: return {"response":"Tell me what you want to find or do in the admin dashboard."}
        if any(k in low for k in ("urgent message", "urgent conversation", "emergency message", "flag urgent")):
            rows=self.urgent_messages(); return {"response":f"Found {len(rows)} message(s) with urgent safety or service signals. These are prompts for human review; no reply was sent.","data":rows,"capability":"urgent_message_triage"}
        if any(k in low for k in ("application conflict", "duplicate application", "overlapping application", "booking problem", "booking conflict")):
            rows=self.application_flags(); return {"response":f"Found {len(rows)} possible duplicate rental application(s). LeaseAccom does not have a reservation table, so I checked applications instead.","data":rows,"capability":"application_conflict_check"}
        if any(k in low for k in ("cancellation", "cancelled", "canceled", "withdrawn application")):
            applications=[self._brief(r) for r in self.rows("applications",2000) if str(r.get("status") or "").lower()=="withdrawn"]
            viewings=[self._brief(r) for r in self.rows("viewings",2000) if str(r.get("status") or "").lower()=="cancelled"]
            return {"response":f"Found {len(applications)} withdrawn application(s) and {len(viewings)} cancelled viewing(s). Payment and reservation cancellations are not stored as booking records in this app.","data":{"withdrawn_applications":applications,"cancelled_viewings":viewings},"capability":"rental_cancellation_review"}
        if any(k in low for k in ("payment issue", "failed payment", "overdue payment", "payment problem", "payment anomalies")):
            rows=self.payment_flags(); return {"response":f"Found {len(rows)} failed payments or payments pending at least one day. This is a review list; I did not change or refund a payment.","data":rows,"capability":"payment_issue_review"}
        if any(k in low for k in ("refund", "refund recommendation", "should i refund")):
            rows=self.payment_flags(); return {"response":"I can show payment signals to help with a refund decision, but the app has no refund policy rules or refund action wired to the admin assistant. Review the transaction and your policy before deciding.","data":rows,"capability":"refund_review_only"}
        if any(k in low for k in ("property performance", "compare properties", "compare listing", "which properties perform", "conversion rate", "views to applications")):
            rows=self.property_performance(); return {"response":"Here is the property performance comparison using recorded views and rental applications where available.","data":rows,"capability":"property_performance"}
        if any(k in low for k in ("pricing suggestion", "price recommendation", "recommend a price", "market price", "pricing changes")):
            rows=self.pricing_benchmarks(); return {"response":f"Prepared {len(rows)} city/type/period price benchmark(s) from your listings. These are recommendations only; no listing prices were changed.","data":rows,"capability":"price_benchmarks"}
        if any(k in low for k in ("calendar gap", "viewing calendar", "upcoming viewings", "availability calendar")):
            days_match=re.search(r"(\d+)\s*days?",low); days=int(days_match.group(1)) if days_match else 30
            return {"response":"Here are upcoming viewing requests. Rental availability gaps cannot be calculated because the app does not store reservation blocks.","data":self.viewing_calendar(days),"capability":"viewing_calendar"}
        if any(k in low for k in ("occupancy forecast", "forecast occupancy", "occupancy rate", "occupancy")):
            return {"response":"LeaseAccom does not currently store rental stay reservations or occupied-date ranges, so I cannot calculate occupancy. I can forecast application and viewing activity instead; ask for an application or viewing trend summary.","data":{"available_signals":["rental applications","viewing requests"],"missing_data":["reservation dates","occupied dates","availability blocks"]},"capability":"occupancy_data_gap"}
        if any(k in low for k in ("forecast", "forecast demand", "application trend")):
            days=90; rows=self.rows("applications",5000); cutoff=datetime.now(timezone.utc)-timedelta(days=days)
            recent=[]
            for row in rows:
                try:
                    created=datetime.fromisoformat(str(row.get("created_at") or "").replace("Z","+00:00"))
                    if created.tzinfo is None: created=created.replace(tzinfo=timezone.utc)
                    if created>=cutoff: recent.append(row)
                except ValueError: pass
            weeks=max(1,days/7); rate=round(len(recent)/weeks,2)
            return {"response":f"Recorded applications averaged {rate} per week over the last {days} days. This is a simple trend, not an occupancy forecast.","data":{"period_days":days,"applications":len(recent),"average_per_week":rate,"forecast_next_30_days":round(rate*30/7,1),"confidence":"low; based on recent application volume only"},"capability":"application_volume_forecast"}
        if any(k in low for k in ("maintenance", "repair task", "maintenance task", "broken", "leak")):
            rows=self.maintenance_candidates(); return {"response":f"Found {len(rows)} open reports that may need a maintenance task. Suggestions are not assigned or dispatched.","data":rows,"capability":"maintenance_triage"}
        if any(k in low for k in ("dispute", "resolve dispute", "dispute summary", "reports to resolve")):
            data=self.dispute_summary(); return {"response":f"There are {data['open_report_count']} open reports or disputes for an admin to review.","data":data,"capability":"dispute_summary"}
        if any(k in low for k in ("handover", "hand-over", "staff handoff", "shift notes")):
            data={"summary":self.summary(1),"overdue":self.overdue(1)[:30],"upcoming_viewings":self.viewing_calendar(7)["upcoming_viewings"]}
            return {"response":"Here are suggested staff handover notes from current reports, applications, and viewing requests.","data":data,"capability":"staff_handover"}
        if any(k in low for k in ("move-in instructions", "move in instructions", "check-in instructions", "arrival instructions")):
            return {"response":"Here is a move-in preparation checklist based on accepted rental applications. Add verified access details yourself; the assistant does not create door codes.","data":self.move_in_brief(),"capability":"move_in_checklist"}
        if any(k in low for k in ("translate", "translation", "in spanish", "in french", "in yoruba", "in hausa", "in igbo")):
            return {"response":"Here is a translation draft for review; it has not been sent.","draft":{"kind":"translation","subject":"Translated message","body":"[Translation will be generated from your instruction.]","send_action":"not_sent_review_required"},"capability":"message_translation"}
        if any(k in low for k in ("occupancy gap", "review summary", "summarize reviews", "guest reviews", "review response", "reply to review")):
            if any(k in low for k in ("review response", "reply to review")):
                return {"response":"I couldn't load a stored review because the app has no review table. Paste the review text and I can draft a response for you to review.","draft":{"kind":"review_response","subject":"Reply to review","body":"[Paste review text and add verified response details.]","send_action":"not_sent_review_required"},"capability":"review_response_draft"}
            return {"response":"There is no review or star-rating table in the current LeaseAccom schema. I can review property reports and customer messages instead; those records may contain feedback but are not verified reviews.","data":{"available_alternative":"Ask me to summarize disputes/reports or flag urgent messages.","missing_data":["review text","star ratings"]},"capability":"review_data_gap"}
        if any(k in low for k in ("listing description", "write a description", "improve this listing", "rewrite listing", "listing copy")):
            return {"response":"Here is a listing description draft for your review. Confirm the property facts before publishing.","draft":{"kind":"listing_description","subject":"Property listing description","body":"[Describe the property and verified amenities.]","send_action":"not_published_review_required"},"capability":"listing_copy_draft"}
        if any(k in low for k in ("photo", "photos", "images", "image order")):
            incomplete=self.missing_info()["incomplete_listings"]
            return {"response":"I can check whether listings have photos and recommend a stronger photo set, but I cannot judge image quality or reorder photos without a visual review tool.","data":{"incomplete_listings":[row for row in incomplete if "images" in row["missing"]],"photo_guidance":["Use a bright lead image of the main room", "Include kitchen, bathroom, bedroom, exterior, and amenities", "Avoid duplicate, blurry, or misleading photos"]},"capability":"photo_completeness"}
        if any(k in low for k in ("recommend action", "what should i do", "what needs attention", "prioritize", "task list", "to-do list", "todo")):
            return {"response":"Here are suggested admin tasks ordered from the current open signals. Recommendations do not change records.","data":{"urgent_messages":self.urgent_messages()[:20],"overdue":self.overdue(3)[:30],"payment_flags":self.payment_flags()[:20],"maintenance_candidates":self.maintenance_candidates()[:20]},"capability":"admin_task_prioritization"}
        if any(k in low for k in ("duplicate listing","duplicate listings","duplicates","dupes")):
            rows=self.duplicates(); return {"response":f"Found {len(rows)} possible duplicate pair(s). These are review flags; I made no changes.","data":rows}
        if any(k in low for k in ("suspicious","fraud","unusual activity")):
            rows=self.suspicious(); return {"response":f"There are {len(rows)} activity flag(s) to review. These are signals, not conclusions.","data":rows}
        if any(k in low for k in ("missing information","missing details","incomplete listing","missing document")):
            data=self.missing_info(); return {"response":f"Found {len(data['incomplete_listings'])} incomplete listings and {len(data['verification_gaps'])} pending verifications with document gaps.","data":data}
        if any(k in low for k in ("overdue","waiting more than","waiting for")):
            m=re.search(r"(\d+)\s*days?",low); days=int(m.group(1)) if m else 3
            data=self.overdue(days); return {"response":f"Found {len(data)} items waiting at least {days} days.","data":data}
        if any(k in low for k in ("draft","write a message","write an email","notice","reply to")):
            return {"response":"Here is a draft for your review. It has not been sent.","draft":self.draft(text)}
        if any(k in low for k in ("workflow","automation rule","remind me when","alert me when")):
            rules=self.workflow_rules()
            m=re.search(r"(\d+)\s*days?",low); days=int(m.group(1)) if m else 3
            return {"response":"Workflow rules are available below. I can prepare a reminder rule; save it using the workflow-rules endpoint. Scheduled evaluation runs in the backend.","rules":rules,"suggested_rule":{"name":f"Notify when pending admin work is {days}+ days old","rule_type":"overdue_reminder","conditions":{"days":days,"statuses":["pending","submitted","under_review"],"tables":["properties","owner_verifications","applications","reports"]},"enabled":True}}
        if any(k in low for k in ("audit","action history","what did you change","why did you")):
            logs=self.action_history(100); return {"response":f"Loaded {len(logs)} recent admin actions from the audit log.","data":logs}
        if any(k in low for k in ("trend","trends","this month","last month","daily report","weekly report","report summary","how many new","top cities")):
            days=7 if any(k in low for k in ("week","weekly","7 days")) else 30
            data=self.summary(days) if any(k in low for k in ("daily report","weekly report","report summary")) else self.analytics(days)
            return {"response":f"Here is the {days}-day admin activity summary.","data":data}
        action_match=re.search(r"\b(approve|reject)\s+(?:listing|property)\s+([a-z0-9_-]+)",low)
        if action_match:
            status="approved" if action_match.group(1)=="approve" else "rejected"; ids=[action_match.group(2)]
            return {"response":f"I can {action_match.group(1)} listing {ids[0]}. Confirm to apply this change.","confirmation_required":True,"proposed_operation":{"operation":"listing_review","record_ids":ids,"status":status,"instruction":text}}
        verification_match=re.search(r"\b(verify|reject)\s+(?:owner|verification)\s+([a-z0-9_-]+)",low)
        if verification_match:
            status="verified" if verification_match.group(1)=="verify" else "rejected"; ids=[verification_match.group(2)]
            return {"response":f"I can mark owner verification {ids[0]} as {status}. Confirm to apply this change.","confirmation_required":True,"proposed_operation":{"operation":"owner_verification","record_ids":ids,"status":status,"instruction":text}}
        report_match=re.search(r"\bresolve\s+report\s+([a-z0-9_-]+)",low)
        if report_match:
            ids=[report_match.group(1)]
            return {"response":f"I can resolve report {ids[0]}. Confirm to apply this change.","confirmation_required":True,"proposed_operation":{"operation":"report_resolution","record_ids":ids,"status":"resolved","instruction":text}}
        if any(k in low for k in ("bulk","all pending","pending listings","prepare approvals","approve all","reject all")):
            city_match=re.search(r"\bin\s+([a-z][a-z -]{1,35})",low); city=city_match.group(1).strip() if city_match else None
            rows=self.admin.bulk_preview("pending",city)
            return {"response":f"Prepared a preview of {len(rows)} pending listing(s). Nothing changed. Review the records and explicitly confirm a bulk action.","data":[self._brief(x) for x in rows],"confirmation_required":True,"proposed_operation":{"operation":"listing_review","record_ids":[str(x.get("id")) for x in rows],"status":"rejected" if any(k in low for k in ("reject all","prepare rejections")) else "approved","instruction":text}}
        if any(k in low for k in ("summary","overview","how is the platform","dashboard report","briefing")):
            return {"response":"Here is your admin overview.","data":self.summary(7 if "week" in low else 1)}
        plan_match=re.search(r"\bassign\s+(?:the\s+)?(free|professional|business|enterprise)\s+plan\s+to\s+(?:owner|user)\s+([a-z0-9_-]+)",low)
        if plan_match:
            ids=[plan_match.group(2)]; plan=plan_match.group(1)
            return {"response":f"I can assign the {plan} plan to {ids[0]}. Confirm to apply.","confirmation_required":True,"proposed_operation":{"operation":"plan_assignment","record_ids":ids,"status":plan,"instruction":text}}
        user_match=re.search(r"\b(suspend|reactivate|unsuspend)\s+(?:user|account)\s+([a-z0-9_-]+)",low)
        if user_match:
            ids=[user_match.group(2)]; status="suspended" if user_match.group(1)=="suspend" else "active"
            return {"response":f"I can set account {ids[0]} to {status}. Confirm to apply.","confirmation_required":True,"proposed_operation":{"operation":"user_status","record_ids":ids,"status":status,"instruction":text}}
        # Natural language record search across the dashboard's operational tables.
        scope=next((name for name in self.TABLES if name[:-1] in low or name in low),None)
        tables=[(scope,self.TABLES[scope])] if scope else [(n,t) for n,t in self.TABLES.items() if any(w in low for w in (n, t))]
        if not tables: tables=[("listings","properties"),("users","profiles"),("applications","applications"),("reports","reports")]
        result={}
        for name,table in tables[:4]:
            try:
                rows=self.rows(table,100)
                terms=[x for x in re.findall(r"[a-z0-9@._-]+",low) if len(x)>2 and x not in {"show","find","list","search","the","for","with","from","what","about","please","admin","dashboard"}]
                matched=[r for r in rows if not terms or any(term in str(v).lower() for term in terms for v in r.values())]
                result[name]=[self._brief(r) for r in matched[:25]]
            except Exception as exc: result[name]={"error":str(exc)}
        return {"response":"I searched the available admin records. Tell me a name, ID, city, status, or date range to narrow the results.","data":result}
