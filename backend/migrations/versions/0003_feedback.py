"""Mensagens de feedback do aplicativo."""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = depends_on = None


def upgrade():
    if not sa.inspect(op.get_bind()).has_table("feedback"):
        op.create_table("feedback", sa.Column("id", sa.String(36), primary_key=True),
                        sa.Column("message", sa.Text(), nullable=False),
                        sa.Column("created_at", sa.String(40), nullable=False))


def downgrade():
    op.drop_table("feedback")
