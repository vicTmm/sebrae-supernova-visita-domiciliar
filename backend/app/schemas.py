from datetime import date, datetime
from enum import Enum
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator, field_validator
import re
from typing import Annotated, Literal


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Condition(str, Enum):
    BEDRIDDEN = "Acamado"
    HYPERTENSION = "Hipertenso"
    DIABETES = "Diabético"
    COPD = "DPOC/pneumopata"
    PREGNANT = "Gestante"
    POSTPARTUM = "Puérpera"
    MENTAL = "Saúde Mental"
    ASTHMA = "Asma"
    HEART_FAILURE = "Insuficiência cardíaca"
    PREVIOUS_MI = "Infarto prévio"
    PREVIOUS_STROKE = "AVC prévio"
    CKD = "Doença renal crônica"
    CANCER = "Câncer"
    DEMENTIA = "Demência"
    ALZHEIMER = "Doença de Alzheimer"
    PARKINSON = "Doença de Parkinson"
    TUBERCULOSIS = "Tuberculose"
    LEPROSY = "Hanseníase"
    PRESSURE_INJURY = "Lesão por pressão"
    CHRONIC_WOUND = "Ferida crônica"
    PALLIATIVE_CARE = "Cuidados paliativos"
    OTHER = "Outra"


class Complaint(str, Enum):
    NONE = "Sem intercorrências"
    PAIN = "Dor"
    DYSPNEA = "Dispneia"
    FEVER = "Febre"
    DIZZINESS = "Tontura"
    FALL = "Queda"
    EMERGENCY = "Ida à UPA/Emergência"
    HOSPITALIZATION = "Internação hospitalar"


class Action(str, Enum):
    PRESCRIPTION = "Manutenção de receita"
    MEDICATION = "Ajuste medicamentoso"
    TESTS = "Solicitação de exames"
    REFERRAL = "Encaminhamento especialista"
    RETURN = "Agendamento de retorno VD"
    GUIDANCE = "Orientações gerais"


class Vitals(StrictModel):
    systolic: int | None = Field(default=None, ge=40, le=300)
    diastolic: int | None = Field(default=None, ge=20, le=200)
    heart_rate: int | None = Field(default=None, ge=10, le=300)
    respiratory_rate: int | None = Field(default=None, ge=1, le=100)
    oxygen_saturation: float | None = Field(default=None, ge=0, le=100)
    temperature: float | None = Field(default=None, ge=30, le=45)
    glucose: int | None = Field(default=None, ge=10, le=1000)

    @model_validator(mode="after")
    def pressure(self):
        if (self.systolic is None) != (self.diastolic is None):
            raise ValueError("Informe os dois valores da PA ou deixe ambos vazios.")
        if self.systolic is not None and self.systolic <= self.diastolic:
            raise ValueError("PA sistólica deve superar a diastólica.")
        return self


class ExamFinding(StrictModel):
    status: str = Field(default="Não avaliado", pattern="^(Não avaliado|Sem alterações|Alterado)$")
    notes: str = Field(default="", max_length=500)

    @model_validator(mode="after")
    def altered_needs_notes(self):
        if self.status == "Alterado" and not self.notes:
            raise ValueError("Descreva a alteração no exame.")
        if self.status != "Alterado" and self.notes:
            raise ValueError("Observações do exame exigem status Alterado.")
        return self


class PhysicalExam(StrictModel):
    cardiovascular: ExamFinding = Field(default_factory=ExamFinding)
    respiratory: ExamFinding = Field(default_factory=ExamFinding)
    abdomen: ExamFinding = Field(default_factory=ExamFinding)
    general: ExamFinding = Field(default_factory=ExamFinding)


