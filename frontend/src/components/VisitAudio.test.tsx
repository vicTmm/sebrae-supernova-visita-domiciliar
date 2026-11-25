// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import VisitAudio from './VisitAudio'
const mocks = vi.hoisted(() => ({ list: vi.fn(), seal: vi.fn(), add: vi.fn(), stopTrack: vi.fn(), getMedia: vi.fn(), open: vi.fn(), get: vi.fn(), remove: vi.fn() }))
vi.mock('../services/audioVault', () => ({
  CONSENT_VERSION: 'audio-review-v1', MAX_AUDIO_BYTES: 32 * 1024 * 1024, MAX_AUDIO_SECONDS: 900,
  listAudio: mocks.list, sealAudio: mocks.seal, storeAudio: mocks.add, openAudio: mocks.open, audioDb: { clips: { add: mocks.add, get: mocks.get, delete: mocks.remove } },
}))
class FakeRecorder {
  static isTypeSupported() { return true }
  static latest: FakeRecorder
  state = 'inactive'; mimeType = 'audio/webm'
  ondataavailable?: (e: { data: Blob }) => void
  onstop?: () => void
  onerror?: () => void
  constructor() { FakeRecorder.latest = this }
  start() { this.state = 'recording' }
  pause() { this.state = 'paused' }
  resume() { this.state = 'recording' }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['test']) }); this.onstop?.() }
}
beforeEach(() => {
  vi.stubGlobal('isSecureContext', true); vi.stubGlobal('MediaRecorder', FakeRecorder)
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: mocks.getMedia } })
  mocks.getMedia.mockResolvedValue({ getTracks: () => [{ stop: mocks.stopTrack }], getAudioTracks: () => [] })
  mocks.list.mockResolvedValue([]); mocks.add.mockResolvedValue('clip'); mocks.seal.mockResolvedValue({ id: 'clip' })
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks() })
function setup() {
  render(<VisitAudio visitId="visita-teste" professional="Profissional fictício / TESTE" onBusy={vi.fn()}/> )
  fireEvent.click(screen.getByText('Nova gravação'))
  fireEvent.change(screen.getByLabelText('Senha do áudio (mínimo 12 caracteres)'), { target: { value: 'senha exclusiva de teste' } })
  fireEvent.change(screen.getByLabelText('Repita a senha'), { target: { value: 'senha exclusiva de teste' } })
}
it('só solicita microfone após confirmação e salva autorização junto ao áudio; pausa e libera o microfone', async () => {
  setup()
  expect((screen.getByText('Iniciar gravação') as HTMLButtonElement).disabled).toBe(true)
  expect(mocks.getMedia).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByText('Iniciar gravação'))
  await screen.findByText('Encerrar e salvar')
  expect(mocks.getMedia).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByText('Pausar')); expect(FakeRecorder.latest.state).toBe('paused')
  fireEvent.click(screen.getByText('Retomar')); expect(FakeRecorder.latest.state).toBe('recording')
  fireEvent.click(screen.getByText('Encerrar e salvar'))
  await screen.findByText(/Áudio salvo e criptografado/)
  expect(mocks.seal.mock.calls[0][1]).toBe('visita-teste')
  expect(mocks.seal.mock.calls[0][3]).toMatchObject({ mode: 'dictation', authorizedBy: 'professional', professional: 'Profissional fictício / TESTE' })
  expect(mocks.stopTrack).toHaveBeenCalled()
  expect((screen.getByLabelText('Senha do áudio (mínimo 12 caracteres)') as HTMLInputElement).value).toBe('')
})
it('preserva gravação para nova tentativa quando o disco falha e encerra ao ocultar aba', async () => {
  mocks.add.mockRejectedValueOnce(new Error('Sem espaço'))
  setup(); fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByText('Iniciar gravação'))
  await screen.findByText('Encerrar e salvar')
  Object.defineProperty(document, 'hidden', { configurable: true, value: true })
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  await screen.findByText('Tentar salvar novamente')
  expect(mocks.stopTrack).toHaveBeenCalled()
  fireEvent.click(screen.getByText('Tentar salvar novamente'))
  await screen.findByText(/Áudio salvo e criptografado/)
  expect(mocks.add).toHaveBeenCalledTimes(2)
})
it('explica permissão negada sem deixar a sessão ocupada', async () => {
  mocks.getMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'))
  setup(); fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByText('Iniciar gravação'))
  await screen.findByText(/Microfone não autorizado/)
  await waitFor(() => expect((screen.getByText('Iniciar gravação') as HTMLButtonElement).disabled).toBe(false))
  expect(mocks.add).not.toHaveBeenCalled()
})

it('revoga o player ao ocultar a aba e permite excluir sem apagar a evolução', async () => {
  const row = { id: 'clip', createdAt: Date.now(), expiresAt: Date.now() + 86400000, duration: 12 }
  mocks.list.mockResolvedValue([row]); mocks.get.mockResolvedValue(row)
  mocks.open.mockResolvedValue({ blob: new Blob(['audio']), consent: { professional: 'Teste', mode: 'dictation', acceptedAt: new Date().toISOString() } })
  const revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:audio-test'), revokeObjectURL: revoke })
  render(<VisitAudio visitId="visita-teste" professional="Profissional fictício / TESTE" onBusy={vi.fn()}/> )
  fireEvent.click(await screen.findByText('Desbloquear para ouvir'))
  fireEvent.change(screen.getByLabelText('Senha desta gravação'), { target: { value: 'senha de teste' } })
  fireEvent.click(screen.getByText('Ouvir áudio'))
  await screen.findByLabelText('Reprodução do áudio da visita')
  Object.defineProperty(document, 'hidden', { configurable: true, value: true })
  // JSDOM não implementa reprodução, mas a chamada de pausa é verificada.
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  expect(screen.queryByLabelText('Reprodução do áudio da visita')).toBeNull()
  expect(revoke).toHaveBeenCalledWith('blob:audio-test'); expect(pause).toHaveBeenCalled()
  fireEvent.click(screen.getByText('Excluir áudio'))
  expect(mocks.remove).not.toHaveBeenCalled()
  mocks.list.mockResolvedValue([])
  fireEvent.click(screen.getByText('Confirmar exclusão do áudio'))
  await screen.findByText(/Áudio excluído deste dispositivo/)
  expect(mocks.remove).toHaveBeenCalledWith('clip')
})
