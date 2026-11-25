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
    subjective, objective, plan_header, *topics = text.splitlines()
    assert subjective.startswith("S:") and objective.startswith("O:") and plan_header == "P:"
    assert topics and all(topic.startswith("- ") for topic in topics)
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


def test_external_labs_generate_and_roundtrip(client, payload, monkeypatch):
    monkeypatch.setattr(get_settings(), "ai_enabled", False)
    labs = {"exam_date": "2026-11-10", "creatinina": 1.4, "ureia": 48, "ldl": 70,
            "ldl_target": 70, "hdl": 38, "hba1c": 7.0, "tsh": 4.6, "psa": 2.1, "eas_urina": "Sem hematúria"}
    visit = payload | {"lab_results": labs}
    generated = client.post("/visits/generate-soap", json=visit)
    assert generated.status_code == 200
    blocks = generated.json()
    expected = ("Exames laboratoriais externos (10/11/2026): Cr 1,4 mg/dL | Ur 48 mg/dL | LDL 70 mg/dL | "
                "HDL 38 mg/dL | HbA1c 7% | TSH 4,6 mUI/L | PSA 2,1 ng/mL | EAS: Sem hematúria.")
    assert expected in blocks["objective_text"]
    assert "Plaquetas" not in blocks["objective_text"] and not {"ldl", "creatinina"} & blocks["vitals_formatted"].keys()
    for topic in ("considerar indicação ou ajuste de estatina", "Revisar a meta individual de HbA1c",
                  "Comparar a creatinina", "interpretar o TSH"):
        assert any(line.startswith("- Sugestão para revisão médica:") and topic in line
                   for line in blocks["plan_text"].splitlines())

    saved = client.post("/visits/sync", json={"visits": [{
        "visit": visit, "soap_text": blocks["full_text_fallback"], "soap_blocks": blocks,
    }]})
    assert saved.status_code == 200
    reopened = client.get(f"/visits/{payload['id']}").json()
    assert all(reopened["visit"]["lab_results"][key] == value for key, value in labs.items())
    assert reopened["soap_blocks"] == blocks


@pytest.mark.parametrize("labs", [
    {"exam_date": "2026-02-30"}, {"exam_date": "2026-11-10T09:00:00"}, {"creatinina": "1.4"},
    {"ldl": -1}, {"ht": 101}, {"plaquetas": 1.5}, {"ldl_target": 0}, {"outros_exames": "x" * 321},
])
def test_external_labs_reject_invalid_input(client, payload, labs):
    assert client.post("/visits/generate-soap", json=payload | {"lab_results": labs}).status_code == 422


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
        "neuro_exam": {"mini_mental": {"score": 27, "education_years": 4}, "rankin": 4,
                       "directed_flags": ["Lúcido e orientado (LOTE)", "Pupilas isocóricas e fotorreagentes (PIFR)"],
                       "neuro_notes": "Sem outros achados ao exame dirigido."},
    }


def test_vitacare_team_timeline_medications_and_neuro(clinical_payload, client, monkeypatch):
    monkeypatch.setattr(get_settings(), "ai_enabled", False)
    result = client.post("/visits/generate-soap", json=clinical_payload)
    assert result.status_code == 200
    text = result.json()["full_text_fallback"]
    assert text.startswith("S: Realizada visita domiciliar acompanhado(a) da ACS Maria e do estudante João.")
    s, o, a, plan_header, *topics = text.splitlines()
    assert plan_header == "P:" and all(topic.startswith("- ") for topic in topics)
    assert "houve relato de internação hospitalar" in s
    assert "está em uso contínuo de Losartana 50 mg e metformina" in s
    assert "utilizou Ceftriaxona durante internação por pneumonia" in s
    assert "Ceftriaxona" not in a + " ".join(topics)
    assert "Rankin modificado 4, LOTE, PIFR" in o
    assert o.index("Ausculta pulmonar") < o.index("Exame neurológico:") < o.index("Exame abdominal")
    assert "Sem outros achados ao exame dirigido." in o
    saved = client.post("/visits/sync", json={"visits": [{"visit": clinical_payload, "soap_text": text}]}).json()["saved"][0]
    assert saved["visit"]["neuro_exam"]["mini_mental"]["score"] == 27
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
    assert "Rankin" not in text and "LOTE" not in text


