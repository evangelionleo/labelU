from datetime import datetime
from typing import List, Tuple, Union

from sqlalchemy.orm import Session

from labelu.internal.adapter.persistence.crud_qa_generation import (
    create as crud_create,
    batch as crud_batch,
    get as crud_get,
    list_by as crud_list_by,
    get_by_task_id as crud_get_by_task_id,
    get_by_sample_id as crud_get_by_sample_id,
    update as crud_update,
    delete as crud_delete,
    batch_delete as crud_batch_delete,
    delete_by_task_id as crud_delete_by_task_id,
    delete_by_sample_id as crud_delete_by_sample_id,
    count_by_task_id as crud_count_by_task_id,
    count_by_sample_id as crud_count_by_sample_id,
)
from labelu.internal.domain.models.qa_generation import QAGeneration
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


async def create(
    db: Session, cmd: CreateQAGenerationCommand, current_user: User
) -> CreateQAGenerationResponse:
    """创建单个问答对"""
    qa_generation = QAGeneration(
        task_id=cmd.task_id,
        sample_id=cmd.sample_id,
        pre_annotation_id=cmd.pre_annotation_id,
        question=cmd.question,
        answer=cmd.answer,
        prompt=cmd.prompt,
        knowledge_text=cmd.knowledge_text,
        current_page=cmd.current_page,
        total_pages=cmd.total_pages,
        sample_index=cmd.sample_index,
        filename=cmd.filename,
        api_model=cmd.api_model,
        api_base_url=cmd.api_base_url,
        num_pairs=cmd.num_pairs,
        created_by=current_user.id,
    )
    
    new_qa_generation = crud_create(db=db, qa_generation=qa_generation)
    
    return CreateQAGenerationResponse(id=new_qa_generation.id)


async def batch_create(
    db: Session, cmd: BatchCreateQAGenerationCommand, current_user: User
) -> BatchCreateQAGenerationResponse:
    """批量创建问答对"""
    qa_generations = []
    
    for qa_cmd in cmd.qa_pairs:
        qa_generation = QAGeneration(
            task_id=qa_cmd.task_id,
            sample_id=qa_cmd.sample_id,
            pre_annotation_id=qa_cmd.pre_annotation_id,
            question=qa_cmd.question,
            answer=qa_cmd.answer,
            prompt=qa_cmd.prompt,
            knowledge_text=qa_cmd.knowledge_text,
            current_page=qa_cmd.current_page,
            total_pages=qa_cmd.total_pages,
            sample_index=qa_cmd.sample_index,
            filename=qa_cmd.filename,
            api_model=qa_cmd.api_model,
            api_base_url=qa_cmd.api_base_url,
            num_pairs=qa_cmd.num_pairs,
            created_by=current_user.id,
        )
        qa_generations.append(qa_generation)
    
    new_qa_generations = crud_batch(db=db, qa_generations=qa_generations)
    
    return BatchCreateQAGenerationResponse(
        ids=[qa.id for qa in new_qa_generations],
        total=len(new_qa_generations)
    )


async def get(
    db: Session, qa_generation_id: int
) -> Union[QAGenerationResponse, None]:
    """获取单个问答对"""
    qa_generation = crud_get(db=db, qa_generation_id=qa_generation_id)
    if not qa_generation:
        return None
    
    return QAGenerationResponse.from_orm(qa_generation)


async def list_by(
    db: Session, cmd: QAGenerationQueryCommand
) -> QAGenerationListResponse:
    """查询问答对列表"""
    qa_generations, total = crud_list_by(
        db=db,
        task_id=cmd.task_id,
        sample_id=cmd.sample_id,
        pre_annotation_id=cmd.pre_annotation_id,
        created_by=cmd.created_by,
        page=cmd.page,
        size=cmd.size,
        sorting=cmd.sorting,
    )
    
    items = [QAGenerationResponse.from_orm(qa) for qa in qa_generations]
    
    return QAGenerationListResponse(
        items=items,
        total=total,
        page=cmd.page or 0,
        size=cmd.size
    )


async def get_by_task_id(
    db: Session, task_id: int, page: int = 0, size: int = 100
) -> QAGenerationListResponse:
    """根据任务ID获取问答对列表"""
    qa_generations, total = crud_list_by(
        db=db,
        task_id=task_id,
        page=page,
        size=size,
        sorting="created_at_desc"
    )
    
    items = [QAGenerationResponse.from_orm(qa) for qa in qa_generations]
    
    return QAGenerationListResponse(
        items=items,
        total=total,
        page=page,
        size=size
    )


