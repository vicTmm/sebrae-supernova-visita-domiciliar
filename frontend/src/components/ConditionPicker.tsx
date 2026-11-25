import { useId, useRef, useState } from 'react'
import { Check, Search, X } from 'lucide-react'
import type { Visit } from '../types/visit'

type Condition = Visit['conditions'][number]
type Props = {
  options: Condition[]
  value: Condition[]
  onChange: (conditions: Condition[]) => void
}

const searchAliases: Partial<Record<Condition, string>> = {
  Hipertenso: 'hipertensão arterial HAS', Diabético: 'diabetes mellitus DM',
  'AVC prévio': 'derrame acidente vascular cerebral', 'Infarto prévio': 'IAM infarto do miocárdio',
  'Doença renal crônica': 'DRC', 'Câncer': 'neoplasia', 'Lesão por pressão': 'escara úlcera por pressão',
  'Doença de Alzheimer': 'demência', 'DPOC/pneumopata': 'doença pulmonar obstrutiva crônica',
}

function searchable(text: string) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

export default function ConditionPicker({ options, value, onChange }: Props) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const matches = options.filter(option => option !== 'Outra' && searchable(option + ' ' + (searchAliases[option] ?? '')).includes(searchable(query)))

  function close() {
    setOpen(false)
    setQuery('')
    setActive(-1)
  }

  function toggle(option: Condition) {
    onChange(value.includes(option) ? value.filter(item => item !== option) : [...value, option])
    setQuery('')
    setActive(-1)
  }

  return <div className="condition-picker">
    <div className="condition-search">
      <Search size={17} aria-hidden="true"/>
      <input ref={input} role="combobox" aria-label="Buscar condições acompanhadas" autoComplete="off"
        aria-autocomplete="list" aria-controls={id} aria-expanded={open}
        aria-activedescendant={open && matches[active] ? id + '-' + active : undefined}
        placeholder="Busque ou selecione uma condição" value={query}
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onBlur={close}
        onChange={event => { setQuery(event.target.value); setActive(-1); setOpen(true) }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return
          if (event.key === 'Escape' && open) { event.preventDefault(); close() }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
            if (!matches.length) return
            const next = event.key === 'ArrowDown' ? Math.min(active + 1, matches.length - 1)
              : active < 0 ? matches.length - 1 : Math.max(active - 1, 0)
            setActive(next)
            requestAnimationFrame(() => list.current?.children[next]?.scrollIntoView({ block: 'nearest' }))
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            if (!open) setOpen(true)
            else if (matches[active] || matches.length === 1) toggle(matches[active] ?? matches[0])
          }
        }}/>
    </div>
    <ul id={id} ref={list} hidden={!open || !matches.length} role="listbox" aria-label="Condições disponíveis" aria-multiselectable="true">
      {matches.map((option, index) => <li key={option} id={id + '-' + index} role="option"
        aria-selected={value.includes(option)} data-active={active === index}
        onMouseDown={event => event.preventDefault()} onClick={() => toggle(option)}>
        {option}{value.includes(option) && <Check size={17} aria-hidden="true"/>}
      </li>)}
    </ul>
    {open && !matches.length && <p className="small-note" role="status">Nenhuma condição encontrada.</p>}
    {!value.includes('Outra') && <button type="button" className="text-button"
      onMouseDown={event => event.preventDefault()} onClick={() => { close(); toggle('Outra') }}>Outra</button>}
    {value.length > 0 && <div className="choices" aria-label="Condições selecionadas">{value.map(option =>
      <button key={option} type="button" className="chip selected" aria-label={'Remover ' + option}
        onClick={() => { toggle(option); input.current?.focus() }}>{option}<X size={14} aria-hidden="true"/></button>
    )}</div>}
  </div>
}
