from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.main import app
from app.database import Base, get_session
from app.config import get_settings
from app.schemas import VDInput
from app.services.soap_generator import deterministic_soap, generate_soap
from app.schemas import SOAPNarrative


@pytest.fixture
def payload():
    return {"id": str(uuid4()), "visited_at": "2026-11-16T14:00:00-03:00", "patient_code": "AB",
            "age": 78, "sex": "Feminino", "conditions": ["Acamado", "Hipertenso", "Diabético"],
            "complaints": ["Sem intercorrências"], "adherence": "Regular",
            "vitals": {"systolic": 130, "diastolic": 80, "glucose": 145},
            "actions": ["Orientações gerais"], "plan_notes": "Orientada mudança de decúbito conforme plano da equipe."}


@pytest.fixture
def client(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'test.db'}")
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    async def override():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            yield session

    app.dependency_overrides[get_session] = override
    # O lifespan de produção não é iniciado; o teste usa apenas banco temporário.
    c = TestClient(app)
    yield c
    c.close()
    app.dependency_overrides.clear()


def test_deterministic_soap(payload):
    text = deterministic_soap(VDInput(**payload)).full_text_fallback
    assert [line[:2] for line in text.splitlines()] == ["S:", "O:", "P:"]
    assert "PAS 130 mmHg" in text and "HGT 145 mg/dL" in text
    assert "Exame físico não registrado." in text
    assert "A:" not in text
    assert "AB" not in text and "estável" not in text


def test_generate_and_crud(client, payload, monkeypatch):
    monkeypatch.setattr(get_settings(), "ai_enabled", False)
    generated = client.post("/visits/generate-soap", json=payload)
    assert generated.status_code == 200
    assert generated.json()["source"] == "deterministic"
    data = {"visit": payload, "soap_text": generated.json()["full_text_fallback"]}
    saved = client.post("/visits", json=data)
    assert saved.status_code == 201 and saved.json()["revision"] == 1
    assert client.get(f"/visits/{payload['id']}").status_code == 200
    assert len(client.get("/visits?day=2026-11-16").json()) == 1
    assert client.get("/visits?day=2026-11-17").json() == []
    data["base_revision"] = 1
    data["soap_text"] += " Revisado."
    assert client.put("/visits", json=data).json()["revision"] == 2
    assert client.delete(f"/visits/{payload['id']}?revision=1").status_code == 409
    assert client.delete(f"/visits/{payload['id']}?revision=2").status_code == 204
    assert client.get(f"/visits/{payload['id']}").status_code == 404
    assert client.get("/health").json() == {"status": "ok"}


def test_sync_idempotent_and_conflict(client, payload):
    data = {"visit": payload, "soap_text": "S: relato\nO: exame\nA: avaliação\nP: plano"}
    for _ in range(2):
        result = client.post("/visits/sync", json={"visits": [data]})
        assert result.status_code == 200
        assert result.json()["saved"][0]["revision"] == 1
    assert len(client.get("/visits").json()) == 1
    data["soap_text"] += " editado"
    conflict = client.post("/visits/sync", json={"visits": [data]}).json()
    assert len(conflict["conflicts"]) == 1 and not conflict["saved"]
    data["base_revision"] = 1
    assert client.post("/visits/sync", json={"visits": [data]}).json()["saved"][0]["revision"] == 2


@pytest.mark.parametrize("change", [
    {"vitals": {"oxygen_saturation": 101}}, {"vitals": {"systolic": 120}},
    {"vitals": {"systolic": 80, "diastolic": 120}}, {"age": -1},
    {"complaints": ["Sem intercorrências", "Dor"]},
    {"exam": {"respiratory": {"status": "Alterado", "notes": ""}}},
    {"visited_at": "2026-11-16T14:00:00"}, {"conditions": ["inventado"]},
])
def test_validation(client, payload, change):
    assert client.post("/visits/generate-soap", json=payload | change).status_code == 422


async def test_provider_failure_falls_back(payload, monkeypatch):
    monkeypatch.setattr(get_settings(), "ai_enabled", True)
    monkeypatch.setattr(get_settings(), "openai_api_key", "test")

    def fail(**kwargs):
        raise RuntimeError("Provider unavailable")

    monkeypatch.setattr("app.services.soap_generator.AsyncOpenAI", fail)
    result = await generate_soap(VDInput(**payload))
    assert result == deterministic_soap(VDInput(**payload))


@pytest.fixture
def clinical_payload(payload):
    return payload | {
        "companions": {"has_acs": True, "acs_name": "Maria", "has_student": True, "student_name": "João"},
        "complaints": ["Internação hospitalar"],
        "assessment": "Seguimento após internação por pneumonia.",
        "exam": {"cardiovascular": {"status": "Sem alterações"}, "respiratory": {"status": "Sem alterações"}, "abdomen": {"status": "Sem alterações"}},
        "subjective_notes": "Houve internação por pneumonia desde a última VD.",
        "medications_in_use": "Losartana 50 mg e metformina conforme receita apresentada",
        "recent_medications": "Ceftriaxona durante internação por pneumonia",
        "neuro_exam": {"glasgow": {"eye": 4, "verbal": 5, "motor": 6, "total": 15}, "rankin": 4,
                       "directed_flags": ["Lúcido e orientado (LOTE)", "Pupilas isocóricas e fotorreagentes (PIFR)"],
                       "neuro_notes": "Sem outros achados ao exame dirigido."},
    }


