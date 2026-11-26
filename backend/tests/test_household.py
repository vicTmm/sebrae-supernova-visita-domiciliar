from uuid import uuid4
import pytest
from pydantic import ValidationError
from app.schemas import VDInput
from app.services.soap_generator import deterministic_soap


def visit(**fields):
    return VDInput(id=uuid4(), visited_at='2026-11-24T10:00:00-03:00', patient_code='TESTE', age=70, conditions=['Hipertenso'], **fields)


def test_optional_household_does_not_infer_support():
    before = deterministic_soap(visit()).subjective_text
    assert before == deterministic_soap(visit(household={})).subjective_text
    assert 'cuidador de referência' not in before
    assert 'morar sozinho' not in before


def test_caregiver_may_live_elsewhere_and_roundtrip():
    data = {'living_arrangement': 'alone', 'caregiver_status': 'yes', 'caregiver_name': 'M.', 'caregiver_relationship': 'filha', 'caregiver_notes': 'Visita diariamente'}
    v = visit(household=data)
    assert VDInput.model_validate(v.model_dump()).household == v.household
    text = deterministic_soap(v).subjective_text
    assert 'Relata morar sozinho(a)' in text
    assert 'Cuidador de referência: M. (vínculo: filha)' in text
    assert 'Sobre os cuidados: Visita diariamente' in text
    assert text.index('Cuidador de referência') < text.index('Relata morar sozinho(a)')


def test_cohabitants_and_explicit_absence():
    text = deterministic_soap(visit(household={'living_arrangement': 'with_others', 'cohabitants': 'filha e dois netos', 'caregiver_status': 'no'})).subjective_text
    assert 'Reside com filha e dois netos' in text
    assert 'Relata não possuir cuidador de referência' in text


@pytest.mark.parametrize('data', [{'living_arrangement': 'alone', 'cohabitants': 'filha'}, {'caregiver_status': 'no', 'caregiver_name': 'M.'}, {'caregiver_status': 'yes', 'caregiver_name': 'x' * 81}])
def test_inconsistent_or_oversized_details_rejected(data):
    with pytest.raises(ValidationError):
        visit(household=data)


def test_structured_residents_do_not_leak_contact_details_into_soap():
    group = {'id': str(uuid4()), 'relationship': 'child', 'count': 2, 'members': [{'name': 'Pessoa Fictícia', 'phone': '11999990000'}]}
    v = visit(household={'living_arrangement': 'with_others', 'residents': [group]})
    text = deterministic_soap(v).subjective_text
    assert 'Reside com 2 filhos(as)' in text
    assert 'Pessoa Fictícia' not in text
    assert '11999990000' not in text
    assert VDInput.model_validate(v.model_dump()).household == v.household


@pytest.mark.parametrize('patch', [{'count': 0}, {'count': 21}, {'count': 1.5}, {'relationship': 'invalid'}, {'relationship': 'other'}, {'members': [{'name': '', 'phone': '11999990000'}]}, {'members': [{'name': 'Pessoa', 'phone': '123'}]}])
def test_resident_validation(patch):
    group = {'id': str(uuid4()), 'relationship': 'child', 'count': 2, **patch}
    with pytest.raises(ValidationError):
        visit(household={'living_arrangement': 'with_others', 'residents': [group]})
