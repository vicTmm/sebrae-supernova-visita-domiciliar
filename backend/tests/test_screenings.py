import json
import re
from datetime import datetime
from types import SimpleNamespace
from uuid import uuid4
import pytest
from pydantic import ValidationError
from app.config import get_settings
from app.schemas import VDInput, SOAPNarrative, stored_visit, GeriatricFlag
from app.services.soap_generator import deterministic_soap, generate_soap, make_output


def visit(**changes):
    return VDInput.model_validate(dict(id=str(uuid4()), visited_at='2026-11-17T12:00:00Z',
        patient_code='TEST', age=65, sex='Feminino', conditions=['Outra']) | changes)


@pytest.mark.parametrize('key,label', [('cervical', 'citopatológico'), ('mammography', 'mamografia')])
@pytest.mark.parametrize('status', ['Em dia', 'Atrasado / Solicitar', 'Nunca realizou', 'Não se aplica'])
def test_screening_status_is_documented_without_invented_orders(key, label, status):
    output = deterministic_soap(visit(womens_health={key: {'status': status}}))
    assert label in output.subjective_text
    assert ('Solicitar' in output.plan_text) == (status == 'Atrasado / Solicitar')
    assert 'resultado normal' not in output.full_text_fallback
    if status == 'Atrasado / Solicitar':
        assert not output.plan_text.startswith('Conduta não registrada')
    for block in [output.subjective_text, output.objective_text, output.plan_text]:
        assert not re.match(r'^[SOAP]\s*:', block)


def test_both_orders_year_and_notes_are_preserved_once():
    v = visit(womens_health={'cervical': {'status': 'Atrasado / Solicitar', 'year': 2020, 'notes': 'Último resultado não disponível.'},
        'mammography': {'status': 'Atrasado / Solicitar', 'year': 2022}})
    output = deterministic_soap(v)
    assert '2020' in output.subjective_text and '2022' in output.subjective_text
    assert 'Último resultado não disponível' in output.subjective_text
    assert output.plan_text.count('Solicitar exame citopatológico') == 1
    assert output.plan_text.count('Solicitar mamografia') == 1
    again = make_output(v, output.subjective_text, output.objective_text, output.plan_text, 'ai')
    assert again.plan_text == output.plan_text


@pytest.mark.parametrize('changes', [
    {'sex': 'Masculino', 'womens_health': {}},
    {'womens_health': {'cervical': {'status': 'inventado'}}},
    {'womens_health': {'mammography': {'year': datetime.now().year + 1}}},
    {'womens_health': {'cervical': {'status': 'Nunca realizou', 'year': 2020}}},
    {'womens_health': {'mammography': {'notes': 'x' * 501}}},
    {'neuro_exam': {'geriatric_screening': {'flags': ['inventado']}}},
    {'neuro_exam': {'geriatric_screening': {'flags': [GeriatricFlag.MOOD, GeriatricFlag.MOOD]}}},
])
def test_validation(changes):
    with pytest.raises(ValidationError):
        visit(**changes)


def test_blank_or_unassessed_does_not_create_screenings_or_geriatric_negatives():
    output = deterministic_soap(visit(womens_health={}, neuro_exam={'geriatric_screening': {}}))
    assert 'mamografia' not in output.full_text_fallback
    assert 'citopatológico' not in output.full_text_fallback
    assert 'rastreio geriátrico' not in output.full_text_fallback
    assert 'depressão' not in output.full_text_fallback


def test_geriatric_module_is_independent_of_cognitive_and_functional_tests():
    output = deterministic_soap(visit(neuro_exam={'geriatric_screening': {'flags': [GeriatricFlag.MOOD, GeriatricFlag.MEMORY], 'notes': 'Relato da cuidadora há seis meses.'}}))
    assert 'humor deprimido' in output.subjective_text
    assert 'esquecimento progressivo' in output.subjective_text
    assert 'Relato da cuidadora há seis meses' in output.subjective_text
    assert 'MEEM' not in output.objective_text and 'Rankin' not in output.objective_text
    assert output.assessment_text is None
    rankin = deterministic_soap(visit(neuro_exam={'rankin': 0}))
    assert 'Rankin modificado 0' in rankin.objective_text
    assert 'rastreio geriátrico' not in rankin.subjective_text


def test_output_strips_repeated_prefixes_and_retains_full_copy_headers():
    output = make_output(visit(assessment='A: Observação escrita.'), '**S:** S: História.', 'O: Exame.', 'P: Plano.', 'ai')
    assert output.subjective_text == 'História.'
    assert output.objective_text == 'Exame.'
    assert output.plan_text == 'Plano.'
    assert output.assessment_text == 'Observação escrita.'
    assert output.full_text_fallback.splitlines() == ['S: História.', 'O: Exame.', 'A: Observação escrita.', 'P: Plano.']


@pytest.mark.parametrize('omit', [False, True])
async def test_ai_receives_screening_context_and_cannot_omit_history(monkeypatch, omit):
    monkeypatch.setattr(get_settings(), 'ai_enabled', True)
    monkeypatch.setattr(get_settings(), 'openai_api_key', 'test')
    v = visit(womens_health={'mammography': {'status': 'Atrasado / Solicitar'}},
        neuro_exam={'geriatric_screening': {'flags': [GeriatricFlag.INTEREST]}})
    fallback = deterministic_soap(v)
    captured = {}
    class Client:
        def __init__(self, **kwargs): self.responses = self
        async def __aenter__(self): return self
        async def __aexit__(self, *args): return False
        async def parse(self, **kwargs):
            captured.update(json.loads(kwargs['input']))
            return SimpleNamespace(output_parsed=SOAPNarrative(subjective_text='S: ' + (fallback.subjective_text.replace('Relata rastreio por mamografia em atraso, com solicitação indicada nesta visita.', '') if omit else fallback.subjective_text),
                objective_text='O: ' + fallback.objective_text, plan_text='P: Plano revisado.', assessment_text=None))
    monkeypatch.setattr('app.services.soap_generator.AsyncOpenAI', Client)
    output = await generate_soap(v)
    assert output.source == ('deterministic' if omit else 'ai')
    assert captured['sex'] == 'Feminino' and captured['womens_health']['mammography']['status'] == 'Atrasado / Solicitar'
    assert captured['preventive_history_required'] and captured['preventive_plan_required']
    assert output.plan_text.count('Solicitar mamografia') == 1
    assert 'perda de interesse' in output.subjective_text
    assert not output.subjective_text.startswith('S:')


def test_stored_neuro_fields_retired_without_mutating_original_payload():
    raw = visit(neuro_exam={'rankin': 4}).model_dump(mode='json')
    raw['neuro_exam']['retired_test'] = {'score': 15}
    parsed = stored_visit(raw)
    assert 'retired_test' not in parsed.neuro_exam.model_dump()
    assert raw['neuro_exam']['retired_test'] == {'score': 15}
