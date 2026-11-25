from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import inspect, text
from .config import get_settings


class Base(DeclarativeBase):
    pass


engine = create_async_engine(get_settings().database_url)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


def ensure_schema(connection):
    """Bootstrap e migração aditiva compatível com bancos anteriores do MVP."""
    Base.metadata.create_all(connection)
    if 'soap_blocks' not in {c['name'] for c in inspect(connection).get_columns('visits')}:
        connection.execute(text('ALTER TABLE visits ADD COLUMN soap_blocks JSON'))


    columns = {c['name'] for c in inspect(connection).get_columns('feedback')}
    if 'category' not in columns:
        connection.execute(text("ALTER TABLE feedback ADD COLUMN category VARCHAR(10) NOT NULL DEFAULT 'idea'"))
    if 'reply_to' not in columns:
        connection.execute(text("ALTER TABLE feedback ADD COLUMN reply_to VARCHAR(254)"))


async def get_session():
    async with SessionLocal() as session:
        yield session
