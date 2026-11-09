"""Initial admin, product, price history and mining tables."""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("admin_users", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("username", sa.String(80), nullable=False, unique=True), sa.Column("password_hash", sa.String(512), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_admin_users_username", "admin_users", ["username"])
    op.create_table("products", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("external_id", sa.String(100), nullable=False, unique=True), sa.Column("name", sa.String(240), nullable=False), sa.Column("category", sa.String(100), nullable=False), sa.Column("current_price", sa.Float(), nullable=False), sa.Column("original_price", sa.Float()), sa.Column("commission_rate", sa.Float()), sa.Column("rating", sa.Float()), sa.Column("sales_count", sa.Integer()), sa.Column("score", sa.Integer(), nullable=False), sa.Column("confidence", sa.Integer(), nullable=False), sa.Column("image_url", sa.Text()), sa.Column("demo", sa.Boolean(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_products_external_id", "products", ["external_id"], unique=True)
    op.create_index("ix_products_category", "products", ["category"])
    op.create_index("ix_products_score", "products", ["score"])
    op.create_table("product_price_history", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False), sa.Column("price", sa.Float(), nullable=False), sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_product_price_history_product_id", "product_price_history", ["product_id"])
    op.create_table("mining_runs", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("status", sa.String(24), nullable=False), sa.Column("source", sa.String(24), nullable=False), sa.Column("found_count", sa.Integer(), nullable=False), sa.Column("new_count", sa.Integer(), nullable=False), sa.Column("message", sa.Text(), nullable=False), sa.Column("started_at", sa.DateTime(timezone=True), nullable=False), sa.Column("completed_at", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_table("mining_runs")
    op.drop_index("ix_product_price_history_product_id", table_name="product_price_history")
    op.drop_table("product_price_history")
    op.drop_index("ix_products_score", table_name="products")
    op.drop_index("ix_products_category", table_name="products")
    op.drop_index("ix_products_external_id", table_name="products")
    op.drop_table("products")
    op.drop_index("ix_admin_users_username", table_name="admin_users")
    op.drop_table("admin_users")