def test_vitacare_team_timeline_medications_and_neuro(clinical_payload, client, monkeypatch):
    monkeypatch.setattr(get_settings(), "ai_enabled", False)
    result = client.post("/visits/generate-soap", json=clinical_payload)
    assert result.status_code == 200
    text = result.json()["full_text_fallback"]
    assert text.startswith("S: Realizada visita domiciliar acompanhado(a) da ACS Maria e do estudante João.")
    s, o, a, p = text.splitlines()
    assert "houve relato de internação hospitalar" in s
    assert "está em uso contínuo de Losartana 50 mg e metformina" in s
    assert "utilizou Ceftriaxona durante internação por pneumonia" in s
    assert "Ceftriaxona" not in a + p
    assert "Exame neurológico: Glasgow 15/15 (O4 V5 M6), Rankin modificado 4, LOTE, PIFR" in o
    assert o.index("Ausculta pulmonar") < o.index("Exame neurológico:") < o.index("Exame abdominal")
    assert "Sem outros achados ao exame dirigido." in o
    saved = client.post("/visits/sync", json={"visits": [{"visit": clinical_payload, "soap_text": text}]}).json()["saved"][0]
    assert saved["visit"]["neuro_exam"]["glasgow"]["total"] == 15
    assert saved["visit"]["companions"]["acs_name"] == "Maria"
    assert saved["visit"]["recent_medications"] == clinical_payload["recent_medications"]


@pytest.mark.parametrize("companions,expected", [
    ({"is_solo": True}, "Realizada visita domiciliar sem acompanhantes da equipe."),
    ({}, "Realizada visita domiciliar. Acompanhantes da equipe não informados."),
    ({"has_nurse": True}, "Realizada visita domiciliar acompanhado(a) de enfermeiro(a)/técnico(a)."),
    ({"has_acs": True}, "Realizada visita domiciliar acompanhado(a) de ACS (nome não informado)."),
])
def test_team_opening(payload, companions, expected):
    text = deterministic_soap(VDInput(**(payload | {"companions": companions}))).full_text_fallback
    assert text.startswith(f"S: {expected}")
    assert "não foram relatadas intercorrências" in text
    assert "Glasgow" not in text and "Rankin" not in text and "LOTE" not in text


def test_rankin_zero_and_empty_neuro(payload):
    text = deterministic_soap(VDInput(**(payload | {"neuro_exam": {"rankin": 0}}))).full_text_fallback
    assert "Rankin modificado 0" in text and "Glasgow" not in text
    text = deterministic_soap(VDInput(**(payload | {"neuro_exam": {}}))).full_text_fallback
    assert "Exame neurológico" not in text


@pytest.mark.parametrize("eye,verbal,motor,total", [(1, 1, 1, 3), (2, 3, 4, 9), (4, 5, 6, 15)])
def test_glasgow_components(payload, eye, verbal, motor, total):
    visit = VDInput(**(payload | {"neuro_exam": {"glasgow": dict(eye=eye, verbal=verbal, motor=motor, total=total)}}))
    assert f"Glasgow {total}/15 (O{eye} V{verbal} M{motor})" in deterministic_soap(visit).full_text_fallback


@pytest.mark.parametrize("change", [
    {"companions": {"is_solo": True, "has_acs": True}},
    {"companions": {"acs_name": "Maria"}},
    {"companions": {"has_acs": True, "acs_name": "M" * 81}},
    {"neuro_exam": {"glasgow": {"eye": 4, "verbal": 5, "motor": 6, "total": 14}}},
    {"neuro_exam": {"glasgow": {"eye": 0, "verbal": 5, "motor": 6, "total": 11}}},
    {"neuro_exam": {"glasgow": {"eye": 4, "verbal": 6, "motor": 6, "total": 16}}},
    {"neuro_exam": {"glasgow": {"eye": 4, "verbal": 5, "motor": 7, "total": 16}}},
    {"neuro_exam": {"glasgow": {"eye": 4, "verbal": 5}}},
    {"neuro_exam": {"glasgow": {"eye": None, "verbal": 5, "motor": 6, "total": None}}},
    {"neuro_exam": {"glasgow": {"eye": True, "verbal": 5, "motor": 6, "total": 12}}},
    {"neuro_exam": {"rankin": -1}}, {"neuro_exam": {"rankin": 6}},
    {"neuro_exam": {"rankin": 2.5}},
    {"neuro_exam": {"directed_flags": ["LOTE inventado"]}},
    {"neuro_exam": {"directed_flags": ["Déficit motor focal", "Déficit motor focal"]}},
    {"neuro_exam": {"directed_flags": ["Força muscular preservada e simétrica", "Déficit motor focal"]}},
    {"medications_in_use": "x" * 1001}, {"recent_medications": "x" * 1001},
])
def test_new_clinical_validation(client, payload, change):
    assert client.post("/visits/generate-soap", json=payload | change).status_code == 422


