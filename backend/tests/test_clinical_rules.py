import json
from pathlib import Path
from uuid import uuid4
import pytest
from pydantic import ValidationError
from app.schemas import VDInput
from app.services.clinical_rules import clinical_analysis
from app.services.soap_generator import deterministic_soap


def visit(**changes):
    return VDInput.model_validate(dict(id=str(uuid4()), visited_at='2026-11-17T12:00:00Z',
        patient_code='TEST', age=78, sex='Feminino', conditions=['Hipertenso']) | changes)


@pytest.mark.parametrize('conditions,vitals,codes', [
    (['Outra'], {'systolic': 139, 'diastolic': 89}, []),
    (['Outra'], {'systolic': 140, 'diastolic': 89}, ['bp_monitor']),
    (['Outra'], {'systolic': 139, 'diastolic': 90}, ['bp_monitor']),
    (['Hipertenso'], {'systolic': 149, 'diastolic': 94}, ['bp_monitor']),
    (['Hipertenso'], {'systolic': 150, 'diastolic': 90}, ['bp_uncontrolled']),
    (['Hipertenso'], {'systolic': 140, 'diastolic': 95}, ['bp_uncontrolled']),
    (['Hipertenso'], {'systolic': 180, 'diastolic': 90}, ['bp_severe']),
    (['Outra'], {'oxygen_saturation': 95}, []),
    (['Outra'], {'oxygen_saturation': 94.9}, ['oxygen_low']),
    (['DPOC/pneumopata'], {'oxygen_saturation': 92}, []),
    (['DPOC/pneumopata'], {'oxygen_saturation': 91.9}, ['oxygen_low']),
    (['Diabético'], {'glucose': 69}, ['glucose_low']),
    (['Diabético'], {'glucose': 70}, []),
    (['Diabético'], {'glucose': 180}, []),
    (['Diabético'], {'glucose': 181}, ['glucose_high']),
    (['Outra'], {'glucose': 200}, []),
    (['Outra'], {'glucose': 201}, ['glucose_high']),
    (['Outra'], {'heart_rate': 50, 'respiratory_rate': 20, 'temperature': 37.7}, []),
    (['Outra'], {'heart_rate': 49}, ['bradicardia']),
    (['Outra'], {'heart_rate': 100}, []),
    (['Outra'], {'heart_rate': 101, 'respiratory_rate': 21, 'temperature': 37.8}, ['taquicardia', 'taquipneia', 'fever']),
])
def test_reference_boundaries(conditions, vitals, codes):
    data = visit().model_dump() | dict(conditions=conditions, vitals=vitals)
    assert [a['code'] for a in clinical_analysis(VDInput.model_validate(data))] == codes


@pytest.mark.parametrize('level,cutoff', [('none', 20), ('1_4', 25), ('5_8', 26), ('over_8', 28)])
def test_cognitive_cutoffs(level, cutoff):
    for score in [cutoff - 1, cutoff, cutoff + 1]:
        v = visit(neuro_exam={'mini_mental': {'score': score, 'education_level': level}})
        result = deterministic_soap(v)
        assert ('cognition' in [a['code'] for a in clinical_analysis(v)]) == (score < cutoff)
        assert f'corte {cutoff}' in result.objective_text
        assert result.assessment_text is None
        assert ('avaliação cognitiva ampliada' in result.plan_text) == (score < cutoff)


def test_domains_total_and_no_automatic_zero():
    domains = dict(temporal=4, spatial=5, registration=3, attention=3, recall=2, language=7)
    v = visit(neuro_exam={'mini_mental': {'score': 24, 'domains': domains, 'education_level': '1_4'}})
    assert v.neuro_exam.mini_mental.score == 24
    for change in [{'score': 25}, {'domains': domains | {'temporal': 6}}, {'domains': domains | {'recall': None}}]:
        with pytest.raises(ValidationError):
            visit(neuro_exam={'mini_mental': {'score': 24, 'domains': domains} | change})
    assert 'MEEM' not in deterministic_soap(visit()).objective_text


def test_complaint_map_and_legacy_preservation():
    details = {'Dor': 'Lombalgia há dois dias.', 'Tontura': 'Ao levantar.'}
    v = visit(complaints=['Dor', 'Tontura'], intercurrence_details=details)
    text = deterministic_soap(v).subjective_text
    assert 'Quanto a dor: Lombalgia' in text and 'Quanto a tontura: Ao levantar' in text
    old = visit(complaints=['Dor', 'Tontura'], intercurrence_details='Relato antigo compartilhado')
    assert old.intercurrence_details == {'Dor': 'Relato antigo compartilhado'}
    for details in [{'Febre': 'Sem seleção'}, {'Sem intercorrências': 'Inválido'}, {'Dor': 'x' * 2001}]:
        with pytest.raises(ValidationError):
            visit(complaints=['Dor'], intercurrence_details=details)


def test_individual_target_and_suggestions_distinct_from_actions():
    v = visit(vitals={'systolic': 135, 'diastolic': 85}, bp_target={'systolic': 130, 'diastolic': 80})
    result = deterministic_soap(v)
    assert 'meta individual' in result.objective_text
    assert result.plan_text.startswith('- Conduta não registrada.\n- Sugestão para revisão médica:')
    assert 'ajustado' not in result.plan_text
    assert v.actions == []


@pytest.mark.parametrize('changes', [{'age': None}, {'age': 0}, {'age': 10}, {'conditions': ['Gestante']}, {'conditions': ['Puérpera']}])
def test_specific_profiles_not_classified_with_adult_thresholds(changes):
    v = VDInput.model_validate(visit(vitals={'systolic': 150, 'diastolic': 90}).model_dump() | changes)
    assert [a['code'] for a in clinical_analysis(v)] == ['specific_profile']


def test_visit_reason_can_replace_condition_without_losing_clinical_context():
    v = visit(conditions=[], visit_reason='Reavaliar após alta hospitalar')
    assert v.conditions == []
    assert 'Motivo do atendimento: Reavaliar após alta hospitalar' in deterministic_soap(v).subjective_text
    with pytest.raises(ValidationError):
        visit(conditions=[], visit_reason='   ')


def test_offline_backend_parity_contract():
    cases = json.loads((Path(__file__).parent / 'fixtures/clinical_cases.json').read_text(encoding='utf-8'))
    for case in cases:
        v = VDInput.model_validate(case['visit'])
        assert clinical_analysis(v) == case['analysis'], case['name']
        assert deterministic_soap(v).model_dump() == case['soap'], case['name']


def test_conflicting_schooling_is_rejected():
    with pytest.raises(ValidationError):
        visit(neuro_exam={'mini_mental': {'score': 24, 'education_level': 'none', 'education_years': 4}})
