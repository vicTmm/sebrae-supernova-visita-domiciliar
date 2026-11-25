from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, StringConstraints
from typing import Annotated, Literal
from time import time
from ..config import get_settings
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import Feedback, FeedbackDelivery

router = APIRouter(prefix="/feedback", tags=["feedback"])


class FeedbackInput(BaseModel):
    id: UUID
    category: Literal["idea", "issue"] = "idea"
    reply_to: Annotated[str, StringConstraints(max_length=254, pattern=r"^[^\s@<>,;:\x00-\x1f]+@[^\s@<>,;:\x00-\x1f]+\.[^\s@<>,;:\x00-\x1f]+$")] | None = None
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


@router.post("", status_code=201)
async def submit_feedback(data: FeedbackInput, session: AsyncSession = Depends(get_session)):
    identifier = str(data.id)
    inserted = await session.scalar(insert(Feedback).values(
        id=identifier, message=data.message, category=data.category, reply_to=data.reply_to,
        created_at=datetime.now(timezone.utc).isoformat()
    ).on_conflict_do_nothing(index_elements=["id"]).returning(Feedback.id))
    saved = await session.get(Feedback, identifier)
    if (saved.message, saved.category, saved.reply_to) != (data.message, data.category, data.reply_to):
        raise HTTPException(409, "Identificador de feedback já utilizado.")
    if inserted and get_settings().app_env == "production":
        session.add(FeedbackDelivery(feedback_id=identifier, available_at=int(time())))
    await session.commit()
    return {"id": identifier}