async def get_by_sample_id(
    db: Session, sample_id: int, page: int = 0, size: int = 100
) -> QAGenerationListResponse:
    """根据样本ID获取问答对列表"""
    qa_generations, total = crud_list_by(
        db=db,
        sample_id=sample_id,
        page=page,
        size=size,
        sorting="created_at_desc"
    )
    
    items = [QAGenerationResponse.from_orm(qa) for qa in qa_generations]
    
    return QAGenerationListResponse(
        items=items,
        total=total,
        page=page,
        size=size
    )


async def update(
    db: Session, qa_generation_id: int, cmd: UpdateQAGenerationCommand
) -> Union[QAGenerationResponse, None]:
    """更新问答对"""
    qa_generation = crud_get(db=db, qa_generation_id=qa_generation_id)
    if not qa_generation:
        return None
    
    # 构建更新数据
    update_data = {}
    for field, value in cmd.dict(exclude_unset=True).items():
        if value is not None:
            update_data[field] = value
    
    if update_data:
        updated_qa_generation = crud_update(
            db=db, db_obj=qa_generation, obj_in=update_data
        )
        return QAGenerationResponse.from_orm(updated_qa_generation)
    
    return QAGenerationResponse.from_orm(qa_generation)


async def delete(
    db: Session, cmd: DeleteQAGenerationCommand
) -> CommonDataResp:
    """删除问答对"""
    qa_generation = crud_get(db=db, qa_generation_id=cmd.qa_generation_id)
    if not qa_generation:
        return CommonDataResp(ok=False, message="问答对不存在")
    
    crud_delete(db=db, qa_generation_id=cmd.qa_generation_id)
    
    return CommonDataResp(ok=True, message="问答对删除成功")


async def batch_delete(
    db: Session, cmd: BatchDeleteQAGenerationCommand
) -> CommonDataResp:
    """批量删除问答对"""
    if not cmd.qa_generation_ids:
        return CommonDataResp(ok=False, message="请选择要删除的问答对")
    
    deleted_count = 0
    for qa_id in cmd.qa_generation_ids:
        qa_generation = crud_get(db=db, qa_generation_id=qa_id)
        if qa_generation:
            crud_delete(db=db, qa_generation_id=qa_id)
            deleted_count += 1
    
    return CommonDataResp(
        ok=True, 
        message=f"成功删除 {deleted_count} 个问答对"
    )


async def delete_by_task_id(db: Session, task_id: int) -> CommonDataResp:
    """根据任务ID删除所有问答对"""
    count = crud_count_by_task_id(db=db, task_id=task_id)
    if count == 0:
        return CommonDataResp(ok=True, message="任务下没有问答对数据")
    
    crud_delete_by_task_id(db=db, task_id=task_id)
    
    return CommonDataResp(
        ok=True, 
        message=f"成功删除任务下的 {count} 个问答对"
    )


async def delete_by_sample_id(db: Session, sample_id: int) -> CommonDataResp:
    """根据样本ID删除所有问答对"""
    count = crud_count_by_sample_id(db=db, sample_id=sample_id)
    if count == 0:
        return CommonDataResp(ok=True, message="样本下没有问答对数据")
    
    crud_delete_by_sample_id(db=db, sample_id=sample_id)
    
    return CommonDataResp(
        ok=True, 
        message=f"成功删除样本下的 {count} 个问答对"
    )


async def get_stats(db: Session, task_id: int) -> QAGenerationStatsResponse:
    """获取问答对统计信息"""
    qa_generations = crud_get_by_task_id(db=db, task_id=task_id)
    
    total_qa_pairs = len(qa_generations)
    sample_ids = set(qa.sample_id for qa in qa_generations)
    total_samples = len(sample_ids)
    created_by_users = list(set(qa.created_by for qa in qa_generations))
    
    latest_created_at = None
    if qa_generations:
        latest_created_at = max(qa.created_at for qa in qa_generations)
    
    return QAGenerationStatsResponse(
        task_id=task_id,
        total_qa_pairs=total_qa_pairs,
        total_samples=total_samples,
        created_by_users=created_by_users,
        latest_created_at=latest_created_at
    )
