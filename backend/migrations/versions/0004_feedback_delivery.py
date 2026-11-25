"""Classificação, contato e fila de entrega de feedback."""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    columns = {c["name"] for c in inspector.get_columns("feedback")}
    if "category" not in columns:
        op.add_column("feedback", sa.Column("category", sa.String(10), nullable=False, server_default="idea"))
    if "reply_to" not in columns:
        op.add_column("feedback", sa.Column("reply_to", sa.String(254)))
    if not inspector.has_table("feedback_delivery"):
        op.create_table("feedback_delivery", sa.Column("feedback_id", sa.String(36), primary_key=True),
                        sa.Column("available_at", sa.Integer(), nullable=False),
                        sa.Column("attempts", sa.Integer(), nullable=False))
        op.create_index("ix_feedback_delivery_available_at", "feedback_delivery", ["available_at"])


def downgrade():
    op.drop_table("feedback_delivery")
    with op.batch_alter_table("feedback") as batch:
        batch.drop_column("reply_to")
        batch.drop_column("category")
