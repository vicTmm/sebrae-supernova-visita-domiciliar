"""Regras de apoio à revisão, nunca diagnóstico ou prescrição automática.

Limiares do protocolo solicitado para validação do MVP. Não são metas universais.
Ausência de alerta não significa normalidade. Adultos; pediatria/gestação exigem
avaliação específica. MEEM: abaixo do corte (<), sem diagnóstico de demência.
"""
from dataclasses import asdict, dataclass
from decimal import Decimal
from ..schemas import VDInput, MiniMental


@dataclass
class ClinicalAlert:
    code: str
    fields: list[str]
    observation: str
    suggestion: str


def format_lab_number(value: float) -> str:
    if value == 0:
        return '0'
    text = format(Decimal(str(value)), 'f')
    return (text.rstrip('0').rstrip('.') if '.' in text else text).replace('.', ',')


def cognitive_cutoff(m: MiniMental) -> int | None:
    if m.education_level:
        return {'none': 20, '1_4': 25, '5_8': 26, 'over_8': 28}[m.education_level]
    years = m.education_years
    return None if years is None else 20 if years == 0 else 25 if years <= 4 else 26 if years <= 8 else 28


def cognitive_interpretation(m: MiniMental) -> str:
    cutoff = cognitive_cutoff(m)
    if cutoff is None:
        return "Escolaridade não informada; interpretação por corte não disponível"
    status = "abaixo do corte de rastreio; possível alteração cognitiva, sem diagnóstico" if m.score < cutoff else "não abaixo do corte de rastreio; não exclui alteração cognitiva"
    return f"{status} (corte {cutoff} para a escolaridade informada)"


