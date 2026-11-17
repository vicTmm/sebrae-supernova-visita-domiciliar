from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .database import engine, ensure_schema
from . import models
from .routers.visits import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(ensure_schema)
    yield
    await engine.dispose()


app = FastAPI(title="VD • Evolução ESF", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_origins,
                   allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Content-Type"])
app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "ok"}
