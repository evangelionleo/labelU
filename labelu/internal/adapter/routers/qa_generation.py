from typing import List
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException, status, Security
from fastapi.security import HTTPAuthorizationCredentials

from labelu.internal.common import db
from labelu.internal.common.security import security
from labelu.internal.dependencies.user import get_current_user
from labelu.internal.domain.models.user import User
from labelu.internal.application.command.qa_generation import (
    CreateQAGenerationCommand,
    BatchCreateQAGenerationCommand,
    UpdateQAGenerationCommand,
    DeleteQAGenerationCommand,
    BatchDeleteQAGenerationCommand,
    QAGenerationQueryCommand,
)
from labelu.internal.application.response.qa_generation import (
    QAGenerationResponse,
    CreateQAGenerationResponse,
    BatchCreateQAGenerationResponse,
    QAGenerationListResponse,
    QAGenerationStatsResponse,
    CommonDataResp,
)
from labelu.internal.application.response.base import MetaData, OkResp, OkRespWithMeta
from labelu.internal.application.service.qa_generation import (
    create,
    batch_create,
    get,
    list_by,
    get_by_task_id,
    get_by_sample_id,
    get_stats,
    update,
    delete,
    batch_delete,
    delete_by_task_id,
    delete_by_sample_id,
)

router = APIRouter(prefix="/qa-generation", tags=["qa-generation"])


@router.post("/", response_model=OkResp[CreateQAGenerationResponse])
async def create_qa_generation(
    cmd: CreateQAGenerationCommand,
    authorization: HTTPAuthorizationCredentials = Security(security),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(db.get_db),
):
    """创建单个问答对"""
    data = await create(db=db, cmd=cmd, current_user=current_user)
    return OkResp[CreateQAGenerationResponse](data=data)


@router.post("/batch", response_model=OkResp[BatchCreateQAGenerationResponse])
async def batch_create_qa_generation(
    cmd: BatchCreateQAGenerationCommand,
    authorization: HTTPAuthorizationCredentials = Security(security),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(db.get_db),
):
    """批量创建问答对"""
    data = await batch_create(db=db, cmd=cmd, current_user=current_user)
    return OkResp[BatchCreateQAGenerationResponse](data=data)


@router.get("/{qa_generation_id}", response_model=OkResp[QAGenerationResponse])
async def get_qa_generation(
    qa_generation_id: int,
    authorization: HTTPAuthorizationCredentials = Security(security),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(db.get_db),
):
    """获取单个问答对"""
    qa_generation = await get(db=db, qa_generation_id=qa_generation_id)
    if not qa_generation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="问答对不存在"
        )
    return OkResp[QAGenerationResponse](data=qa_generation)


@router.get("/", response_model=OkRespWithMeta[List[QAGenerationResponse]])
async def list_qa_generation(
    authorization: HTTPAuthorizationCredentials = Security(security),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(db.get_db),
    task_id: int | None = None,
    sample_id: int | None = None,
    pre_annotation_id: int | None = None,
    created_by: int | None = None,
    page: int | None = 0,
    size: int | None = 100,
    sorting: str | None = None,
):
    """查询问答对列表"""
    cmd = QAGenerationQueryCommand(
        task_id=task_id,
        sample_id=sample_id,
        pre_annotation_id=pre_annotation_id,
        created_by=created_by,
        page=page,
        size=size,
        sorting=sorting
    )
    data = await list_by(db=db, cmd=cmd)
    meta_data = MetaData(total=data.total, page=data.page, size=data.size)
    return OkRespWithMeta[List[QAGenerationResponse]](meta_data=meta_data, data=data.items)


@router.get("/task/{task_id}", response_model=OkRespWithMeta[List[QAGenerationResponse]])
async def get_qa_generation_by_task(
    task_id: int,
    authorization: HTTPAuthorizationCredentials = Security(security),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(db.get_db),
    page: int = 0,
    size: int = 100,
):
    """根据任务ID获取问答对列表"""
    data = await get_by_task_id(db=db, task_id=task_id, page=page, size=size)
    meta_data = MetaData(total=data.total, page=data.page, size=data.size)
    return OkRespWithMeta[List[QAGenerationResponse]](meta_data=meta_data, data=data.items)


@router.get("/sample/{sample_id}", response_model=OkRespWithMeta[List[QAGenerationResponse]])
async def get_qa_generation_by_sample(
    sample_id: int,
    authorization: HTTPAuthorizationCredentials = Security(security),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(db.get_db),
    page: int = 0,
    size: int = 100,
):
    """根据样本ID获取问答对列表"""
    data = await get_by_sample_id(db=db, sample_id=sample_id, page=page, size=size)
    meta_data = MetaData(total=data.total, page=data.page, size=data.size)
    return OkRespWithMeta[List[QAGenerationResponse]](meta_data=meta_data, data=data.items)


@router.get("/task/{task_id}/stats", response_model=OkResp[QAGenerationStatsResponse])
async def get_qa_generation_stats(
    task_id: int,
    authorization: HTTPAuthorizationCredentials = Security(security),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(db.get_db),
):
    """获取问答对统计信息"""
    data = await get_stats(db=db, task_id=task_id)
    return OkResp[QAGenerationStatsResponse](data=data)


@router.put("/{qa_generation_id}", response_model=OkResp[QAGenerationResponse])
async def update_qa_generation(
    qa_generation_id: int,
    cmd: UpdateQAGenerationCommand,
    authorization: HTTPAuthorizationCredentials = Security(security),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(db.get_db),
):
    """更新问答对"""
    qa_generation = await update(
        db=db, qa_generation_id=qa_generation_id, cmd=cmd
    )
    if not qa_generation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="问答对不存在"
        )
    return OkResp[QAGenerationResponse](data=qa_generation)


@router.delete("/{qa_generation_id}", response_model=OkResp[CommonDataResp])
async def delete_qa_generation(
    qa_generation_id: int,
    authorization: HTTPAuthorizationCredentials = Security(security),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(db.get_db),
):
    """删除问答对"""
    data = await delete(db=db, cmd=DeleteQAGenerationCommand(qa_generation_id=qa_generation_id))
    return OkResp[CommonDataResp](data=data)


@router.delete("/batch", response_model=OkResp[CommonDataResp])
async def batch_delete_qa_generation(
    cmd: BatchDeleteQAGenerationCommand,
    authorization: HTTPAuthorizationCredentials = Security(security),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(db.get_db),
):
    """批量删除问答对"""
    data = await batch_delete(db=db, cmd=cmd)
    return OkResp[CommonDataResp](data=data)


@router.delete("/task/{task_id}", response_model=OkResp[CommonDataResp])
async def delete_qa_generation_by_task(
    task_id: int,
    authorization: HTTPAuthorizationCredentials = Security(security),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(db.get_db),
):
    """根据任务ID删除所有问答对"""
    data = await delete_by_task_id(db=db, task_id=task_id)
    return OkResp[CommonDataResp](data=data)


@router.delete("/sample/{sample_id}", response_model=OkResp[CommonDataResp])
async def delete_qa_generation_by_sample(
    sample_id: int,
    authorization: HTTPAuthorizationCredentials = Security(security),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(db.get_db),
):
    """根据样本ID删除所有问答对"""
    data = await qa_generation.delete_by_sample_id(db=db, sample_id=sample_id)
    return OkResp[CommonDataResp](data=data)
