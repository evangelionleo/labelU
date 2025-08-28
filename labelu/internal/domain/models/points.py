from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from labelu.internal.common.db import Base


class UserPoints(Base):
    __tablename__ = "user_points"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), index=True, comment="用户ID")
    points = Column(Integer, default=0, comment="积分数量")
    level = Column(String(32), default="BRONZE", comment="用户等级")
    created_at = Column(
        DateTime(timezone=True), default=datetime.now, comment="创建时间"
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.now,
        onupdate=datetime.now,
        comment="更新时间",
    )

    # 关联关系
    user = relationship("User", back_populates="points")


class PointsHistory(Base):
    __tablename__ = "points_history"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), index=True, comment="用户ID")
    points_change = Column(Integer, comment="积分变化(+/-)")
    reason = Column(String(128), comment="积分变化原因")
    description = Column(Text, comment="详细描述")
    created_at = Column(
        DateTime(timezone=True), default=datetime.now, comment="创建时间"
    )

    # 关联关系
    user = relationship("User", back_populates="points_history")
