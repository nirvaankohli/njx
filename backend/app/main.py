from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.api.routes_dashboard import router as dashboard_router
from app.api.routes_documents import router as documents_router
from app.api.routes_frontend import router as frontend_router
from app.api.routes_setup import router as setup_router
from app.api.routes_share import router as share_router
from app.api.routes_telemetry import router as telemetry_router
from app.api.routes_verify import router as verify_router
from app.db.session import init_db
from app.services.errors import DocShieldError


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="DocShield API", version="0.1.0", lifespan=lifespan)
    app.include_router(setup_router)
    app.include_router(documents_router)
    app.include_router(share_router)
    app.include_router(verify_router)
    app.include_router(telemetry_router)
    app.include_router(dashboard_router)
    app.include_router(frontend_router)

    @app.exception_handler(DocShieldError)
    async def handle_docshield_error(_, exc: DocShieldError):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})

    return app


app = create_app()
