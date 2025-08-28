"""add text media type

Revision ID: add_text_media_type
Revises: bc8fcb35b66b
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_text_media_type'
down_revision = 'bc8fcb35b66b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 注意：这里不需要修改数据库结构，因为 media_type 是字符串字段
    # 只需要确保应用层支持新的枚举值
    pass


def downgrade() -> None:
    # 如果需要回滚，可以在这里添加逻辑
    pass
