from typing import Any, Dict, Optional

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import settings
from services.admin_service import AdminService
from services.agreement_service import AgreementService
from services.ai_service import AIService
from services.application_service import ApplicationService
from services.auth_service import AuthService
from services.notification_service import NotificationService
from services.property_service import PropertyService
from services.viewing_service import ViewingService

app = FastAPI(
    title="LeaseHub Backend",
    version="0.1.0",
    description="Main backend foundation for LeaseHub property operations, user access, AI workflows, and future admin tools.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ai_service = AIService()
auth_service = AuthService()
property_service = PropertyService()
admin_service = AdminService()
application_service = ApplicationService()
viewing_service = ViewingService()
agreement_service = AgreementService()
notification_service = NotificationService()


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_id: str | None = Field(default=None, description="Optional conversation identifier.")


class PropertyCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    city: str = Field(..., min_length=1, max_length=200)
    type: str = Field(..., min_length=1, max_length=50)
    price: float = Field(..., gt=0)
    bedrooms: int | None = None
    bathrooms: int | None = None
    description: str | None = None


class PropertyUpdateRequest(BaseModel):
    title: str | None = None
    city: str | None = None
    type: str | None = None
    price: float | None = None
    bedrooms: int | None = None
    bathrooms: int | None = None
    description: str | None = None


class PropertyVerificationUpdateRequest(BaseModel):
    verification_status: str = Field(..., pattern="^(pending|approved|rejected)$")


class ApplicationCreateRequest(BaseModel):
    property_id: str = Field(..., min_length=1)
    applicant_name: str = Field(..., min_length=1, max_length=150)
    applicant_phone: str = Field(..., min_length=1, max_length=40)
    move_in_date: str = Field(..., min_length=1, max_length=40)
    message: str | None = Field(default=None, max_length=2000)
    employment_status: str | None = None
    monthly_income: float | None = None


class ApplicationUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(under_review|accepted|rejected)$")


class ViewingRequestCreateRequest(BaseModel):
    property_id: str = Field(..., min_length=1)
    owner_id: str = Field(..., min_length=1)
    preferred_date: str | None = None
    preferred_time: str | None = None
    notes: str | None = Field(default=None, max_length=2000)


class AgreementCreateRequest(BaseModel):
    property_id: str = Field(..., min_length=1)
    owner_id: str = Field(..., min_length=1)
    tenant_id: str | None = None
    title: str = Field(..., min_length=1, max_length=200)
    term_months: int = Field(..., gt=0)
    monthly_rent: float = Field(..., gt=0)
    deposit_amount: float | None = None
    start_date: str | None = None
    notes: str | None = Field(default=None, max_length=4000)


class NotificationCreateRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=1000)
    type: str = Field(default="info")
    link: str | None = None
    read: bool = False


@app.get("/")
async def root() -> dict:
    return {
        "status": "ok",
        "service": "leasehub-backend",
        "environment": settings.APP_ENV,
    }


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "service": "leasehub-backend",
        "environment": settings.APP_ENV,
    }


@app.get("/me")
async def me(authorization: Optional[str] = Header(default=None, alias="Authorization")) -> dict:
    user = await auth_service.get_session_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")
    return {"user": user}


