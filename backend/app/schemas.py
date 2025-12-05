from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class BagBase(BaseModel):
    display_name: str
    brand: str
    model: Optional[str] = None
    style: Optional[str] = None
    color: Optional[str] = None
    material: Optional[str] = None


class BagCreate(BagBase):
    tag_code: str = Field(..., description="RFID/NFC code to assign")
    external_bag_id: Optional[str] = None


class Bag(BagBase):
    id: int
    external_bag_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class TagBase(BaseModel):
    tag_code: str
    status: Optional[str] = "unassigned"


class Tag(TagBase):
    id: int
    bag_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class EntrupyBase(BaseModel):
    customer_item_id: str
    authentication_status: Optional[str] = None
    certificate_url: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    style: Optional[str] = None
    color: Optional[str] = None
    material: Optional[str] = None
    dimensions: Optional[Dict[str, Any]] = None
    condition_grade: Optional[str] = None
    catalog_raw: Optional[Dict[str, Any]] = None
    entrupy_item_id: Optional[str] = None


class EntrupyCreate(EntrupyBase):
    bag_id: int


class Entrupy(EntrupyBase):
    id: int
    bag_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class BagWithTag(BaseModel):
    bag: Bag
    tag: Tag

    class Config:
        orm_mode = True


class TagLookupResponse(BaseModel):
    tag: Tag
    bag: Optional[Bag] = None
    entrupy: Optional[Entrupy] = None

    class Config:
        orm_mode = True
