import json
from uuid import uuid4
import pytest
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine
from app.database import ensure_schema
from app.schemas import VDInput
from app.services.soap_generator import deterministic_soap, full_text


@pytest.fixture
def visit_data():
    return {"id": str(uuid4()), "visited_at": "2026-11-17T10:00:00-03:00", "patient_code": "EX",
        "age": 78, "sex": "Feminino", "visit_reason": "Avaliação após alta da UPA", "conditions": ["Hipertenso"],
        "companions": {"has_acs": True, "acs_name": "Maria", "has_student": True, "student_name": "João"},
        "complaints": ["Ida à UPA/Emergência", "Dispneia"],
        "intercurrence_details": "Atendida na UPA por dispneia há dois dias; recebeu medicação e teve alta.",
        "subjective_notes": "Cuidadora relata melhora hoje.", "adherence": "Regular",
        "recent_medications": "Antibiótico durante a internação, já concluído",
        "medications_in_use": "Losartana conforme receita apresentada",
        "vitals": {"systolic": 150, "diastolic": 90, "heart_rate": 65, "respiratory_rate": 17,
                   "oxygen_saturation": 95, "temperature": 36, "glucose": 123},
        "vitals_context": "Aferição em repouso; sem meta individual registrada nesta visita.",
        "exam": {"general": {"status": "Sem alterações"}, "cardiovascular": {"status": "Sem alterações"},
                 "respiratory": {"status": "Alterado", "notes": "Estertores em base direita."}},
        "neuro_exam": {"mini_mental": {"score": 27, "education_years": 4}, "rankin": 4},
        "actions": ["Manutenção de receita", "Agendamento de retorno VD"], "plan_notes": "Retorno VD em 30 dias.",
        "follow_up_owner": "ACS Maria"}


def test_narrative_and_separate_vitals(visit_data):
    result = deterministic_soap(VDInput(**visit_data))
    assert result.vitals_formatted == {"PAS": "150", "PAD": "90", "SatO2": "95%", "FC": "65", "FR": "17", "Tax": "36 °C", "HGT": "123"}
    assert "ACS Maria e do estudante João" in result.subjective_text
    assert "Motivo do atendimento: Avaliação após alta da UPA" in result.subjective_text
    assert "Desde a última visita" not in result.subjective_text
    assert visit_data["intercurrence_details"] in result.subjective_text
    assert "utilizou Antibiótico" in result.subjective_text and "em uso contínuo de Losartana" in result.subjective_text
    assert "Adesão medicamentosa:" not in result.subjective_text
    assert result.assessment_text is None and "\nA:" not in result.full_text_fallback
    assert "PA 150/90 mmHg: elevação significativa" in result.objective_text
    assert "95%" not in result.objective_text
    assert "Estertores em base direita" in result.objective_text
    assert "Mini-Mental (MEEM) 27/30 (escolaridade: 4 anos completos)" in result.objective_text
    assert result.plan_text.splitlines()[:4] == [
        "- Mantenho a receita em uso.", "- Indico retorno em visita domiciliar.", "- Retorno VD em 30 dias.",
        "- Responsável pelo seguimento: ACS Maria."
    ]
    assert "Antibiótico" not in result.plan_text
    assert "normal" not in result.full_text_fallback.lower()
    assert "Sinais vitais: PAS 150 mmHg, PAD 90 mmHg" in result.full_text_fallback


def test_assessment_only_when_written(visit_data):
    visit_data["assessment"] = "Reavaliação clínica após alta da UPA."
    result = deterministic_soap(VDInput(**visit_data))
    assert result.assessment_text == visit_data["assessment"]
    assert f"A: {visit_data['assessment']}" in result.full_text_fallback


@pytest.mark.parametrize("score,years", [(0, 0), (27, 4), (30, None)])
def test_mini_mental_records_without_inferred_diagnosis(visit_data, score, years):
    visit_data["neuro_exam"] = {"mini_mental": {"score": score, "education_years": years}}
    result = deterministic_soap(VDInput(**visit_data))
    assert f"MEEM) {score}/30" in result.objective_text
    assert result.assessment_text is None
    assert "diagnóstico de demência" not in result.full_text_fallback.lower()
    if years is not None and score == 0:
        assert "Sugestão para revisão médica" in result.plan_text


@pytest.mark.parametrize("mini", [{"score": -1}, {"score": 31}, {"score": 2.5}, {"score": True}, {"education_years": 4}, {"score": 27, "education_years": -1}])
def test_mini_mental_validation(visit_data, mini):
    from pydantic import ValidationError
    visit_data["neuro_exam"] = {"mini_mental": mini}
    with pytest.raises(ValidationError):
        VDInput(**visit_data)


def test_intercurrence_details_need_context(visit_data):
    from pydantic import ValidationError
    visit_data["complaints"] = ["Sem intercorrências"]
    with pytest.raises(ValidationError):
        VDInput(**visit_data)


def test_reviewed_blocks_roundtrip_and_idempotence(visit_data, tmp_path):
    from fastapi.testclient import TestClient
    from sqlalchemy.ext.asyncio import async_sessionmaker
    from app.main import app
    from app.database import get_session
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'blocks.db'}")
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    async def session_override():
        async with engine.begin() as conn:
            await conn.run_sync(ensure_schema)
        async with sessions() as session:
            yield session

    app.dependency_overrides[get_session] = session_override
    client = TestClient(app)
    try:
        blocks = deterministic_soap(VDInput(**visit_data)).model_dump()
        blocks.update(subjective_text="História revisada pelo médico.", plan_text="Conduta revisada pelo médico.")
        blocks["full_text_fallback"] = full_text(blocks["subjective_text"], blocks["objective_text"], blocks["vitals_formatted"], blocks["plan_text"], blocks["assessment_text"], blocks["vitals_context"])
        write = {"visit": visit_data, "soap_text": blocks["full_text_fallback"], "soap_blocks": blocks}
        for _ in range(2):
            response = client.post('/visits/sync', json={"visits": [write]})
            assert response.status_code == 200
            assert response.json()["saved"][0]["revision"] == 1
        saved = client.get(f"/visits/{visit_data['id']}").json()
        assert saved["soap_blocks"] == blocks
        assert saved["soap_text"] == blocks["full_text_fallback"]
        assert client.post('/visits', json=write | {"soap_text": "Texto divergente"}).status_code == 422
    finally:
        client.close()
        app.dependency_overrides.clear()


async def test_bootstrap_migrates_legacy_sqlite_without_rewriting(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'legacy.db'}")
    async with engine.begin() as conn:
        await conn.execute(text('CREATE TABLE visits (id VARCHAR(36) PRIMARY KEY, visited_at VARCHAR(40), payload JSON, soap_text TEXT, revision INTEGER)'))
        await conn.execute(text('INSERT INTO visits VALUES (:id, :date, :payload, :soap, 1)'), {"id": str(uuid4()), "date": "2026-11-17", "payload": json.dumps({"legacy": True}), "soap": "Texto revisado antigo"})
        await conn.run_sync(ensure_schema)
        await conn.run_sync(ensure_schema)
        columns = await conn.run_sync(lambda sync: {c['name'] for c in inspect(sync).get_columns('visits')})
        assert 'soap_blocks' in columns
        row = (await conn.execute(text('SELECT soap_text, soap_blocks FROM visits'))).one()
        assert row.soap_text == 'Texto revisado antigo' and row.soap_blocks is None
    await engine.dispose()
