"""Tabela inicial; compatível com bootstrap automático do MVP."""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = depends_on = None


def upgrade():
    if not sa.inspect(op.get_bind()).has_table("visits"):
        op.create_table("visits", sa.Column("id", sa.String(36), primary_key=True),
                        sa.Column("visited_at", sa.String(40), nullable=False),
                        sa.Column("payload", sa.JSON(), nullable=False),
                        sa.Column("soap_text", sa.Text(), nullable=False),
                        sa.Column("revision", sa.Integer(), nullable=False))
        op.create_index("ix_visits_visited_at", "visits", ["visited_at"])


def downgrade():
    op.drop_table("visits")
