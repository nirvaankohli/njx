from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.frontend_state_service import (
    get_company_settings,
    get_frontend_session,
    sign_in_frontend_session,
    sign_out_frontend_session,
    upsert_company_settings,
)

router = APIRouter(tags=["frontend"])


class FrontendAuthRequest(BaseModel):
    email: str
    password: str | None = None
    full_name: str | None = None


class FrontendCompanySettings(BaseModel):
    company_name: str
    company_website: str | None = None
    company_size: str | None = None
    industry: str | None = None
    address: str | None = None
    phone: str | None = None
    company_logo_url: str | None = None


@router.get("/frontend/session")
def frontend_session():
    return get_frontend_session()


@router.post("/frontend/auth/sign-in")
def frontend_sign_in(request: FrontendAuthRequest):
    return sign_in_frontend_session(request.email, request.full_name)


@router.post("/frontend/auth/sign-up")
def frontend_sign_up(request: FrontendAuthRequest):
    return sign_in_frontend_session(request.email, request.full_name)


@router.delete("/frontend/session")
def frontend_sign_out():
    return sign_out_frontend_session()


@router.get("/frontend/company-settings")
def frontend_company_settings():
    return get_company_settings()


@router.post("/frontend/company-settings")
def frontend_upsert_company_settings(request: FrontendCompanySettings):
    return upsert_company_settings(request.model_dump(mode="json"))
