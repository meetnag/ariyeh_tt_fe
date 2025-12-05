from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import schemas
from app.db import USE_IN_MEMORY_STORAGE, get_db
from app.models import Bag, EntrupyItem, Tag
from app.storage import in_memory_store

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("/{tag_code}", response_model=schemas.TagLookupResponse)
def get_tag(tag_code: str, db: Session = Depends(get_db)) -> schemas.TagLookupResponse:
    if USE_IN_MEMORY_STORAGE:
        tag, bag, entrupy = in_memory_store.lookup_tag(tag_code)
        return schemas.TagLookupResponse(tag=tag, bag=bag, entrupy=entrupy)

    tag = db.scalar(select(Tag).where(Tag.tag_code == tag_code))
    if tag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")

    bag = None
    entrupy = None

    if tag.bag_id:
        bag = db.get(Bag, tag.bag_id)
        if bag:
            entrupy = db.scalar(select(EntrupyItem).where(EntrupyItem.bag_id == bag.id))

    return schemas.TagLookupResponse(tag=tag, bag=bag, entrupy=entrupy)