class Companions(StrictModel):
    has_acs: bool = False
    acs_name: str | None = Field(default=None, max_length=80)
    has_student: bool = False
    student_name: str | None = Field(default=None, max_length=80)
    has_nurse: bool = False
    nurse_name: str | None = Field(default=None, max_length=80)
    is_solo: bool = False

    @model_validator(mode="after")
    def consistent_team(self):
        if self.is_solo and (self.has_acs or self.has_student or self.has_nurse):
            raise ValueError("Apenas médico não pode ser combinado com acompanhantes.")
        if (self.acs_name and not self.has_acs) or (self.student_name and not self.has_student) or (self.nurse_name and not self.has_nurse):
            raise ValueError("Nome exige a seleção do acompanhante correspondente.")
        return self


class NeuroFlag(str, Enum):
    ORIENTED = "Lúcido e orientado (LOTE)"
    PUPILS = "Pupilas isocóricas e fotorreagentes (PIFR)"
    STRENGTH = "Força muscular preservada e simétrica"
    FOCAL = "Déficit motor focal"
    SPEECH = "Disartria/Afasia"


class CognitiveDomains(StrictModel):
    temporal: int = Field(ge=0, le=5, strict=True)
    spatial: int = Field(ge=0, le=5, strict=True)
    registration: int = Field(ge=0, le=3, strict=True)
    attention: int = Field(ge=0, le=5, strict=True)
    recall: int = Field(ge=0, le=3, strict=True)
    language: int = Field(ge=0, le=9, strict=True)


class MiniMentalItems(StrictModel):
    temporal: list[Annotated[bool, Field(strict=True)]] = Field(min_length=5, max_length=5)
    spatial: list[Annotated[bool, Field(strict=True)]] = Field(min_length=5, max_length=5)
    registration: list[Annotated[bool, Field(strict=True)]] = Field(min_length=3, max_length=3)
    attention: list[Annotated[bool, Field(strict=True)]] = Field(min_length=5, max_length=5)
    recall: list[Annotated[bool, Field(strict=True)]] = Field(min_length=3, max_length=3)
    language: list[Annotated[bool, Field(strict=True)]] = Field(min_length=9, max_length=9)


class MiniMental(StrictModel):
    score: int = Field(ge=0, le=30, strict=True)
    domains: CognitiveDomains | None = None
    items: MiniMentalItems | None = None
    attention_method: Literal["serial_sevens", "mundo_reverse"] | None = None
    education_level: Literal["none", "1_4", "5_8", "over_8"] | None = None
    education_years: int | None = Field(default=None, ge=0, le=40, strict=True)
    notes: str = Field(default="", max_length=1000)

    @model_validator(mode="after")
    def correct_total(self):
        if self.domains and self.score != sum(self.domains.model_dump().values()):
            raise ValueError("Total do MEEM deve corresponder aos seis domínios.")
        if self.items:
            counted = {key: sum(marked) for key, marked in self.items.model_dump().items()}
            if not self.attention_method or not self.domains or self.domains.model_dump() != counted:
                raise ValueError("Os acertos e o método de atenção do MEEM devem corresponder aos domínios.")
        elif self.attention_method:
            raise ValueError("O método de atenção exige o MEEM preenchido item a item.")
        if self.education_level and self.education_years is not None:
            years = self.education_years
            expected = 'none' if years == 0 else '1_4' if years <= 4 else '5_8' if years <= 8 else 'over_8'
            if self.education_level != expected:
                raise ValueError("Faixa de escolaridade diverge dos anos completos informados.")
        return self


class BloodPressureTarget(StrictModel):
    systolic: int = Field(ge=80, le=180, strict=True)
    diastolic: int = Field(ge=40, le=110, strict=True)

    @model_validator(mode="after")
    def valid_pressure(self):
        if self.systolic <= self.diastolic:
            raise ValueError("Meta sistólica deve superar a diastólica.")
        return self


class ScreeningStatus(str, Enum):
    CURRENT = "Em dia"
    OVERDUE = "Atrasado / Solicitar"
    NEVER = "Nunca realizou"
    NOT_APPLICABLE = "Não se aplica"