def evaluate_clinical(visit: VDInput) -> list[ClinicalAlert]:
    v, alerts = visit.vitals, []
    def add(code, fields, observation, suggestion):
        alerts.append(ClinicalAlert(code, fields, observation, suggestion))

    adult = visit.age is not None and visit.age >= 18 and 'Gestante' not in visit.conditions and 'Puérpera' not in visit.conditions
    if not adult:
        if any(value is not None for value in v.model_dump().values()):
            add('specific_profile', list(type(v).model_fields), 'Perfil pediátrico/obstétrico: referências adultas gerais não aplicadas', 'Avaliar os sinais vitais conforme protocolo específico para idade ou condição obstétrica')
    else:
        if v.systolic is not None and v.diastolic is not None:
            value = f"PA {v.systolic}/{v.diastolic} mmHg"
            has = 'Hipertenso' in visit.conditions
            if v.systolic >= 180 or v.diastolic >= 120:
                add('bp_severe', ['systolic', 'diastolic'], f'{value}: elevação acentuada', 'Reavaliar imediatamente a PA, sintomas e sinais de lesão aguda de órgão-alvo; definir necessidade de atendimento urgente')
            elif has and (v.systolic >= 150 or v.diastolic >= 95):
                add('bp_uncontrolled', ['systolic', 'diastolic'], f'{value}: elevação significativa no acompanhamento de HAS', 'Revisar adesão anti-hipertensiva e considerar ajuste posológico ou curva pressórica após avaliação médica')
            elif v.systolic >= 140 or v.diastolic >= 90:
                add('bp_monitor', ['systolic', 'diastolic'], f'{value}: limítrofe/elevada no acompanhamento de HAS; conferir meta individual' if has else f'{value}: PA acima da referência de rastreio, investigar/monitorar', 'Repetir a aferição e revisar a meta individual; considerar monitorização pressórica')
            if visit.bp_target and (v.systolic >= visit.bp_target.systolic or v.diastolic >= visit.bp_target.diastolic):
                t = visit.bp_target
                add('bp_target', ['systolic', 'diastolic'], f'{value}: atinge ou supera a meta individual registrada de <{t.systolic}/{t.diastolic} mmHg', 'Revisar a PA em relação à meta individual definida pelo médico, tolerabilidade e contexto clínico')
        if v.oxygen_saturation is not None:
            copd = 'DPOC/pneumopata' in visit.conditions
            threshold = 92 if copd else 95
            if v.oxygen_saturation < threshold:
                add('oxygen_low', ['oxygen_saturation'], f'SatO2 {v.oxygen_saturation:g}%: saturação reduzida, possível hipoxemia' + (' no contexto de pneumopatia' if copd else ''), 'Confirmar a oximetria e avaliar sintomas respiratórios e necessidade de atendimento imediato; individualizar suporte conforme avaliação médica')
        if v.glucose is not None:
            diabetic = 'Diabético' in visit.conditions
            if v.glucose < 70:
                add('glucose_low', ['glucose'], f'HGT {v.glucose} mg/dL: hipoglicemia', 'Avaliar e manejar prontamente a hipoglicemia conforme protocolo, reavaliar glicemia e revisar fatores precipitantes')
            elif v.glucose > (180 if diabetic else 200):
                add('glucose_high', ['glucose'], f'HGT {v.glucose} mg/dL: hiperglicemia no acompanhamento de diabetes' if diabetic else f'HGT {v.glucose} mg/dL: glicemia elevada sem diagnóstico prévio de diabetes informado', 'Reavaliar glicemia, horário da alimentação, sintomas e adesão; considerar investigação ou revisão terapêutica após avaliação médica')
        for key, low, high, name, unit in [('heart_rate', 50, 100, 'FC', 'bpm'), ('respiratory_rate', None, 20, 'FR', 'irpm')]:
            value = getattr(v, key)
            if value is not None and ((low is not None and value < low) or value > high):
                label = 'bradicardia' if low is not None and value < low else 'taquicardia' if key == 'heart_rate' else 'taquipneia'
                add(label, [key], f'{name} {value} {unit}: {label}', f'Reavaliar {name}, sintomas associados e possíveis causas; definir conduta conforme avaliação clínica')
        if v.temperature is not None and v.temperature >= 37.8:
            add('fever', ['temperature'], f'Tax {v.temperature:g} °C: febre', 'Investigar foco e sintomas associados à febre e definir conduta conforme avaliação clínica')
    labs = visit.lab_results
    if adult and labs:
        diabetic = 'Diabético' in visit.conditions
        target = labs.ldl_target
        if labs.ldl is not None and (
            labs.ldl >= target if target is not None else labs.ldl >= 100 if diabetic else labs.ldl > 130
        ):
            threshold = f'atinge ou supera a meta registrada de <{format_lab_number(target)} mg/dL' if target is not None else (
                'atinge ou supera 100 mg/dL na triagem do diabetes' if diabetic else 'acima de 130 mg/dL na triagem')
            add('lab_ldl', ['ldl'], f'LDL {format_lab_number(labs.ldl)} mg/dL: {threshold}',
                'Reavaliar o perfil lipídico, a meta individual e o risco cardiovascular, reforçar medidas alimentares e considerar indicação ou ajuste de estatina')
        if diabetic and labs.hba1c is not None and labs.hba1c >= 7:
            add('lab_hba1c', ['hba1c'], f'HbA1c {format_lab_number(labs.hba1c)}%: atinge ou supera 7% na triagem do diabetes',
                'Revisar a meta individual de HbA1c, adesão, hipoglicemias e necessidade de ajuste após avaliação clínica')
        if labs.creatinina is not None and labs.creatinina > 1.3:
            add('lab_creatinine', ['creatinina'], f'Cr {format_lab_number(labs.creatinina)} mg/dL: acima de 1,3 mg/dL na triagem',
                'Comparar a creatinina com resultados anteriores, revisar a TFGe e avaliar a necessidade de confirmação no contexto clínico')
        if labs.tsh is not None and not 0.4 <= labs.tsh <= 4.5:
            add('lab_tsh', ['tsh'], f'TSH {format_lab_number(labs.tsh)} mUI/L: fora da faixa de triagem de 0,4 a 4,5 mUI/L',
                'Conferir o intervalo de referência do laboratório e interpretar o TSH junto ao T4 livre e ao quadro clínico')
        if labs.psa is not None and labs.psa > 4:
            add('lab_psa', ['psa'], f'PSA {format_lab_number(labs.psa)} ng/mL: acima de 4 ng/mL na triagem',
                'Contextualizar o PSA conforme idade, histórico e fatores transitórios e considerar repetir o exame antes de investigação adicional')
        if labs.hb is not None and labs.hb < 12:
            add('lab_hb', ['hb'], f'Hb {format_lab_number(labs.hb)} g/dL: abaixo de 12 g/dL na triagem',
                'Revisar o hemograma e a referência aplicável, comparar resultados anteriores e avaliar a causa da hemoglobina baixa')
    m = visit.neuro_exam.mini_mental if visit.neuro_exam else None
    if m and cognitive_cutoff(m) is not None:
        cutoff = cognitive_cutoff(m)
        if m.score < cutoff:
            add('cognition', [], f'MEEM {m.score}/30: {cognitive_interpretation(m)}', 'Considerar avaliação cognitiva ampliada, comparar com desempenho prévio e investigar causas reversíveis; rastreio isolado não estabelece declínio ou demência')
    return alerts


def clinical_analysis(visit: VDInput) -> list[dict]:
    return [asdict(alert) for alert in evaluate_clinical(visit)]
