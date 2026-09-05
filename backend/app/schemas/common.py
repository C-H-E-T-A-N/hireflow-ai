from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ListResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int


class MessageResponse(BaseModel):
    message: str