class PreventiveScreening(StrictModel):
    status: ScreeningStatus | None = None
    year: int | None = Field(default=None, ge=1900, le=2100, strict=True)
    notes: str = Field(default="", max_length=500)

    @model_validator(mode="after")
    def consistent_history(self):
        if self.year is not None and (self.year > datetime.now().year or self.status == ScreeningStatus.NEVER):
            raise ValueError("Confira o ano do último exame e o histórico de realização.")
        return self


class WomensHealth(StrictModel):
    cervical: PreventiveScreening = Field(default_factory=PreventiveScreening)
    mammography: PreventiveScreening = Field(default_factory=PreventiveScreening)


class GeriatricFlag(str, Enum):
    MOOD = "Humor deprimido / desânimo frequente"
    INTEREST = "Perda de interesse nas atividades"
    MEMORY = "Queixa de esquecimento progressivo"
    DAILY_ACTIVITIES = "Dependência para atividades básicas (AVDs)"
    FALLS = "Risco de queda / mobilidade reduzida"


class GeriatricScreening(StrictModel):
    flags: list[GeriatricFlag] = Field(default_factory=list, max_length=5)
    notes: str = Field(default="", max_length=1000)

    @model_validator(mode="after")
    def unique_flags(self):
        if len(self.flags) != len(set(self.flags)):
            raise ValueError("Marcadores geriátricos duplicados.")
        return self


IvcfAgeBand = Literal["60_74", "75_84", "85_plus"]
IvcfComorbidity = Literal["chronic_diseases", "polypharmacy", "hospitalization"]
IvcfAnswer = Annotated[bool, Field(strict=True)]


def ivcf_age_band(age: int) -> IvcfAgeBand | None:
    if age < 60:
        return None
    return "60_74" if age < 75 else "75_84" if age < 85 else "85_plus"


class IvcfAnswers(StrictModel):
    poor_health: IvcfAnswer
    shopping: IvcfAnswer
    finances: IvcfAnswer
    housework: IvcfAnswer
    bathing: IvcfAnswer
    memory_report: IvcfAnswer
    memory_worse: IvcfAnswer
    memory_limits: IvcfAnswer
    low_mood: IvcfAnswer
    loss_interest: IvcfAnswer
    arm_reach: IvcfAnswer
    small_objects: IvcfAnswer
    physical_capacity: IvcfAnswer
    walking: IvcfAnswer
    falls: IvcfAnswer
    incontinence: IvcfAnswer
    vision: IvcfAnswer
    hearing: IvcfAnswer

    def points(self) -> int:
        return (
            int(self.poor_health) + (4 if self.shopping or self.finances or self.housework else 0)
            + 6 * self.bathing + self.memory_report + self.memory_worse + 2 * self.memory_limits
            + 2 * (self.low_mood + self.loss_interest) + self.arm_reach + self.small_objects
            + 2 * (self.physical_capacity + self.walking + self.falls + self.incontinence + self.vision + self.hearing)
        )


class Ivcf20(StrictModel):
    age_band: IvcfAgeBand
    answers: IvcfAnswers
    comorbidities: list[IvcfComorbidity] = Field(max_length=3)
    score: int = Field(ge=0, le=40, strict=True)

    @model_validator(mode="after")
    def correct_total(self):
        if len(self.comorbidities) != len(set(self.comorbidities)):
            raise ValueError("Critérios de comorbidade do IVCF-20 duplicados.")
        age_points = {"60_74": 0, "75_84": 1, "85_plus": 3}[self.age_band]
        if self.score != age_points + self.answers.points() + (4 if self.comorbidities else 0):
            raise ValueError("Total do IVCF-20 deve corresponder às respostas do questionário.")
        return self

    def stratum(self) -> str:
        if self.score <= 6:
            return "Idoso Robusto (baixo risco)"
        if self.score <= 14:
            return "Idoso em Risco de Fragilização (risco moderado)"
        return "Idoso Frágil (alto risco)"


