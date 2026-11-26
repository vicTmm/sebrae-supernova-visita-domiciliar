import { useId, useState } from 'react'
import AssessmentDialog from './AssessmentDialog'
import { completeIvcfAnswers, ivcfAgeBand, ivcfAgeLabels, ivcfAgePoints, ivcfComorbidities, ivcfGroups, ivcfScore, ivcfStratum, type Ivcf20, type IvcfAnswers, type IvcfComorbidity } from '../types/ivcf20'

export default function Ivcf20Modal({ age, value, onSave, onClose }: {
  age: number | null
  value: Ivcf20 | null
  onSave: (value: Ivcf20) => void
  onClose: () => void
}) {
  const namePrefix = useId()
  const ageBand = ivcfAgeBand(age)
  const agePoints = ageBand ? ivcfAgePoints[ageBand] : 0
  const [answers, setAnswers] = useState<Partial<IvcfAnswers>>(value?.answers ?? {})
  const [hasComorbidity, setHasComorbidity] = useState<boolean | undefined>(value ? value.comorbidities.length > 0 : undefined)
  const [comorbidities, setComorbidities] = useState<IvcfComorbidity[]>(value?.comorbidities ?? [])
  const comorbidityAnswered = hasComorbidity === false || (hasComorbidity === true && comorbidities.length > 0)
  const answered = Number(Boolean(ageBand)) + Object.keys(answers).length + Number(comorbidityAnswered)
  const result: Ivcf20 | null = ageBand && completeIvcfAnswers(answers) && comorbidityAnswered
    ? { age_band: ageBand, answers, comorbidities, score: ivcfScore(ageBand, answers, comorbidities) }
    : null

  return <AssessmentDialog title="Índice de Vulnerabilidade Clínico-Funcional (IVCF-20)" onClose={onClose}
    result={result ? `IVCF-20: ${result.score}/40 · ${ivcfStratum(result.score)}` : `IVCF-20: ${answered} de 20 itens respondidos`}
    actions={close => <button type="button" className="primary" disabled={!result} onClick={() => { if (result) { close(); onSave(result) } }}>Salvar IVCF-20</button>}>
    <p>Responda todos os itens para calcular o resultado da avaliação.</p>
    <section className="assessment-group">
      <h3>Idade</h3>
      <p>{ageBand ? `${ivcfAgeLabels[ageBand]} · ${agePoints} ${agePoints === 1 ? 'ponto' : 'pontos'} pela idade da visita.` : 'Informe na visita a idade da pessoa avaliada. O IVCF-20 se aplica a partir de 60 anos.'}</p>
    </section>
    {ivcfGroups.map(group => <section className="assessment-group" key={group.title}>
      <h3>{group.title}</h3>
      {'description' in group && <p>{group.description}</p>}
      {group.questions.map(question => <fieldset key={question.key} className="assessment-question">
        <legend>{question.label}</legend>
        {'details' in question && <ul className="assessment-criteria">{question.details.map(detail => <li key={detail}>{detail}</li>)}</ul>}
        <div className="assessment-options">
          {[true, false].map(answer => <label key={String(answer)}><input type="radio" name={namePrefix + question.key}
            checked={answers[question.key] === answer} onChange={() => setAnswers(previous => ({ ...previous, [question.key]: answer }))}/>
            {question.key === 'poor_health' ? (answer ? 'Regular ou ruim' : 'Excelente, muito boa ou boa') : (answer ? 'Sim' : 'Não')}
          </label>)}
        </div>
      </fieldset>)}
    </section>)}
    <fieldset className="assessment-group">
      <legend>Comorbidades múltiplas</legend>
      <p>Há pelo menos um dos critérios abaixo? O bloco vale até 4 pontos.</p>
      <ul className="assessment-criteria">{ivcfComorbidities.map(item => <li key={item.key}>{item.label}</li>)}</ul>
      <div className="assessment-options">{[true, false].map(answer => <label key={String(answer)}>
        <input type="radio" name={namePrefix + 'comorbidities'} checked={hasComorbidity === answer} onChange={() => {
          setHasComorbidity(answer)
          if (!answer) setComorbidities([])
        }}/>{answer ? 'Sim' : 'Não'}
      </label>)}</div>
      {hasComorbidity && <fieldset className="assessment-question">
        <legend>Quais critérios estão presentes?</legend>
        <div className="assessment-options">{ivcfComorbidities.map(item => <label key={item.key}>
          <input type="checkbox" checked={comorbidities.includes(item.key)} onChange={event => {
            const checked = event.target.checked
            setComorbidities(previous => checked ? [...previous, item.key] : previous.filter(key => key !== item.key))
          }}/>{item.label}
        </label>)}</div>
      </fieldset>}
    </fieldset>
  </AssessmentDialog>
}
