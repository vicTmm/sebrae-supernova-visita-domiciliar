from sqlalchemy import JSON, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base


class Visit(Base):
    __tablename__ = "visits"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    visited_at: Mapped[str] = mapped_column(String(40), index=True)
    payload: Mapped[dict] = mapped_column(JSON)
    soap_text: Mapped[str] = mapped_column(Text)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    soap_blocks: Mapped[dict | None] = mapped_column(JSON, nullable=True)