class NeuroExam(StrictModel):
    mini_mental: MiniMental | None = None
    ivcf20: Ivcf20 | None = None
    geriatric_screening: GeriatricScreening | None = None
    rankin: int | None = Field(default=None, ge=0, le=5, strict=True)
    directed_flags: list[NeuroFlag] = Field(default_factory=list, max_length=5)
    neuro_notes: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def consistent_findings(self):
        if len(self.directed_flags) != len(set(self.directed_flags)):
            raise ValueError("Achados neurológicos duplicados.")
        if NeuroFlag.STRENGTH in self.directed_flags and NeuroFlag.FOCAL in self.directed_flags:
            raise ValueError("Força preservada e déficit motor focal são seleções mutuamente exclusivas.")
        return self


LabNumber = Annotated[float, Field(ge=0, le=1_000_000_000, strict=True, allow_inf_nan=False)]
LabPercentage = Annotated[float, Field(ge=0, le=100, strict=True, allow_inf_nan=False)]
LabCount = Annotated[int, Field(ge=0, le=1_000_000_000, strict=True)]
LabText = Annotated[str, Field(max_length=320)]


class LabResults(StrictModel):
    exam_date: date | None = None
    hb: LabNumber | None = None
    ht: LabPercentage | None = None
    leucocitos: LabCount | None = None
    plaquetas: LabCount | None = None
    hemograma_resumo: LabText | None = None
    creatinina: LabNumber | None = None
    ureia: LabNumber | None = None
    sodio: LabNumber | None = None
    potassio: LabNumber | None = None
    colesterol_total: LabNumber | None = None
    ldl: LabNumber | None = None
    hdl: LabNumber | None = None
    triglicerideos: LabNumber | None = None
    ldl_target: Annotated[float, Field(gt=0, le=1_000_000_000, strict=True, allow_inf_nan=False)] | None = None
    glicemia_jejum: LabNumber | None = None
    hba1c: LabPercentage | None = None
    tsh: LabNumber | None = None
    t4_livre: LabNumber | None = None
    tgo_ast: LabNumber | None = None
    tgp_alt: LabNumber | None = None
    ggt: LabNumber | None = None
    fosfatase_alcalina: LabNumber | None = None
    bilirrubinas: LabText | None = None
    proteinas_totais_fracoes: LabText | None = None
    psa: LabNumber | None = None
    eas_urina: LabText | None = None
    outros_exames: LabText | None = None

    @field_validator('exam_date', mode='before')
    @classmethod
    def calendar_date(cls, value):
        if value is None or type(value) is date:
            return value
        if isinstance(value, str) and re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}', value):
            return date.fromisoformat(value)
        raise ValueError('Informe a data do exame no formato AAAA-MM-DD.')


class ResidentPerson(StrictModel):
    name: str = Field(default='', max_length=120)
    phone: str = Field(default='', max_length=11, pattern=r'^(?:[1-9][0-9]{9,10})?$')

    @model_validator(mode='after')
    def named_contact(self):
        if self.phone and not self.name:
            raise ValueError('Informe o nome da pessoa de contato.')
        return self


class ResidentGroup(StrictModel):
    id: UUID
    relationship: Literal['spouse', 'child', 'grandchild', 'parent', 'sibling', 'other_relative', 'friend', 'housemate', 'caregiver', 'other']
    other_relationship: str = Field(default='', max_length=100)
    count: int = Field(ge=1, le=20, strict=True)
    members: list[ResidentPerson] = Field(default_factory=list, max_length=20)

    @model_validator(mode='after')
    def coherent_group(self):
        if self.relationship == 'other' and not self.other_relationship:
            raise ValueError('Descreva o outro vínculo.')
        if self.relationship != 'other' and self.other_relationship:
            raise ValueError('Descrição de outro vínculo incompatível.')
        if len(self.members) > self.count:
            raise ValueError('Há mais pessoas identificadas que a quantidade informada.')
        return self


