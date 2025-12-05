import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import USE_IN_MEMORY_STORAGE, get_db
from app import schemas
from app.models import Bag, EntrupyItem, Tag
from app.storage import in_memory_store

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/bags", response_model=schemas.BagWithTag, status_code=status.HTTP_201_CREATED)
def create_bag(payload: schemas.BagCreate, db: Session = Depends(get_db)) -> schemas.BagWithTag:
    if USE_IN_MEMORY_STORAGE:
        return in_memory_store.create_bag_with_tag(payload)

    bag = Bag(
        display_name=payload.display_name,
        brand=payload.brand,
        model=payload.model,
        style=payload.style,
        color=payload.color,
        material=payload.material,
        external_bag_id=payload.external_bag_id,
    )
    db.add(bag)
    db.flush()

    tag = db.scalar(select(Tag).where(Tag.tag_code == payload.tag_code))
    if tag is None:
        tag = Tag(tag_code=payload.tag_code)
        db.add(tag)

    tag.bag_id = bag.id
    tag.status = "assigned"

    db.commit()
    db.refresh(bag)
    db.refresh(tag)

    return schemas.BagWithTag(bag=bag, tag=tag)


@router.post("/entrupy", response_model=schemas.Entrupy)
def upsert_entrupy(payload: schemas.EntrupyCreate, db: Session = Depends(get_db)) -> schemas.Entrupy:
    if USE_IN_MEMORY_STORAGE:
        return in_memory_store.upsert_entrupy(payload)

    bag = db.get(Bag, payload.bag_id)
    if bag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bag not found")

    entrupy_item = db.scalar(select(EntrupyItem).where(EntrupyItem.bag_id == payload.bag_id))
    if entrupy_item is None:
        entrupy_item = EntrupyItem(bag_id=payload.bag_id)
        db.add(entrupy_item)

    entrupy_item.customer_item_id = payload.customer_item_id
    entrupy_item.authentication_status = payload.authentication_status
    entrupy_item.certificate_url = payload.certificate_url
    entrupy_item.brand = payload.brand
    entrupy_item.model = payload.model
    entrupy_item.style = payload.style
    entrupy_item.color = payload.color
    entrupy_item.material = payload.material
    entrupy_item.dimensions = payload.dimensions
    entrupy_item.condition_grade = payload.condition_grade
    entrupy_item.catalog_raw = payload.catalog_raw
    entrupy_item.entrupy_item_id = payload.entrupy_item_id

    db.commit()
    db.refresh(entrupy_item)

    return entrupy_item
