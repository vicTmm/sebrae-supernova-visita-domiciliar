import asyncio
from contextlib import asynccontextmanager, suppress
from .services.feedback_mail import run_delivery
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .database import engine, ensure_schema
from . import models
from .routers.feedback import router as feedback_router
from .routers.visits import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(ensure_schema)
    settings = get_settings()
    worker = None
    if settings.app_env == "production":
        if settings.smtp_host and settings.feedback_from and settings.feedback_to:
            worker = asyncio.create_task(run_delivery())
        else:
            import logging
            logging.getLogger(__name__).warning("Feedback em fila: configure SMTP_HOST, FEEDBACK_FROM e FEEDBACK_TO.")
    try:
        yield
    finally:
        if worker:
            worker.cancel()
            with suppress(asyncio.CancelledError):
                await worker
        await engine.dispose()


app = FastAPI(title="VD • Evolução ESF", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_origins,
                   allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Content-Type"])
app.include_router(router)
app.include_router(feedback_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
