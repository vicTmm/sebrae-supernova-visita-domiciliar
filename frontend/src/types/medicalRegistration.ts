export const registrationStates = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

// O CFM também usa o sufixo P e o prefixo EME em inscrições específicas.
export function validRegistrationNumber(number: string) {
  return /^(?:[0-9]{1,9}P?|EME[0-9]{1,9})$/.test(number) && /[1-9]/.test(number)
}

export function formatRegistration(number: string, state: string) {
  const normalized = number.trim().toUpperCase()
  return registrationStates.includes(state) && validRegistrationNumber(normalized)
    ? `CRM-${state} ${normalized}`
    : ''
}

export function readRegistration(value = '') {
  const text = value.trim().toUpperCase().replace(/^CRM[\s/-]*/, '')
  const stateFirst = /^([A-Z]{2})[\s/-]+(.+)$/.exec(text)
  const stateLast = /^(.+?)[\s/-]+([A-Z]{2})$/.exec(text)
  const state = stateFirst?.[1] ?? stateLast?.[2] ?? ''
  const number = stateFirst?.[2] ?? stateLast?.[1] ?? text
  return { number, state: registrationStates.includes(state) ? state : '' }
}
