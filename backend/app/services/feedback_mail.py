import asyncio
import logging
import smtplib
import ssl
import time
from email.message import EmailMessage

from sqlalchemy import delete, select, update

from ..config import get_settings
from ..database import SessionLocal
from ..models import Feedback, FeedbackDelivery

logger = logging.getLogger(__name__)


def send_mail(feedback):
    settings = get_settings()
    message = EmailMessage()
    category = "Problema" if feedback.category == "issue" else "Sugestão"
    message["Subject"] = f"[Visitário] {category}"
    message["From"] = settings.feedback_from
    message["To"] = settings.feedback_to
    if feedback.reply_to:
        message["Reply-To"] = feedback.reply_to
    message["Message-ID"] = f"<feedback-{feedback.id}@{settings.feedback_from.rsplit('@', 1)[-1]}>"
    message.set_content(f"{feedback.message}\n\nRegistro: {feedback.id}\nData (UTC): {feedback.created_at}")
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
        smtp.starttls(context=ssl.create_default_context())
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message, from_addr=settings.feedback_from, to_addrs=[settings.feedback_to])


async def deliver_next(sessions=SessionLocal):
    now = int(time.time())
    async with sessions() as session:
        candidate = select(FeedbackDelivery.feedback_id).where(
            FeedbackDelivery.available_at <= now
        ).order_by(FeedbackDelivery.available_at).limit(1).scalar_subquery()
        claim = (await session.execute(update(FeedbackDelivery).where(
            FeedbackDelivery.feedback_id == candidate
        ).values(available_at=now + 600, attempts=FeedbackDelivery.attempts + 1)
          .returning(FeedbackDelivery.feedback_id, FeedbackDelivery.attempts))).first()
        if claim is None:
            return False
        identifier, attempt = claim
        feedback = await session.get(Feedback, identifier)
        await session.commit()
        owner = (FeedbackDelivery.feedback_id == identifier, FeedbackDelivery.attempts == attempt)
        try:
            await asyncio.to_thread(send_mail, feedback)
        except Exception:
            logger.warning("Falha SMTP no feedback %s, tentativa %s", identifier, attempt)
            delay = min(3600, 30 * 2 ** min(attempt, 7))
            await session.execute(update(FeedbackDelivery).where(*owner).values(available_at=int(time.time()) + delay))
        else:
            await session.execute(delete(FeedbackDelivery).where(*owner))
        await session.commit()
    return True


async def run_delivery():
    while True:
        try:
            if await deliver_next():
                continue
        except Exception:
            logger.exception("Falha ao processar fila de feedback")
        await asyncio.sleep(5)