@app.get("/properties")
async def list_properties(
    city: str | None = Query(default=None),
    type: str | None = Query(default=None, alias="type"),
    max_price: float | None = Query(default=None),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> dict:
    user = await auth_service.get_session_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")

    filters: Dict[str, Any] = {}
    if city:
        filters["city"] = city
    if type:
        filters["type"] = type
    if max_price is not None:
        filters["max_price"] = max_price

    results = await property_service.list_properties(filters)
    return {"properties": results, "count": len(results)}


@app.get("/properties/{property_id}")
async def get_property(property_id: str, authorization: Optional[str] = Header(default=None, alias="Authorization")) -> dict:
    user = await auth_service.get_session_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")

    property_data = await property_service.get_property(property_id)
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found.")

    return {"property": property_data}


@app.post("/properties")
async def create_property(
    payload: PropertyCreateRequest,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> dict:
    user = await auth_service.get_session_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")
    if user.get("role") not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Owner or admin access required.")

    try:
        property_data = await property_service.create_property(payload.model_dump(exclude_none=True), user["id"])
        return {"property": property_data, "message": "Property created successfully."}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Unable to create property.") from exc


@app.patch("/properties/{property_id}")
async def update_property(
    property_id: str,
    payload: PropertyUpdateRequest,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> dict:
    user = await auth_service.get_session_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")
    if user.get("role") not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Owner or admin access required.")

    try:
        updated = await property_service.update_property(
            property_id, payload.model_dump(exclude_none=True), user["id"], user["role"]
        )
        return {"property": updated, "message": "Property updated successfully."}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Unable to update property.") from exc


@app.patch("/admin/properties/{property_id}/verification")
async def update_property_verification(
    property_id: str,
    payload: PropertyVerificationUpdateRequest,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> dict:
    user = await auth_service.get_session_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")

    try:
        updated = await property_service.update_property(
            property_id, payload.model_dump(), user["id"], user["role"]
        )
        return {"property": updated, "message": "Property verification updated."}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Unable to update property verification.") from exc


@app.get("/admin/summary")
async def admin_summary(authorization: Optional[str] = Header(default=None, alias="Authorization")) -> dict:
    user = await auth_service.get_session_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")

    summary = await admin_service.get_summary()
    return summary


@app.get("/admin/properties")
async def admin_properties(authorization: Optional[str] = Header(default=None, alias="Authorization")) -> dict:
    user = await auth_service.get_session_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")

    properties = await admin_service.list_properties()
    return {"properties": properties, "count": len(properties)}


@app.get("/applications")
async def list_applications(authorization: Optional[str] = Header(default=None, alias="Authorization")) -> dict:
    user = await auth_service.get_session_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")

    apps = await application_service.list_applications(user["id"], user["role"])
    return {"applications": apps, "count": len(apps)}


@app.get("/applications/{application_id}")
async def get_application(application_id: str, authorization: Optional[str] = Header(default=None, alias="Authorization")) -> dict:
    user = await auth_service.get_session_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")

    app_data = await application_service.get_application(application_id, user["id"], user["role"])
    if not app_data:
        raise HTTPException(status_code=404, detail="Application not found.")

    return {"application": app_data}


@app.post("/applications")
async def create_application(
    payload: ApplicationCreateRequest,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> dict:
    user = await auth_service.get_session_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")
    if user.get("role") != "tenant":
        raise HTTPException(status_code=403, detail="Tenant access required.")

    try:
        if property_service.client is None:
            raise RuntimeError("Supabase backend is not configured.")
        property_data = await property_service.get_property(payload.property_id)
        if not property_data:
            raise HTTPException(status_code=404, detail="Property not found.")
        if str(property_data.get("verification_status", "")).lower() != "approved":
            raise HTTPException(status_code=409, detail="This property is not available for applications.")
        owner_id = property_data.get("owner_id")
        if not owner_id:
            raise HTTPException(status_code=409, detail="Property owner is not configured.")

        application_payload = payload.model_dump(exclude_none=True)
        application_payload.update({
            "applicant_email": user.get("email"),
            "property_title": property_data.get("title", "Property"),
            "property_image": property_data.get("image", ""),
            "property_location": property_data.get("location") or property_data.get("city", "Nigeria"),
            "property_price": property_data.get("price"),
            "property_period": property_data.get("period", "year"),
            "owner_name": property_data.get("owner_name", "Property Owner"),
        })

        application = await application_service.create_application(
            application_payload, user["id"], str(owner_id)
        )
        return {"application": application, "message": "Application submitted successfully."}
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Unable to submit application.") from exc


@app.patch("/applications/{application_id}")
async def update_application(
    application_id: str,
    payload: ApplicationUpdateRequest,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> dict:
    user = await auth_service.get_session_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")
    if user.get("role") not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Owner or admin access required.")

    try:
        application = await application_service.update_application(
            application_id, payload.model_dump(), user["id"], user["role"]
        )
        if not application:
            raise HTTPException(status_code=404, detail="Application not found.")
        return {"application": application, "message": "Application status updated."}
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Unable to update application.") from exc


@app.get("/viewing-requests")
async def list_viewing_requests(authorization: Optional[str] = Header(default=None, alias="Authorization")) -> dict:
    user = await auth_service.get_session_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")

    viewings = await viewing_service.list_viewings(user["id"], user["role"])
    return {"viewing_requests": viewings, "count": len(viewings)}


@app.get("/viewing-requests/{viewing_id}")
async def get_viewing_request(viewing_id: str, authorization: Optional[str] = Header(default=None, alias="Authorization")) -> dict:
    user = await auth_service.get_session_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")

    viewing = await viewing_service.get_viewing(viewing_id, user["id"], user["role"])
    if not viewing:
        raise HTTPException(status_code=404, detail="Viewing request not found.")

    return {"viewing_request": viewing}


@app.post("/viewing-requests")
async def create_viewing_request(
    payload: ViewingRequestCreateRequest,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> dict:
    user = await auth_service.get_session_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")
    if user.get("role") != "tenant":
        raise HTTPException(status_code=403, detail="Tenant access required.")

    try:
        viewing = await viewing_service.create_viewing(payload.model_dump(exclude_none=True), user["id"], payload.owner_id)
        return {"viewing_request": viewing, "message": "Viewing request created successfully."}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Unable to create viewing request.") from exc


@app.get("/agreements")
async def list_agreements(authorization: Optional[str] = Header(default=None, alias="Authorization")) -> dict:
    user = await auth_service.get_session_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")

    agreements = await agreement_service.list_agreements(user["id"], user["role"])
    return {"agreements": agreements, "count": len(agreements)}


@app.get("/agreements/{agreement_id}")
async def get_agreement(agreement_id: str, authorization: Optional[str] = Header(default=None, alias="Authorization")) -> dict:
    user = await auth_service.get_session_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")

    agreement = await agreement_service.get_agreement(agreement_id, user["id"], user["role"])
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found.")

    return {"agreement": agreement}


@app.post("/agreements")
async def create_agreement(
    payload: AgreementCreateRequest,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> dict:
    user = await auth_service.get_session_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")
    if user.get("role") not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Owner or admin access required.")

    try:
        agreement = await agreement_service.create_agreement(
            payload.model_dump(exclude_none=True),
            payload.tenant_id or user["id"],
            payload.owner_id,
        )
        return {"agreement": agreement, "message": "Agreement created successfully."}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Unable to create agreement.") from exc


@app.get("/notifications")
async def list_notifications(authorization: Optional[str] = Header(default=None, alias="Authorization")) -> dict:
    user = await auth_service.get_session_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")

    notifications = await notification_service.list_notifications(user["id"])
    return {"notifications": notifications, "count": len(notifications)}


@app.post("/notifications")
async def create_notification(
    payload: NotificationCreateRequest,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> dict:
    user = await auth_service.get_session_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")

    try:
        notification = await notification_service.create_notification(payload.model_dump(exclude_none=True))
        return {"notification": notification, "message": "Notification created successfully."}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Unable to create notification.") from exc


@app.patch("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, authorization: Optional[str] = Header(default=None, alias="Authorization")) -> dict:
    user = await auth_service.get_session_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")

    try:
        notification = await notification_service.mark_read(notification_id, user["id"])
        return {"notification": notification, "message": "Notification marked as read."}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Unable to update notification.") from exc


@app.post("/chat")
async def chat(request: ChatRequest) -> dict:
    try:
        response = await ai_service.generate_response(
            message=request.message,
            conversation_id=request.conversation_id,
        )

        return {
            "response": response,
            "conversation_id": request.conversation_id or "new",
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive backend catch
        raise HTTPException(
            status_code=500,
            detail="Unable to process the chat request right now.",
        ) from exc
