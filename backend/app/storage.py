from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, Optional, Tuple

from fastapi import HTTPException, status

from app import schemas

IN_MEMORY_ENABLED = True


class InMemoryStore:
    """Simple in-memory store for dev/testing."""

    def __init__(self, limit: int = 2) -> None:
        self.limit = limit
        self._bag_id = 1
        self._tag_id = 1
        self._entrupy_id = 1
        self.bags: Dict[int, schemas.Bag] = {}
        self.tags: Dict[int, schemas.Tag] = {}
        self.entrupy_items: Dict[int, schemas.Entrupy] = {}
        self.tag_code_map: Dict[str, int] = {}

    def _now(self) -> datetime:
        return datetime.now(timezone.utc)

    def _ensure_capacity(self) -> None:
        # Keep at most `limit` records for bags/tags/entrupy (drop oldest by id)
        if len(self.bags) > self.limit:
            oldest_id = sorted(self.bags.keys())[0]
            self._remove_bag(oldest_id)

    def _remove_bag(self, bag_id: int) -> None:
        self.bags.pop(bag_id, None)
        tags_to_delete = [tid for tid, t in self.tags.items() if t.bag_id == bag_id]
        for tid in tags_to_delete:
            tag = self.tags.pop(tid)
            self.tag_code_map.pop(tag.tag_code, None)
        self.entrupy_items.pop(bag_id, None)

    def create_bag_with_tag(self, payload: schemas.BagCreate) -> schemas.BagWithTag:
        created_at = self._now()
        bag = schemas.Bag(
            id=self._bag_id,
            display_name=payload.display_name,
            brand=payload.brand,
            model=payload.model,
            style=payload.style,
            color=payload.color,
            material=payload.material,
            external_bag_id=payload.external_bag_id,
            created_at=created_at,
            updated_at=created_at,
        )
        self.bags[bag.id] = bag
        self._bag_id += 1

        tag_id = self.tag_code_map.get(payload.tag_code)
        if tag_id is None:
            tag = schemas.Tag(
                id=self._tag_id,
                tag_code=payload.tag_code,
                status="assigned",
                bag_id=bag.id,
                created_at=created_at,
                updated_at=created_at,
            )
            self.tags[tag.id] = tag
            self.tag_code_map[payload.tag_code] = tag.id
            self._tag_id += 1
        else:
            tag = self.tags[tag_id]
            tag = tag.copy(update={"bag_id": bag.id, "status": "assigned", "updated_at": created_at})
            self.tags[tag_id] = tag

        self._ensure_capacity()
        return schemas.BagWithTag(bag=bag, tag=tag)

    def upsert_entrupy(self, payload: schemas.EntrupyCreate) -> schemas.Entrupy:
        bag = self.bags.get(payload.bag_id)
        if not bag:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bag not found")

        now = self._now()
        existing = self.entrupy_items.get(payload.bag_id)
        if existing:
            entrupy_id = existing.id
        else:
            entrupy_id = self._entrupy_id
            self._entrupy_id += 1

        entrupy = schemas.Entrupy(
            id=entrupy_id,
            bag_id=payload.bag_id,
            customer_item_id=payload.customer_item_id,
            authentication_status=payload.authentication_status,
            certificate_url=payload.certificate_url,
            brand=payload.brand,
            model=payload.model,
            style=payload.style,
            color=payload.color,
            material=payload.material,
            dimensions=payload.dimensions,
            condition_grade=payload.condition_grade,
            catalog_raw=payload.catalog_raw,
            entrupy_item_id=payload.entrupy_item_id,
            created_at=existing.created_at if existing else now,
            updated_at=now,
        )
        self.entrupy_items[payload.bag_id] = entrupy
        return entrupy

    def lookup_tag(self, tag_code: str) -> Tuple[schemas.Tag, Optional[schemas.Bag], Optional[schemas.Entrupy]]:
        tag_id = self.tag_code_map.get(tag_code)
        if tag_id is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")

        tag = self.tags[tag_id]
        bag = self.bags.get(tag.bag_id) if tag.bag_id else None
        entrupy = self.entrupy_items.get(bag.id) if bag else None
        return tag, bag, entrupy


in_memory_store = InMemoryStore()
