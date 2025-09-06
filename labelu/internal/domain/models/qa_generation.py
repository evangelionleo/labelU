from datetime import datetime

from sqlalchemy.schema import Index
from sqlalchemy.orm import relationship
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from labelu.internal.common.db import Base


class QAGeneration(Base):
    __tablename__ = "qa_generation"
    """问答对生成数据表"""

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    task_id = Column(Integer, ForeignKey("task.id"), index=True, comment="任务ID")
    sample_id = Column(Integer, ForeignKey("task_sample.id"), index=True, comment="样本ID")
    pre_annotation_id = Column(Integer, ForeignKey("task_pre_annotation.id"), nullable=True, comment="预标注ID")
    question = Column(Text, nullable=False, comment="问题内容")
    answer = Column(Text, nullable=False, comment="答案内容")
    prompt = Column(Text, comment="生成提示词")
    knowledge_text = Column(Text, comment="知识文本/制式文本")
    current_page = Column(Integer, comment="当前页码")
    total_pages = Column(Integer, comment="总页数")
    sample_index = Column(Integer, comment="样本索引")
    filename = Column(String(512), comment="文件名")
    api_model = Column(String(128), comment="API模型")
    api_base_url = Column(String(512), comment="API基础URL")
    num_pairs = Column(Integer, comment="问答对数量")
    created_by = Column(Integer, ForeignKey("user.id"), index=True, comment="创建者用户ID")
    created_at = Column(
        DateTime(timezone=True), default=datetime.now, comment="创建时间"
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.now,
        onupdate=datetime.now,
        comment="更新时间"
    )
    deleted_at = Column(DateTime(timezone=True), index=True, comment="删除时间")

    # 关系定义
    task = relationship("Task", foreign_keys=[task_id])
    sample = relationship("TaskSample", foreign_keys=[sample_id])
    pre_annotation = relationship("TaskPreAnnotation", foreign_keys=[pre_annotation_id])
    owner = relationship("User", foreign_keys=[created_by])

    # 索引
    Index("idx_qa_generation_task_id", task_id)
    Index("idx_qa_generation_sample_id", sample_id)
    Index("idx_qa_generation_created_by", created_by)
    Index("idx_qa_generation_id_deleted_at", id, deleted_at)