class Household(StrictModel):
    residents: list[ResidentGroup] = Field(default_factory=list, max_length=10)
    living_arrangement: Literal['alone', 'with_others'] | None = None
    cohabitants: str = Field(default='', max_length=500)
    caregiver_status: Literal['yes', 'no'] | None = None
    caregiver_name: str = Field(default='', max_length=80)
    caregiver_relationship: str = Field(default='', max_length=100)
    caregiver_notes: str = Field(default='', max_length=500)

    @model_validator(mode='after')
    def coherent_household(self):
        if (self.cohabitants or self.residents) and self.living_arrangement != 'with_others':
            raise ValueError('Informe que mora com outras pessoas para descrever os moradores.')
        if len({r.id for r in self.residents}) != len(self.residents):
            raise ValueError('Grupos de moradores duplicados.')
        if any([self.caregiver_name, self.caregiver_relationship, self.caregiver_notes]) and self.caregiver_status != 'yes':
            raise ValueError('Informe a presença de cuidador para descrever os cuidados.')
        return self


class VDInput(StrictModel):
    household: Household | None = None
    id: UUID
    visited_at: datetime
    patient_code: str = Field(min_length=1, max_length=30)
    age: int = Field(ge=0, le=130)
    sex: Literal['Feminino', 'Masculino'] | None = None
    womens_health: WomensHealth | None = None
    conditions: list[Condition] = Field(min_length=1, max_length=len(Condition))
    other_condition: str = Field(default="", max_length=500)
    companions: Companions = Field(default_factory=Companions)
    complaints: list[Complaint] = Field(default_factory=list, max_length=8)
    adherence: str = Field(default="Não informado", pattern="^(Regular|Irregular|Não faz uso|Não informado)$")
    subjective_notes: str = Field(default="", max_length=2000)
    intercurrence_details: dict[Complaint, Annotated[str, Field(max_length=2000)]] = Field(default_factory=dict, max_length=7)
    medications_in_use: str = Field(default="", max_length=1000)
    recent_medications: str | None = Field(default=None, max_length=1000)
    vitals: Vitals = Field(default_factory=Vitals)
    vitals_context: str = Field(default="", max_length=1000)
    lab_results: LabResults | None = None
    bp_target: BloodPressureTarget | None = None
    exam: PhysicalExam = Field(default_factory=PhysicalExam)
    neuro_exam: NeuroExam | None = None
    assessment: str = Field(default="", max_length=2000)
    actions: list[Action] = Field(default_factory=list, max_length=6)
    plan_notes: str = Field(default="", max_length=2000)

    @model_validator(mode="before")
    @classmethod
    def legacy_medications(cls, data):
        # Payloads antigos do SQLite e de dispositivos ainda não atualizados.
        if isinstance(data, dict):
            data = dict(data)
            # Preserva ausência de informação nos cadastros antigos sem atribuir sexo.
            if data.get('sex') in ('Outro', 'Não informado', ''):
                data['sex'] = None
            if ("intercurrence_details" not in data and data.get("complaints")
                    and Complaint.NONE not in data["complaints"] and data.get("subjective_notes")):
                data["intercurrence_details"] = data["subjective_notes"]
                data["subjective_notes"] = ""
            # Um relato compartilhado antigo não é atribuído a vários sintomas.
            legacy = data.get("intercurrence_details")
            if isinstance(legacy, str):
                selected = [c for c in data.get("complaints", []) if c != Complaint.NONE]
                if legacy.strip() and not selected:
                    raise ValueError("Detalhes de intercorrência exigem uma intercorrência selecionada.")
                data["intercurrence_details"] = {selected[0]: legacy} if legacy.strip() else {}
        if isinstance(data, dict) and "medications" in data:
            data = dict(data)
            legacy = data.pop("medications")
            if "medications_in_use" not in data:
                data["medications_in_use"] = legacy
            elif legacy and legacy != data["medications_in_use"]:
                raise ValueError("Medicações antigas e atuais divergem; envie apenas medications_in_use.")
        return data

    @model_validator(mode="after")
    def consistency(self):
        if self.neuro_exam and self.neuro_exam.ivcf20 and self.neuro_exam.ivcf20.age_band != ivcf_age_band(self.age):
            raise ValueError("Confira se a faixa etária do IVCF-20 corresponde à idade da visita.")
        if self.womens_health is not None and self.sex != "Feminino":
            raise ValueError("Saúde da Mulher exige sexo Feminino selecionado.")
        if self.other_condition and Condition.OTHER not in self.conditions:
            raise ValueError("Descrição de outra condição exige a seleção de Outra.")
        if self.visited_at.tzinfo is None:
            raise ValueError("visited_at deve conter fuso horário.")
        if Complaint.NONE in self.complaints and len(self.complaints) > 1:
            raise ValueError("Sem intercorrências é exclusivo das demais queixas.")
        if self.intercurrence_details and (not self.complaints or Complaint.NONE in self.complaints):
            raise ValueError("Detalhes de intercorrência exigem uma intercorrência selecionada.")
        if any(key not in self.complaints or key == Complaint.NONE for key in self.intercurrence_details):
            raise ValueError("Cada detalhe deve corresponder a uma queixa selecionada.")
        for items in (self.conditions, self.complaints, self.actions):
            if len(items) != len(set(items)):
                raise ValueError("Seleções duplicadas não são permitidas.")
        return self