def test_plain_text_and_unknown_timeline(payload):
    text = deterministic_soap(VDInput(**(payload | {"complaints": [], "subjective_notes": "**Relato**\n# sem formatação"}))).full_text_fallback
    assert "Não foi informado como transcorreu o período" in text
    assert "Sem intercorrências" not in text
    assert "**" not in text and "#" not in text and len(text.splitlines()) == 3


def test_legacy_medications(payload, client, tmp_path):
    import json
    import sqlite3
    legacy = payload | {"medications": "Losartana conforme receita"}
    client.get("/visits")  # cria banco temporário
    with sqlite3.connect(tmp_path / "test.db") as conn:
        conn.execute("INSERT INTO visits (id, visited_at, payload, soap_text, revision) VALUES (?, ?, ?, ?, ?)",
                     (legacy["id"], "2026-11-16T17:00:00+00:00", json.dumps(legacy), "SOAP revisado antigo", 1))
    saved = client.get(f"/visits/{legacy['id']}").json()
    assert saved["visit"]["medications_in_use"] == "Losartana conforme receita"
    assert "medications" not in saved["visit"]
    assert not saved["visit"]["companions"]["is_solo"]
    assert saved["soap_text"] == "SOAP revisado antigo"
    # Reenvio do dispositivo já migrado não deve criar conflito ou nova revisão.
    result = client.post("/visits/sync", json={"visits": [{"visit": saved["visit"], "soap_text": saved["soap_text"], "base_revision": 0}]}).json()
    assert not result["conflicts"] and result["saved"][0]["revision"] == 1


@pytest.mark.parametrize("defect", [None, "opening", "medications", "neuro", "order"])
async def test_ai_obeys_vitacare_or_falls_back(clinical_payload, monkeypatch, defect):
    from types import SimpleNamespace
    import json
    monkeypatch.setattr(get_settings(), "ai_enabled", True)
    monkeypatch.setattr(get_settings(), "openai_api_key", "test")
    visit = VDInput(**clinical_payload)
    fallback = deterministic_soap(visit)
    lines = [fallback.subjective_text, fallback.objective_text, fallback.assessment_text, fallback.plan_text]
    if defect == "opening":
        lines[0] = "Paciente avaliado."
    if defect == "medications":
        lines[0] = lines[0].replace("utilizou", "mantém uso contínuo de")
    if defect == "neuro":
        lines[1] = lines[1].replace("Glasgow 15/15", "Glasgow 14/15")
    if defect == "order":
        parts = lines[1].split(". ")
        neuro_index = next(i for i, p in enumerate(parts) if p.startswith("Exame neurológico:"))
        parts.insert(0, parts.pop(neuro_index))
        lines[1] = ". ".join(parts)
    captured = {}

    class FakeClient:
        def __init__(self, **kwargs):
            self.responses = self

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def parse(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(output_parsed=SOAPNarrative(subjective_text=lines[0],
                objective_text=lines[1], assessment_text=lines[2], plan_text=lines[3]))

    monkeypatch.setattr("app.services.soap_generator.AsyncOpenAI", FakeClient)
    result = await generate_soap(visit)
    assert result.source == ("ai" if defect is None else "deterministic")
    assert result.full_text_fallback == fallback.full_text_fallback
    data = json.loads(captured["input"])
    assert "patient_code" not in data
    assert "subjective_opening" in data and "objective_required" in data
    assert data["neuro_exam"]["glasgow"]["total"] == 15
    assert data["age"] == visit.age
    assert "clinical_analysis" in data


def test_advanced_clinical_input_roundtrip(client, payload, monkeypatch):
    monkeypatch.setattr(get_settings(), "ai_enabled", False)
    updated = payload | {
        "complaints": ["Dor", "Tontura"],
        "intercurrence_details": {"Dor": "Lombalgia há dois dias.", "Tontura": "Ao levantar."},
        "vitals": {"systolic": 150, "diastolic": 90},
        "neuro_exam": {"mini_mental": {"score": 24, "education_level": "1_4",
            "domains": {"temporal": 4, "spatial": 5, "registration": 3, "attention": 3, "recall": 2, "language": 7}}, "rankin": 4}}
    generated = client.post('/visits/generate-soap', json=updated)
    assert generated.status_code == 200
    blocks = generated.json()
    assert 'elevação significativa' in blocks['objective_text']
    assert 'MEEM) 24/30' in blocks['objective_text']
    assert 'Sugestões para revisão médica' in blocks['plan_text']
    assert 'avaliação cognitiva ampliada' in blocks['plan_text']
    write = dict(visit=updated, soap_text=blocks['full_text_fallback'], soap_blocks=blocks)
    synced = client.post('/visits/sync', json={'visits': [write]})
    assert synced.status_code == 200
    saved = synced.json()['saved'][0]
    assert saved['visit']['intercurrence_details'] == updated['intercurrence_details']
    assert saved['visit']['neuro_exam']['mini_mental']['domains']['language'] == 7
    assert saved['soap_blocks'] == blocks
