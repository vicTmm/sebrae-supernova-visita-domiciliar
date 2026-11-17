from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_session
from ..models import Visit
from ..schemas import stored_visit, VDInput, SOAPOutput, VisitWrite, VisitOutput, SyncRequest, SyncOutput
from ..services.soap_generator import generate_soap

router = APIRouter(prefix="/visits", tags=["visits"])


def output(row: Visit) -> VisitOutput:
    return VisitOutput(visit=stored_visit(row.payload), soap_text=row.soap_text, soap_blocks=row.soap_blocks, revision=row.revision)


async def save(session: AsyncSession, data: VisitWrite):
    row = await session.get(Visit, str(data.visit.id))
    payload = data.visit.model_dump(mode="json")
    blocks = data.soap_blocks.model_dump(mode="json") if data.soap_blocks else None
    if row:
        if (stored_visit(row.payload).model_dump(mode="json") == payload
                and row.soap_text == data.soap_text and row.soap_blocks == blocks):
            return output(row), False  # Reenvio após perda da resposta: idempotente.
        if row.revision != data.base_revision:
            return output(row), True
        row.payload, row.soap_text = payload, data.soap_text
        row.soap_blocks = blocks
        row.visited_at = data.visit.visited_at.astimezone(timezone.utc).isoformat()
        row.revision += 1
    else:
        if data.base_revision != 0:
            raise HTTPException(409, "Visita removida no servidor; salve como nova visita.")
        row = Visit(id=str(data.visit.id), payload=payload, soap_text=data.soap_text, soap_blocks=blocks,
                    visited_at=data.visit.visited_at.astimezone(timezone.utc).isoformat(), revision=1)
        session.add(row)
    await session.flush()
    return output(row), False


@router.post("/generate-soap", response_model=SOAPOutput)
async def soap(visit: VDInput):
    return await generate_soap(visit)


@router.post("/sync", response_model=SyncOutput)
async def sync(data: SyncRequest, session: AsyncSession = Depends(get_session)):
    saved, conflicts = [], []
    # Serializa escritores SQLite: evita perder edições concorrentes.
    await session.execute(text("BEGIN IMMEDIATE"))
    for item in data.visits:
        result, conflict = await save(session, item)
        (conflicts if conflict else saved).append(result)
    await session.commit()
    return SyncOutput(saved=saved, conflicts=conflicts)


@router.get("", response_model=list[VisitOutput])
async def list_visits(day: date | None = None, offset_minutes: int = Query(default=-180, ge=-720, le=840),
                      limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0),
                      session: AsyncSession = Depends(get_session)):
    query = select(Visit)
    if day:
        start = datetime.combine(day, time(), tzinfo=timezone(timedelta(minutes=offset_minutes))).astimezone(timezone.utc)
        query = query.where(Visit.visited_at >= start.isoformat(), Visit.visited_at < (start + timedelta(days=1)).isoformat())
    rows = await session.scalars(query.order_by(Visit.visited_at.desc()).offset(offset).limit(limit))
    return [output(row) for row in rows]


@router.get("/{visit_id}", response_model=VisitOutput)
async def get_visit(visit_id: UUID, session: AsyncSession = Depends(get_session)):
    row = await session.get(Visit, str(visit_id))
    if not row:
        raise HTTPException(404, "Visita não encontrada")
    return output(row)


@router.post("", response_model=VisitOutput, status_code=201)
@router.put("", response_model=VisitOutput)
async def write_visit(data: VisitWrite, session: AsyncSession = Depends(get_session)):
    await session.execute(text("BEGIN IMMEDIATE"))
    result, conflict = await save(session, data)
    if conflict:
        raise HTTPException(409, "Conflito de revisão; recupere a versão atual antes de editar.")
    await session.commit()
    return result


@router.delete("/{visit_id}", status_code=204)
async def delete_visit(visit_id: UUID, revision: int = Query(ge=1), session: AsyncSession = Depends(get_session)):
    await session.execute(text("BEGIN IMMEDIATE"))
    row = await session.get(Visit, str(visit_id))
    if not row:
        raise HTTPException(404, "Visita não encontrada")
    if row.revision != revision:
        raise HTTPException(409, "Conflito de revisão")
    await session.delete(row)
    await session.commit()
    return Response(status_code=204)
