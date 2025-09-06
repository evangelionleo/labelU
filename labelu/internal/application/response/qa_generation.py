from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from labelu.internal.application.response.user import UserResponse


class QAGenerationResponse(BaseModel):
    """问答对响应模型"""
    id: int = Field(..., description="问答对ID")
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
    created_by: Optional[UserResponse] = Field(None, description="创建者用户信息")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class CreateQAGenerationResponse(BaseModel):
    """创建问答对响应模型"""
    id: int = Field(..., description="问答对ID")


class BatchCreateQAGenerationResponse(BaseModel):
    """批量创建问答对响应模型"""
    ids: List[int] = Field(..., description="问答对ID列表")
    total: int = Field(..., description="创建总数")


class QAGenerationListResponse(BaseModel):
    """问答对列表响应模型"""
    items: List[QAGenerationResponse] = Field(..., description="问答对列表")
    total: int = Field(..., description="总数")
    page: int = Field(..., description="当前页码")
    size: int = Field(..., description="每页大小")


class QAGenerationStatsResponse(BaseModel):
    """问答对统计响应模型"""
    task_id: int = Field(..., description="任务ID")
    total_qa_pairs: int = Field(..., description="问答对总数")
    total_samples: int = Field(..., description="涉及样本数")
    created_by_users: List[int] = Field(..., description="创建者用户ID列表")
    latest_created_at: Optional[datetime] = Field(None, description="最新创建时间")


class CommonDataResp(BaseModel):
    """通用数据响应模型"""
    ok: bool = Field(..., description="操作是否成功")
    message: Optional[str] = Field(None, description="响应消息")
