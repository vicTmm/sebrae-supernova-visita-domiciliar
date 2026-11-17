import { useState } from 'react'
import AssessmentDialog from './AssessmentDialog'
import { cognitiveInterpretation } from '../services/clinicalRules'
import { cognitiveDomains, miniMentalDomains, miniMentalTotal, type AttentionMethod, type CognitiveDomains, type MiniMental, type MiniMentalItems } from '../types/visit'

const questions: Record<keyof CognitiveDomains, readonly string[]> = {
  temporal: ['Dia da semana', 'Dia do mês', 'Mês', 'Ano', 'Hora aproximada'],
  spatial: ['Local específico (cômodo ou casa)', 'Endereço ou rua', 'Bairro', 'Cidade', 'Estado'],
  registration: ['Vaso', 'Carro', 'Tijolo'],
  attention: ['93', '86', '79', '72', '65'],
  recall: ['Vaso', 'Carro', 'Tijolo'],
  language: [
    'Nomeia o relógio', 'Nomeia a caneta', 'Repete a frase proposta',
    'Pega o papel com a mão direita', 'Dobra o papel ao meio', 'Coloca o papel no chão',
    'Lê e obedece ao comando', 'Escreve uma frase com sentido', 'Copia os pentágonos sobrepostos',
  ],
}
const reverseMundo = ['O', 'D', 'N', 'U', 'M']
const guide: Partial<Record<keyof CognitiveDomains, string>> = {
  temporal: 'Pergunte a data e a hora aproximada.',
  spatial: 'Pergunte onde a pessoa está.',
  registration: 'Diga: Vaso, Carro, Tijolo e peça para repetir.',
  recall: 'Pergunte: Quais foram as 3 palavras repetidas antes?',
}
const blankItems = () => Object.fromEntries(cognitiveDomains.map(({ key, max }) => [key, Array<boolean>(max).fill(false)])) as MiniMentalItems

export default function MeemModal({ value, onSave, onClose }: {
  value: MiniMental | null
  onSave: (value: MiniMental) => void
  onClose: () => void
}) {
  const [items, setItems] = useState(() => value?.items ?? blankItems())
  const [method, setMethod] = useState<AttentionMethod>(value?.attention_method ?? 'serial_sevens')
  const [education, setEducation] = useState<MiniMental['education_level']>(() => {
    if (value?.education_level) return value.education_level
    const years = value?.education_years
    return years == null ? null : years === 0 ? 'none' : years <= 4 ? '1_4' : years <= 8 ? '5_8' : 'over_8'
  })
  const [notes, setNotes] = useState(value?.notes ?? '')
  const [confirmed, setConfirmed] = useState(Boolean(value?.items))
  const domains = miniMentalDomains(items)
  const score = miniMentalTotal(domains)!
  const result: MiniMental = { score, domains, items, attention_method: method, education_level: education, education_years: null, notes }

  return <AssessmentDialog title="Mini-Exame do Estado Mental (MEEM)" onClose={onClose}
    result={`MEEM: ${score}/30 · ${confirmed ? cognitiveInterpretation(result) : 'Aplicação ainda não confirmada'}`}
    actions={close => <button type="button" className="primary" disabled={!confirmed} onClick={() => { close(); onSave(result) }}>Salvar MEEM</button>}>
    <p>Marque um ponto por acerto. Ao salvar, os itens desmarcados valem zero. O escore é de rastreio.</p>
    {value && !value.items && <p className="small-note">{value.score == null ? 'A avaliação anterior está incompleta.' : `Resultado anterior: ${value.score}/30.`} O novo resultado só substitui o anterior ao salvar.</p>}
    <label>Escolaridade
      <select value={education ?? ''} onChange={event => setEducation((event.target.value || null) as MiniMental['education_level'])}>
        <option value="">Não informada</option><option value="none">Analfabeto / 0 anos · corte 20</option>
        <option value="1_4">1–4 anos · corte 25</option><option value="5_8">5–8 anos · corte 26</option>
        <option value="over_8">Mais de 8 anos · corte 28</option>
      </select>
    </label>
    {cognitiveDomains.map(({ key, label, max }) => <fieldset className="assessment-group" key={key}>
      <legend>{label} <span className="muted">{domains[key]}/{max}</span></legend>
      {guide[key] && <p>{guide[key]}</p>}
      {key === 'attention' && <>
        <label>Método de atenção
          <select value={method} onChange={event => {
            setMethod(event.target.value as AttentionMethod)
            setItems(previous => ({ ...previous, attention: blankItems().attention }))
            setConfirmed(false)
          }}>
            <option value="serial_sevens">Subtrações sucessivas de 7</option>
            <option value="mundo_reverse">MUNDO ao contrário</option>
          </select>
        </label>
        <p>{method === 'serial_sevens' ? 'Peça para subtrair 7 de 100 sucessivamente: 93, 86, 79, 72, 65.' : 'Peça para soletrar M-U-N-D-O ao contrário. Marque cada letra na posição correta.'}</p>
      </>}
      {key === 'language' && <>
        <p>Mostre um relógio e uma caneta. Peça para repetir “Nem aqui, nem ali, nem lá”.</p>
        <p>Diga “Pegue o papel com a mão direita, dobre ao meio e coloque no chão”. Mostre por escrito “Feche os olhos” e peça que a pessoa leia e siga a instrução. Peça uma frase com sentido e a cópia da figura.</p>
        <svg className="assessment-figure" viewBox="0 0 168 105" role="img" aria-label="Dois pentágonos sobrepostos">
          <polygon points="10,55 35,15 81,23 98,67 54,94"/>
          <polygon points="70,54 108,19 155,36 152,82 105,91"/>
        </svg>
      </>}
      <div className="assessment-options">{(key === 'attention' && method === 'mundo_reverse' ? reverseMundo : questions[key]).map((item, index) =>
        <label key={item}><input type="checkbox" checked={items[key][index]} onChange={event => {
          const checked = event.target.checked
          setItems(previous => ({ ...previous, [key]: previous[key].map((answer, position) => position === index ? checked : answer) }))
        }}/>{item}</label>)}</div>
    </fieldset>)}
    <label>Observações<textarea rows={2} maxLength={1000} value={notes} onChange={event => setNotes(event.target.value)}/></label>
    <label className="assessment-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/>Confirmei a aplicação de todos os itens.</label>
  </AssessmentDialog>
}
