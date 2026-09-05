from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.analytics import AnalyticsResponse, DashboardResponse
from app.services import dashboard_service

router = APIRouter(tags=["insights"])


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(db: Session = Depends(get_db)) -> DashboardResponse:
    """Everything the recruiter home screen needs, in one round trip."""
    return DashboardResponse(**dashboard_service.build_dashboard(db))


@router.get("/analytics", response_model=AnalyticsResponse)
def analytics(
    days: int = Query(default=30, ge=7, le=365), db: Session = Depends(get_db)
) -> AnalyticsResponse:
    return AnalyticsResponse(**dashboard_service.build_analytics(db, days=days))
