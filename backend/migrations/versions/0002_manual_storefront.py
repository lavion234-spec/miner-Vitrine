"""Add manual offers and storefront publication state."""
from alembic import op
import sqlalchemy as sa

revision = "0002_manual_storefront"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("source", sa.String(24), nullable=False, server_default="demo"))
    op.add_column("products", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("products", sa.Column("affiliate_url", sa.Text(), nullable=True))
    op.add_column("products", sa.Column("publication_status", sa.String(24), nullable=False, server_default="draft"))
    op.add_column("products", sa.Column("published_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_products_source", "products", ["source"])
    op.create_index("ix_products_publication_status", "products", ["publication_status"])


def downgrade() -> None:
    op.drop_index("ix_products_publication_status", table_name="products")
    op.drop_index("ix_products_source", table_name="products")
    op.drop_column("products", "published_at")
    op.drop_column("products", "publication_status")
    op.drop_column("products", "affiliate_url")
    op.drop_column("products", "description")
    op.drop_column("products", "source")