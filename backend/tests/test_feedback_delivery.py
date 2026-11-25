from uuid import uuid4
from unittest.mock import patch

import pytest
from sqlalchemy import update
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.config import get_settings
from app.database import Base
from app.models import FeedbackDelivery
from app.routers.feedback import FeedbackInput, submit_feedback
from app.services.feedback_mail import deliver_next


@pytest.mark.asyncio
async def test_production_delivery_retries_and_deduplicates(tmp_path, monkeypatch):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'feedback.db'}")
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    settings = get_settings()
    monkeypatch.setattr(settings, "feedback_from", "visitario@example.org")
    monkeypatch.setattr(settings, "feedback_to", "triagem@example.org")
    for env in ["development", "production"]:
        monkeypatch.setattr(settings, "app_env", env)
        data = FeedbackInput(id=uuid4(), category="issue", message="Tela travou", reply_to="medico@example.org")
        async with sessions() as session:
            await submit_feedback(data, session)
            await submit_feedback(data, session)
        if env == "development":
            assert not await deliver_next(sessions)
            continue
        with patch("app.services.feedback_mail.smtplib.SMTP") as smtp:
            connection = smtp.return_value.__enter__.return_value
            connection.send_message.side_effect = OSError("SMTP indisponível")
            assert await deliver_next(sessions)
            assert not await deliver_next(sessions)
            async with sessions.begin() as session:
                await session.execute(update(FeedbackDelivery).values(available_at=0))
            connection.send_message.side_effect = None
            assert await deliver_next(sessions)
            msg = connection.send_message.call_args.args[0]
            assert msg["To"] == "triagem@example.org"
            assert msg["Subject"] == "[Visitário] Problema"
            assert msg["Reply-To"] == data.reply_to
            assert data.message in msg.get_content()
            async with sessions() as session:
                await submit_feedback(data, session)
            assert not await deliver_next(sessions)
    await engine.dispose()
