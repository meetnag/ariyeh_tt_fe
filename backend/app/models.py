from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

import sqlalchemy as sa
from sqlalchemy import BigInteger, ForeignKey, Text, TIMESTAMP, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Bag(Base):
    __tablename__ = "bags"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    external_bag_id: Mapped[Optional[str]] = mapped_column(Text, unique=True)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    brand: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[Optional[str]] = mapped_column(Text)
    style: Mapped[Optional[str]] = mapped_column(Text)
    color: Mapped[Optional[str]] = mapped_column(Text)
    material: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    tags: Mapped[List["Tag"]] = relationship(
        "Tag", back_populates="bag", passive_deletes=True
    )
    entrupy_item: Mapped[Optional["EntrupyItem"]] = relationship(
        "EntrupyItem", back_populates="bag", uselist=False, passive_deletes=True
    )


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tag_code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    bag_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("bags.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=sa.text("'unassigned'")
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    bag: Mapped[Optional["Bag"]] = relationship("Bag", back_populates="tags")


class EntrupyItem(Base):
    __tablename__ = "entrupy_items"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    bag_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("bags.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    customer_item_id: Mapped[str] = mapped_column(Text, nullable=False)
    entrupy_item_id: Mapped[Optional[str]] = mapped_column(Text)
    authentication_status: Mapped[Optional[str]] = mapped_column(Text)
    certificate_url: Mapped[Optional[str]] = mapped_column(Text)
    brand: Mapped[Optional[str]] = mapped_column(Text)
    model: Mapped[Optional[str]] = mapped_column(Text)
    style: Mapped[Optional[str]] = mapped_column(Text)
    color: Mapped[Optional[str]] = mapped_column(Text)
    material: Mapped[Optional[str]] = mapped_column(Text)
    dimensions: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    condition_grade: Mapped[Optional[str]] = mapped_column(Text)
    catalog_raw: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    bag: Mapped["Bag"] = relationship("Bag", back_populates="entrupy_item")
