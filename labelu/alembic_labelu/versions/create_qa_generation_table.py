"""create_qa_generation_table

创建问答对生成数据表

Revision ID: create_qa_generation_table
Revises: 0145db0fec34
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'create_qa_generation_table'
down_revision = '0145db0fec34'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """创建问答对表"""
    op.create_table('qa_generation',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.Integer(), nullable=True),
        sa.Column('sample_id', sa.Integer(), nullable=True),
        sa.Column('pre_annotation_id', sa.Integer(), nullable=True),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('answer', sa.Text(), nullable=False),
        sa.Column('prompt', sa.Text(), nullable=True),
        sa.Column('knowledge_text', sa.Text(), nullable=True),
        sa.Column('current_page', sa.Integer(), nullable=True),
        sa.Column('total_pages', sa.Integer(), nullable=True),
        sa.Column('sample_index', sa.Integer(), nullable=True),
        sa.Column('filename', sa.String(length=512), nullable=True),
        sa.Column('api_model', sa.String(length=128), nullable=True),
        sa.Column('api_base_url', sa.String(length=512), nullable=True),
        sa.Column('num_pairs', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['user.id'], ),
        sa.ForeignKeyConstraint(['pre_annotation_id'], ['task_pre_annotation.id'], ),
        sa.ForeignKeyConstraint(['sample_id'], ['task_sample.id'], ),
        sa.ForeignKeyConstraint(['task_id'], ['task.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 创建索引
    op.create_index('idx_qa_generation_task_id', 'qa_generation', ['task_id'])
    op.create_index('idx_qa_generation_sample_id', 'qa_generation', ['sample_id'])
    op.create_index('idx_qa_generation_created_by', 'qa_generation', ['created_by'])
    op.create_index('idx_qa_generation_id_deleted_at', 'qa_generation', ['id', 'deleted_at'])


def downgrade() -> None:
    """删除问答对表"""
    op.drop_index('idx_qa_generation_id_deleted_at', table_name='qa_generation')
    op.drop_index('idx_qa_generation_created_by', table_name='qa_generation')
    op.drop_index('idx_qa_generation_sample_id', table_name='qa_generation')
    op.drop_index('idx_qa_generation_task_id', table_name='qa_generation')
    op.drop_table('qa_generation')



