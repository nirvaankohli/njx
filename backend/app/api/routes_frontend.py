from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.services.frontend_state_service import (
    get_company_settings,
    get_frontend_session,
    sign_in_frontend_session,
    sign_out_frontend_session,
    sign_up_frontend_session,
    upsert_company_settings,
)

router = APIRouter(tags=["frontend"])
SESSION_COOKIE = "docshield_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 30


class FrontendAuthRequest(BaseModel):
    email: str
    password: str = Field(min_length=6)
    full_name: str | None = None


class FrontendCompanySettings(BaseModel):
    company_name: str
    company_website: str | None = None
    company_size: str | None = None
    industry: str | None = None
    address: str | None = None
    phone: str | None = None
    company_logo_url: str | None = None


def _set_session_cookie(response: Response, request: Request, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="lax",
    )


@router.get("/frontend/session")
def frontend_session(request: Request):
    return get_frontend_session(request.cookies.get(SESSION_COOKIE))


@router.post("/frontend/auth/sign-in")
def frontend_sign_in(payload: FrontendAuthRequest, request: Request, response: Response):
    try:
        session, token = sign_in_frontend_session(payload.email, payload.password)
    except ValueError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    _set_session_cookie(response, request, token)
    return session


@router.post("/frontend/auth/sign-up")
def frontend_sign_up(payload: FrontendAuthRequest, request: Request, response: Response):
    try:
        session, token = sign_up_frontend_session(payload.email, payload.password, payload.full_name)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    _set_session_cookie(response, request, token)
    return session


@router.delete("/frontend/session")
def frontend_sign_out(request: Request, response: Response):
    result = sign_out_frontend_session(request.cookies.get(SESSION_COOKIE))
    response.delete_cookie(SESSION_COOKIE)
    return result


@router.get("/frontend/company-settings")
def frontend_company_settings(request: Request):
    return get_company_settings(request.cookies.get(SESSION_COOKIE))


@router.post("/frontend/company-settings")
def frontend_upsert_company_settings(payload: FrontendCompanySettings, request: Request):
    try:
        return upsert_company_settings(request.cookies.get(SESSION_COOKIE), payload.model_dump(mode="json"))
    except ValueError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
