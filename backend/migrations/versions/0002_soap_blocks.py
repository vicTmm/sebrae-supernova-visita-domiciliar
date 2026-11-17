"""Blocos SOAP revisados, preservando textos legados."""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = depends_on = None


def upgrade():
    if "soap_blocks" not in {c["name"] for c in sa.inspect(op.get_bind()).get_columns("visits")}:
        op.add_column("visits", sa.Column("soap_blocks", sa.JSON(), nullable=True))


def downgrade():
    with op.batch_alter_table("visits") as batch:
        batch.drop_column("soap_blocks")
