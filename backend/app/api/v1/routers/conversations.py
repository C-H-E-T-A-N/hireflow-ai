from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models.conversation import Conversation
from app.schemas.common import ListResponse
from app.schemas.voice import ConversationListItem, ConversationRead
from app.services import dashboard_service

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=ListResponse[ConversationListItem])
def list_conversations(
    channel: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> ListResponse[ConversationListItem]:
    rows = dashboard_service.list_conversations(db, limit=limit, channel=channel)
    items = [
        ConversationListItem(
            **ConversationListItem.model_validate(row).model_dump(exclude={"turn_count"}),
            turn_count=len(row.turns),
        )
        for row in rows
    ]
    return ListResponse(items=items, total=len(items))


@router.get("/{conversation_id}", response_model=ConversationRead)
def get_conversation(conversation_id: str, db: Session = Depends(get_db)) -> ConversationRead:
    conversation = db.get(Conversation, conversation_id)
    if conversation is None:
        raise NotFoundError(f"Conversation {conversation_id} was not found.")
    return ConversationRead.model_validate(conversation)