def test_rankin_zero_and_empty_neuro(payload):
    text = deterministic_soap(VDInput(**(payload | {"neuro_exam": {"rankin": 0}}))).full_text_fallback
    assert "Rankin modificado 0" in text
    text = deterministic_soap(VDInput(**(payload | {"neuro_exam": {}}))).full_text_fallback
    assert "Exame neurológico" not in text


@pytest.mark.parametrize("change", [
    {"companions": {"is_solo": True, "has_acs": True}},
    {"companions": {"acs_name": "Maria"}},
    {"companions": {"has_acs": True, "acs_name": "M" * 81}},
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
    assert "**" not in text and "#" not in text
    assert all(line.startswith("- ") for line in text.split("\nP:\n")[1].splitlines())


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


@pytest.mark.parametrize("defect", [None, "opening", "medications", "neuro", "order", "non_list_plan"])
async def test_ai_obeys_vitacare_or_falls_back(clinical_payload, monkeypatch, defect):
    from types import SimpleNamespace
    import json
    monkeypatch.setattr(get_settings(), "ai_enabled", True)
    monkeypatch.setattr(get_settings(), "openai_api_key", "test")
    visit = VDInput(**(clinical_payload | {"lab_results": {"ldl": 142}}))
    fallback = deterministic_soap(visit)
    lines = [fallback.subjective_text, fallback.objective_text, fallback.assessment_text, fallback.plan_text]
    if defect == "opening":
        lines[0] = "Paciente avaliado."
    if defect == "medications":
        lines[0] = lines[0].replace("utilizou", "mantém uso contínuo de")
    if defect == "neuro":
        lines[1] = lines[1].replace("Rankin modificado 4", "Rankin modificado 3")
    if defect == "non_list_plan":
        lines[3] = lines[3].replace("- ", "", 1)
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
    assert data["neuro_exam"]["mini_mental"]["score"] == 27
    assert data["age"] == visit.age
    assert "clinical_analysis" in data
    assert "lab_results" not in data
    assert "Exames laboratoriais externos: LDL 142 mg/dL" in data["objective_required"]
    assert result.plan_text.count("considerar indicação ou ajuste de estatina") == 1


def test_advanced_clinical_input_roundtrip(client, payload, monkeypatch):
    from app.schemas import IvcfAnswers

    monkeypatch.setattr(get_settings(), "ai_enabled", False)
    domains = {"temporal": 4, "spatial": 5, "registration": 3, "attention": 3, "recall": 2, "language": 7}
    items = {key: [i < domains[key] for i in range(length)]
             for key, length in zip(domains, (5, 5, 3, 5, 3, 9))}
    positive = {"shopping", "finances", "housework", "bathing"}
    answers = {key: key in positive for key in IvcfAnswers.model_fields}
    updated = payload | {
        "complaints": ["Dor", "Tontura"],
        "intercurrence_details": {"Dor": "Lombalgia há dois dias.", "Tontura": "Ao levantar."},
        "vitals": {"systolic": 150, "diastolic": 90},
        "neuro_exam": {"mini_mental": {"score": 24, "education_level": "1_4",
            "domains": domains, "items": items, "attention_method": "serial_sevens"},
            "ivcf20": {"age_band": "75_84", "answers": answers, "comorbidities": ["polypharmacy"], "score": 15},
            "rankin": 4}}
    generated = client.post('/visits/generate-soap', json=updated)
    assert generated.status_code == 200
    blocks = generated.json()
    assert 'elevação significativa' in blocks['objective_text']
    assert 'MEEM) 24/30' in blocks['objective_text']
    assert 'IVCF-20: 15/40 — Idoso Frágil' in blocks['objective_text']
    assert 'Sugestão para revisão médica' in blocks['plan_text']
    assert 'avaliação cognitiva ampliada' in blocks['plan_text']
    assert blocks['plan_text'].count('revisão medicamentosa e acompanhamento multiprofissional') == 1
    assert all(line.startswith('- ') for line in blocks['plan_text'].splitlines())
    write = dict(visit=updated, soap_text=blocks['full_text_fallback'], soap_blocks=blocks)
    synced = client.post('/visits/sync', json={'visits': [write]})
    assert synced.status_code == 200
    saved = synced.json()['saved'][0]
    assert saved['visit']['intercurrence_details'] == updated['intercurrence_details']
    assert saved['visit']['neuro_exam']['mini_mental']['domains']['language'] == 7
    assert saved['visit']['neuro_exam']['mini_mental']['items'] == items
    assert saved['visit']['neuro_exam']['ivcf20'] == updated['neuro_exam']['ivcf20']
    assert saved['soap_blocks'] == blocks

    invalid = updated['neuro_exam'] | {'ivcf20': updated['neuro_exam']['ivcf20'] | {'score': 16}}
    assert client.post('/visits/generate-soap', json=updated | {'neuro_exam': invalid}).status_code == 422
    invalid = updated['neuro_exam'] | {'mini_mental': updated['neuro_exam']['mini_mental'] | {'items': items | {'recall': [True, True, True]}}}
    assert client.post('/visits/generate-soap', json=updated | {'neuro_exam': invalid}).status_code == 422


def test_nurse_name_other_condition_and_sex_roundtrip(client, payload, monkeypatch):
    monkeypatch.setattr(get_settings(), 'ai_enabled', False)
    data = payload | {'sex': 'Masculino', 'conditions': ['Outra'], 'other_condition': 'Doença de Parkinson',
        'companions': {'has_nurse': True, 'nurse_name': 'Ana'}}
    generated = client.post('/visits/generate-soap', json=data)
    assert generated.status_code == 200
    blocks = generated.json()
    assert 'enfermeiro(a)/técnico(a) Ana' in blocks['subjective_text']
    assert 'Em acompanhamento por Doença de Parkinson' in blocks['subjective_text']
    write = dict(visit=data, soap_text=blocks['full_text_fallback'], soap_blocks=blocks)
    assert client.post('/visits', json=write).status_code == 201
    saved = client.get(f"/visits/{data['id']}").json()['visit']
    assert saved['companions']['nurse_name'] == 'Ana'
    assert saved['other_condition'] == 'Doença de Parkinson'
    assert saved['sex'] == 'Masculino'
    assert client.post('/visits/generate-soap', json=data | {'companions': {'nurse_name': 'Ana'}}).status_code == 422
    assert client.post('/visits/generate-soap', json=data | {'conditions': ['Hipertenso']}).status_code == 422


def test_womens_health_and_geriatric_screening_roundtrip(client, payload, monkeypatch):
    monkeypatch.setattr(get_settings(), 'ai_enabled', False)
    data = payload | {'womens_health': {'cervical': {'status': 'Em dia', 'year': 2024}, 'mammography': {'status': 'Atrasado / Solicitar'}},
        'neuro_exam': {'geriatric_screening': {'flags': ['Perda de interesse nas atividades'], 'notes': 'Relato recente.'}}}
    response = client.post('/visits/generate-soap', json=data)
    assert response.status_code == 200
    blocks = response.json()
    assert 'Solicitar mamografia' in blocks['plan_text']
    assert not blocks['subjective_text'].startswith('S:')
    assert not blocks['objective_text'].startswith('O:')
    assert not blocks['plan_text'].startswith('P:')
    write = dict(visit=data, soap_text=blocks['full_text_fallback'], soap_blocks=blocks)
    response = client.post('/visits/sync', json={'visits': [write]})
    assert response.status_code == 200
    saved = response.json()['saved'][0]
    assert saved['visit']['womens_health']['cervical']['year'] == 2024
    assert saved['visit']['neuro_exam']['geriatric_screening']['notes'] == 'Relato recente.'
    assert client.get(f"/visits/{data['id']}").json()['soap_blocks'] == blocks


@pytest.mark.parametrize('legacy', ['Outro', 'Não informado', ''])
def test_legacy_sex_remains_unknown_without_assigning_a_value(payload, legacy):
    v = VDInput.model_validate(payload | {'sex': legacy})
    assert v.sex is None
    assert VDInput.model_validate(payload | {'sex': 'Masculino'}).sex == 'Masculino'
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        VDInput.model_validate(payload | {'sex': 'inventado'})


def test_feedback_receipt_and_retry(client):
    data = {"id": str(uuid4()), "message": "Melhorar a navegação."}
    for _ in range(2):
        result = client.post("/feedback", json=data)
        assert result.status_code == 201 and result.json() == {"id": data["id"]}
    assert client.post("/feedback", json={**data, "message": "Outra mensagem"}).status_code == 409
    assert client.post("/feedback", json={**data, "message": " "}).status_code == 422
