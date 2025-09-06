from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class CreateQAGenerationCommand(BaseModel):
    """创建问答对命令"""
    task_id: int = Field(..., description="任务ID")
    sample_id: int = Field(..., description="样本ID")
    pre_annotation_id: Optional[int] = Field(None, description="预标注ID")
    question: str = Field(..., description="问题内容")
    answer: str = Field(..., description="答案内容")
    prompt: Optional[str] = Field(None, description="生成提示词")
    knowledge_text: Optional[str] = Field(None, description="知识文本/制式文本")
    current_page: Optional[int] = Field(None, description="当前页码")
    total_pages: Optional[int] = Field(None, description="总页数")
    sample_index: Optional[int] = Field(None, description="样本索引")
    filename: Optional[str] = Field(None, description="文件名")
    api_model: Optional[str] = Field(None, description="API模型")
    api_base_url: Optional[str] = Field(None, description="API基础URL")
    num_pairs: Optional[int] = Field(None, description="问答对数量")


class BatchCreateQAGenerationCommand(BaseModel):
    """批量创建问答对命令"""
    qa_pairs: List[CreateQAGenerationCommand] = Field(..., description="问答对列表")


class UpdateQAGenerationCommand(BaseModel):
    """更新问答对命令"""
    question: Optional[str] = Field(None, description="问题内容")
    answer: Optional[str] = Field(None, description="答案内容")
    prompt: Optional[str] = Field(None, description="生成提示词")
    knowledge_text: Optional[str] = Field(None, description="知识文本/制式文本")
    current_page: Optional[int] = Field(None, description="当前页码")
    total_pages: Optional[int] = Field(None, description="总页数")
    sample_index: Optional[int] = Field(None, description="样本索引")
    filename: Optional[str] = Field(None, description="文件名")
    api_model: Optional[str] = Field(None, description="API模型")
    api_base_url: Optional[str] = Field(None, description="API基础URL")
    num_pairs: Optional[int] = Field(None, description="问答对数量")


class DeleteQAGenerationCommand(BaseModel):
    """删除问答对命令"""
    qa_generation_id: int = Field(..., description="问答对ID")


class BatchDeleteQAGenerationCommand(BaseModel):
    """批量删除问答对命令"""
    qa_generation_ids: List[int] = Field(..., description="问答对ID列表")


class QAGenerationQueryCommand(BaseModel):
    """问答对查询命令"""
    task_id: Optional[int] = Field(None, description="任务ID")
    sample_id: Optional[int] = Field(None, description="样本ID")
    pre_annotation_id: Optional[int] = Field(None, description="预标注ID")
    created_by: Optional[int] = Field(None, description="创建者用户ID")
    page: Optional[int] = Field(0, description="页码")
    size: int = Field(100, description="每页大小")
    sorting: Optional[str] = Field(None, description="排序方式")