OBJECTIVE_TEXT_LIMIT = 10_000


class SOAPOutput(StrictModel):
    subjective_text: str = Field(max_length=24000)
    objective_text: str = Field(max_length=OBJECTIVE_TEXT_LIMIT)
    vitals_formatted: dict[str, str]
    plan_text: str = Field(max_length=6000)
    assessment_text: str | None = Field(default=None, max_length=6000)
    vitals_context: str = Field(default="", max_length=1000)
    full_text_fallback: str = Field(max_length=50000)
    source: str = "deterministic"

    @field_validator('subjective_text', 'objective_text', 'plan_text', 'assessment_text', mode='before')
    @classmethod
    def clean_block_prefix(cls, value):
        if isinstance(value, str):
            return re.sub(r'^\s*(?:[SOAP]\s*:\s*)+', '', value, flags=re.IGNORECASE)
        return value


class SOAPNarrative(StrictModel):
    subjective_text: str = Field(min_length=1, max_length=24000)
    objective_text: str = Field(min_length=1, max_length=OBJECTIVE_TEXT_LIMIT)
    plan_text: str = Field(min_length=1, max_length=6000)
    assessment_text: str | None = Field(default=None, max_length=6000)


class VisitWrite(StrictModel):
    visit: VDInput
    soap_text: str = Field(min_length=1, max_length=50000)
    soap_blocks: SOAPOutput | None = None
    base_revision: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def matching_text(self):
        if self.soap_blocks and self.soap_blocks.full_text_fallback != self.soap_text:
            raise ValueError("O texto completo deve corresponder aos blocos revisados.")
        return self


class VisitOutput(StrictModel):
    visit: VDInput
    soap_text: str
    soap_blocks: SOAPOutput | None = None
    revision: int


class SyncRequest(StrictModel):
    visits: list[VisitWrite] = Field(max_length=100)


class SyncOutput(StrictModel):
    saved: list[VisitOutput]
    conflicts: list[VisitOutput]


def stored_visit(payload: dict) -> VDInput:
    """Lê versões antigas sem reintroduzir testes estruturados descontinuados.

    O texto revisado do prontuário não é alterado. Só campos neurológicos ainda
    presentes no schema atual são usados ao editar novamente uma visita antiga.
    """
    data = dict(payload)
    if isinstance(data.get('neuro_exam'), dict):
        data['neuro_exam'] = {key: value for key, value in data['neuro_exam'].items() if key in NeuroExam.model_fields}
    return VDInput.model_validate(data)
