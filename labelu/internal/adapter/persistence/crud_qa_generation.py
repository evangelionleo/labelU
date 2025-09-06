from datetime import datetime
from typing import Any, Dict, List, Union, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi.encoders import jsonable_encoder

from labelu.internal.domain.models.qa_generation import QAGeneration


def create(db: Session, qa_generation: QAGeneration) -> QAGeneration:
    """创建单个问答对记录"""
    db.add(qa_generation)
    db.flush()
    db.refresh(qa_generation)
    return qa_generation


def batch(db: Session, qa_generations: List[QAGeneration]) -> List[QAGeneration]:
    """批量创建问答对记录"""
    db.bulk_save_objects(qa_generations, return_defaults=True)
    return qa_generations


def get(db: Session, qa_generation_id: int) -> Union[QAGeneration, None]:
    """根据ID获取单个问答对记录"""
    return db.query(QAGeneration).filter(
        QAGeneration.id == qa_generation_id,
        QAGeneration.deleted_at.is_(None)
    ).first()


def list_by(
    db: Session,
    task_id: Union[int, None] = None,
    sample_id: Union[int, None] = None,
    pre_annotation_id: Union[int, None] = None,
    created_by: Union[int, None] = None,
    after: Union[int, None] = None,
    before: Union[int, None] = None,
    page: Union[int, None] = None,
    size: int = 100,
    sorting: Union[str, None] = None,
) -> Tuple[List[QAGeneration], int]:
    """查询问答对记录列表"""
    query = db.query(QAGeneration).filter(QAGeneration.deleted_at.is_(None))

    # 查询过滤条件
    if task_id is not None:
        query = query.filter(QAGeneration.task_id == task_id)
    if sample_id is not None:
        query = query.filter(QAGeneration.sample_id == sample_id)
    if pre_annotation_id is not None:
        query = query.filter(QAGeneration.pre_annotation_id == pre_annotation_id)
    if created_by is not None:
        query = query.filter(QAGeneration.created_by == created_by)

    # 排序必须在分页之前
    if sorting:
        if sorting == "created_at_desc":
            query = query.order_by(QAGeneration.created_at.desc())
        elif sorting == "created_at_asc":
            query = query.order_by(QAGeneration.created_at.asc())
        else:
            query = query.order_by(QAGeneration.id.desc())
    else:
        query = query.order_by(QAGeneration.id.desc())

    # 分页必须在排序之后
    if page is not None and size > 0:
        query = query.offset(page * size).limit(size)

    # 获取总数
    total = query.count()
    
    # 执行查询
    qa_generations = query.all()
    
    return qa_generations, total


def get_by_task_id(db: Session, task_id: int, page: int = 0, size: int = 100) -> Tuple[List[QAGeneration], int]:
    """根据任务ID获取问答对记录，支持分页"""
    query = db.query(QAGeneration).filter(
        QAGeneration.task_id == task_id,
        QAGeneration.deleted_at.is_(None)
    ).order_by(QAGeneration.created_at.desc())
    
    # 获取总数
    total = query.count()
    
    # 分页
    qa_generations = query.offset(page * size).limit(size).all()
    
    return qa_generations, total


def get_by_sample_id(db: Session, sample_id: int, page: int = 0, size: int = 100) -> Tuple[List[QAGeneration], int]:
    """根据样本ID获取问答对记录，支持分页"""
    query = db.query(QAGeneration).filter(
        QAGeneration.sample_id == sample_id,
        QAGeneration.deleted_at.is_(None)
    ).order_by(QAGeneration.created_at.desc())
    
    # 获取总数
    total = query.count()
    
    # 分页
    qa_generations = query.offset(page * size).limit(size).all()
    
    return qa_generations, total


def update(db: Session, db_obj: QAGeneration, obj_in: Dict[str, Any]) -> QAGeneration:
    """更新问答对记录"""
    obj_data = jsonable_encoder(db_obj)
    for field in obj_data:
        if field in obj_in:
            setattr(db_obj, field, obj_in[field])
    
    # 更新时间
    db_obj.updated_at = datetime.now()
    
    db.add(db_obj)
    db.flush()
    db.refresh(db_obj)
    return db_obj


def delete(db: Session, qa_generation_id: int) -> None:
    """软删除问答对记录"""
    qa_generation = get(db, qa_generation_id)
    if qa_generation:
        qa_generation.deleted_at = datetime.now()
        db.add(qa_generation)
        db.flush()


def delete_by_task_id(db: Session, task_id: int) -> None:
    """根据任务ID软删除所有问答对记录"""
    qa_generations = get_by_task_id(db, task_id)
    for qa_generation in qa_generations:
        qa_generation.deleted_at = datetime.now()
        db.add(qa_generation)
    db.flush()


def delete_by_sample_id(db: Session, sample_id: int) -> None:
    """根据样本ID软删除所有问答对记录"""
    qa_generations = get_by_sample_id(db, sample_id)
    for qa_generation in qa_generations:
        qa_generation.deleted_at = datetime.now()
        db.add(qa_generation)
    db.flush()


def count_by_task_id(db: Session, task_id: int) -> int:
    """统计任务下的问答对数量"""
    return db.query(QAGeneration).filter(
        QAGeneration.task_id == task_id,
        QAGeneration.deleted_at.is_(None)
    ).count()


def count_by_sample_id(db: Session, sample_id: int) -> int:
    """统计样本下的问答对数量"""
    return db.query(QAGeneration).filter(
        QAGeneration.sample_id == sample_id,
        QAGeneration.deleted_at.is_(None)
    ).count()


def batch_delete(db: Session, qa_generation_ids: List[int]) -> int:
    """批量软删除问答对记录"""
    if not qa_generation_ids:
        return 0
    
    deleted_count = 0
    for qa_id in qa_generation_ids:
        qa_generation = get(db, qa_id)
        if qa_generation:
            qa_generation.deleted_at = datetime.now()
            db.add(qa_generation)
            deleted_count += 1
    
    if deleted_count > 0:
        db.flush()
    
    return deleted_count
