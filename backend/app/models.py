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


class Feedback(Base):
    __tablename__ = "feedback"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String(40))
    category: Mapped[str] = mapped_column(String(10), server_default="idea")
    reply_to: Mapped[str | None] = mapped_column(String(254))


class FeedbackDelivery(Base):
    __tablename__ = "feedback_delivery"
    feedback_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    available_at: Mapped[int] = mapped_column(Integer, index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
