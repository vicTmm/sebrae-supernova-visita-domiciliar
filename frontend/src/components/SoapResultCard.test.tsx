// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import SoapResultCard from './SoapResultCard'
import { exampleVisit } from '../types/visit'
import { localSoapOutput } from '../services/soap'

afterEach(cleanup)

const visit = exampleVisit()

function Review() {
  const [result, setResult] = useState(() => localSoapOutput(visit))
  return <>
    <SoapResultCard visit={visit} result={result} onChange={setResult} onVitalsChange={() => false}
      onAI={() => {}} busy={false} onSave={() => {}} serverAvailable={false}/>
    <output data-testid="full">{result.full_text_fallback}</output>
  </>
}

it('mostra o bloco A vazio e só o inclui na evolução completa quando preenchido', () => {
  render(<Review/>)
  const assessment = screen.getByLabelText('Avaliação diagnóstica') as HTMLTextAreaElement
  expect(assessment.value).toBe('')
  expect(screen.getByText('A', { selector: '.soap-letter' })).toBeTruthy()
  expect(screen.getByTestId('full').textContent).not.toContain('\nA:')
  fireEvent.change(assessment, { target: { value: 'Hipótese: pneumonia em resolução.' } })
  expect(assessment.value).toBe('Hipótese: pneumonia em resolução.')
  expect(screen.getByTestId('full').textContent).toContain('A: Hipótese: pneumonia em resolução.')
})
