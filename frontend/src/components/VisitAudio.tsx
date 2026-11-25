import GlassIcon from './GlassIcon'
import { useEffect, useRef, useState } from 'react'
import { LockKeyhole, Pause, Play, Square, Trash2 } from 'lucide-react'
import { audioDb, CONSENT_VERSION, listAudio, MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS, openAudio, sealAudio, storeAudio, type AudioConsent, type StoredAudio } from '../services/audioVault'

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
export default function VisitAudio({ visitId, onBusy, professional }: { professional: string; visitId: string; onBusy: (busy: boolean) => void }) {
  const [clips, setClips] = useState<StoredAudio[]>([])
  const [mode, setMode] = useState<AudioConsent['mode']>('dictation')
  const [authorizedBy, setAuthorizedBy] = useState<'patient' | 'representative'>('patient')
  const [consent, setConsent] = useState(false)
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState(''), [days, setDays] = useState(1)
  const [status, setStatus] = useState<'idle' | 'requesting' | 'recording' | 'paused' | 'saving' | 'retry'>('idle')
  const [seconds, setSeconds] = useState(0), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [opened, setOpened] = useState<{ id: string; url: string; consent: AudioConsent } | null>(null)
  const [unlockId, setUnlockId] = useState(''), [unlockPassword, setUnlockPassword] = useState(''), [unlocking, setUnlocking] = useState(false)
  const [deleteId, setDeleteId] = useState('')
  const recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null)
  const mounted = useRef(true), busyRef = useRef(false), tick = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const pending = useRef<{ blob: Blob; secret: string; consent: AudioConsent; seconds: number; days: number } | null>(null)
  const unlockEpoch = useRef(0)
  const player = useRef<HTMLAudioElement>(null), openedUrl = useRef(''), lastActivity = useRef(Date.now())
  const supported = window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined' && Boolean(crypto.subtle)
  function lock() {
    unlockEpoch.current++
    player.current?.pause()
    if (openedUrl.current) URL.revokeObjectURL(openedUrl.current)
    openedUrl.current = ''; setOpened(null); setUnlockPassword('')
  }
  function setBusy(value: boolean) { busyRef.current = value; onBusy(value) }
  function release() { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; clearInterval(tick.current) }
  async function refresh() { const rows = await listAudio(visitId); if (mounted.current) setClips(rows) }
  useEffect(() => {
    mounted.current = true
    void refresh().catch(() => setError('Não foi possível abrir o armazenamento de áudio. Verifique as permissões do navegador.'))
    const preventExit = (e: BeforeUnloadEvent) => { if (busyRef.current) { e.preventDefault(); e.returnValue = '' } }
    const activity = () => { lastActivity.current = Date.now() }
    const hide = () => {
      if (document.hidden) {
        lock()
        // Interromper e salvar evita capturar uma conversa fora do contexto da visita.
        if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop()
      }
    }
    const cleanupTimer = setInterval(() => {
      void refresh().catch(() => {})
      if (Date.now() - lastActivity.current > 5 * 60000) lock()
    }, 15000)
    window.addEventListener('beforeunload', preventExit)
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('pointerdown', activity); window.addEventListener('keydown', activity)
    return () => {
      mounted.current = false; clearInterval(cleanupTimer); release()
      if (recorder.current) { recorder.current.onstop = null; recorder.current.ondataavailable = null; if (recorder.current.state !== 'inactive') recorder.current.stop() }
      pending.current = null
      if (openedUrl.current) URL.revokeObjectURL(openedUrl.current)
      window.removeEventListener('beforeunload', preventExit); document.removeEventListener('visibilitychange', hide)
      window.removeEventListener('pointerdown', activity); window.removeEventListener('keydown', activity)
    }
  }, [visitId])
  useEffect(() => {
    if (opened && !clips.some(c => c.id === opened.id && c.expiresAt > Date.now())) lock()
  }, [clips, opened])

  useEffect(() => {
    if (!opened) return
    const row = clips.find(c => c.id === opened.id)
    if (!row) return
    const timeout = setTimeout(lock, Math.max(0, row.expiresAt - Date.now()))
    return () => clearTimeout(timeout)
  }, [clips, opened])

  async function persist() {
    const data = pending.current
    if (!data) return
    setStatus('saving')
    try {
      const row = await sealAudio(data.blob, visitId, data.secret, data.consent, data.seconds, data.days)
      await storeAudio(row)
      pending.current = null; setPassword(''); setConfirmation(''); setConsent(false)
      if (mounted.current) {
        setStatus('idle'); setBusy(false); await refresh().catch(() => setError('Áudio salvo. Reabra a visita para atualizar a lista.'))
        setMessage('Áudio salvo e criptografado neste dispositivo. Use a senha para ouvir.')
      }
    } catch (e) {
      if (mounted.current) { setStatus('retry'); setError(`${(e as Error).message} A gravação permanece na memória. Tente salvar novamente antes de sair.`) }
    }
  }
  async function start() {
    if (busyRef.current || !supported) return
    if (!professional.trim() || !consent || password.length < 12 || password !== confirmation) {
      setError('Informe o profissional, confirme a autorização e repita uma senha com pelo menos 12 caracteres.'); return
    }
    lock(); setError(''); setMessage(''); setSeconds(0); setStatus('requesting'); setBusy(true)
    const details: AudioConsent = { professional: professional.trim(), mode, authorizedBy: mode === 'dictation' ? 'professional' : authorizedBy, acceptedAt: new Date().toISOString(), version: CONSENT_VERSION }
    const secret = password, retention = days
    let chunks: Blob[] = [], bytes = 0, elapsed = 0, lastTick = performance.now()
    try {
      if ((await listAudio(visitId)).length >= 5) throw new Error('Limite de cinco áudios por visita. Exclua um áudio antes de gravar outro.')
      const media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false })
      if (!mounted.current || document.hidden) { media.getTracks().forEach(t => t.stop()); throw new Error('Mantenha a visita aberta para iniciar a gravação.') }
      stream.current = media
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported(t))
      const rec = new MediaRecorder(media, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 64000 })
      recorder.current = rec
      rec.ondataavailable = e => {
        if (e.data.size) {
          if (bytes + e.data.size > MAX_AUDIO_BYTES) { setError('Limite de 32 MB atingido. O trecho anterior será salvo.'); if (rec.state !== 'inactive') rec.stop(); return }
          chunks.push(e.data); bytes += e.data.size
        }
      }
      rec.onerror = () => { setError('Gravação interrompida pelo navegador. O trecho disponível será salvo.'); if (rec.state !== 'inactive') rec.stop() }
      rec.onstop = () => {
        release(); recorder.current = null
        const blob = new Blob(chunks, { type: rec.mimeType || chunks[0]?.type || 'audio/webm' }); chunks = []
        if (!blob.size) { setStatus('idle'); setBusy(false); setError('Nenhum áudio foi capturado. Confira o microfone e tente novamente.'); return }
        pending.current = { blob, secret, consent: details, seconds: Math.min(elapsed, MAX_AUDIO_SECONDS), days: retention }
        void persist()
      }
      rec.start(1000); setStatus('recording'); lastTick = performance.now()
      tick.current = setInterval(() => {
        const now = performance.now()
        if (rec.state === 'recording') elapsed += (now - lastTick) / 1000
        lastTick = now; setSeconds(Math.floor(elapsed))
        if (elapsed >= MAX_AUDIO_SECONDS && rec.state !== 'inactive') { setMessage('Limite de 15 minutos atingido.'); rec.stop() }
      }, 250)
      media.getAudioTracks().forEach(track => { track.onended = () => { if (rec.state !== 'inactive') rec.stop() } })
    } catch (e) {
      release(); setBusy(false); setStatus('idle')
      const name = (e as DOMException).name
      setError(name === 'NotAllowedError' ? 'Microfone não autorizado. Libere o acesso nas permissões do navegador e tente novamente.' : name === 'NotFoundError' ? 'Nenhum microfone disponível neste dispositivo.' : (e as Error).message)
    }
  }
  async function unlock(row: StoredAudio) {
    const epoch = ++unlockEpoch.current
    setUnlocking(true); setError('')
    try {
      const { blob, consent: details } = await openAudio(row, unlockPassword)
      if (!mounted.current || document.hidden || epoch !== unlockEpoch.current) return
      // Revalidar após a derivação da chave, inclusive exclusão em outra aba.
      if (!await audioDb.clips.get(row.id) || row.expiresAt <= Date.now()) throw new Error('Este áudio foi excluído ou expirou.')
      if (epoch !== unlockEpoch.current) return
      lock(); const url = URL.createObjectURL(blob); openedUrl.current = url
      lastActivity.current = Date.now(); setOpened({ id: row.id, url, consent: details }); setUnlockId('')
    } catch (e) { setError((e as Error).message) }
    finally { setUnlockPassword(''); setUnlocking(false) }
  }
  async function remove(id: string) {
    try { await audioDb.clips.delete(id); if (opened?.id === id) lock(); setDeleteId(''); await refresh(); setMessage('Áudio excluído deste dispositivo. A evolução foi preservada.') }
    catch { setError('Não foi possível excluir. Tente novamente.') }
  }
  const busy = status !== 'idle'
  return <section id="visit-audio" tabIndex={-1} className="panel visit-section visit-audio" aria-labelledby="visit-audio-title">
    <div className="audio-heading"><GlassIcon name="audio" size={30}/><div><h2 id="visit-audio-title">Áudio da visita</h2><p>Grave um relato ou o atendimento para conferir durante a revisão.</p></div></div>
    <p className="small-note">Áudios criptografados, somente neste navegador. Não são enviados à API nem à IA. A senha não pode ser recuperada. Ao limpar os dados do site, os áudios serão perdidos.</p>
    {!supported && <p role="alert" className="error">A gravação exige HTTPS ou localhost, um navegador com suporte a áudio e acesso ao microfone.</p>}
    <details className="audio-setup" open={busy || undefined}>
      <summary>Nova gravação</summary>
      <fieldset disabled={busy || !supported}>
        <label>Tipo de gravação<select value={mode} onChange={e => { setMode(e.target.value as AudioConsent['mode']); setConsent(false) }}><option value="dictation">Relato ditado pelo profissional</option><option value="encounter">Conversa do atendimento</option></select></label>
        <p>Profissional responsável: {professional || 'Complete o nome e o CRM em Meu perfil para gravar.'}</p>
        {mode === 'encounter' && <label>Quem autorizou a gravação?<select value={authorizedBy} onChange={e => { setAuthorizedBy(e.target.value as typeof authorizedBy); setConsent(false) }}><option value="patient">Paciente</option><option value="representative">Responsável legal</option></select></label>}
        <p className="small-note">Finalidade: conferir o registro clínico desta visita. A gravação é opcional; recusar não impede o atendimento. Explique quem poderá ouvir neste dispositivo, o prazo e a possibilidade de exclusão.</p>
        <label className="audio-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/><span>{mode === 'encounter' ? 'Confirmei a autorização livre do paciente ou responsável após explicar a finalidade, o acesso e o prazo. Todas as pessoas que terão a voz gravada foram informadas e concordaram.' : 'Autorizo gravar meu relato para revisão e confirmo que não gravarei vozes de outras pessoas neste modo.'}</span></label>
        <div className="audio-fields"><label>Senha do áudio (mínimo 12 caracteres)<input type="password" autoComplete="new-password" minLength={12} maxLength={256} value={password} onChange={e => setPassword(e.target.value)}/></label><label>Repita a senha<input type="password" autoComplete="new-password" maxLength={256} value={confirmation} onChange={e => setConfirmation(e.target.value)}/></label></div>
        <label>Prazo para revisão<select value={days} onChange={e => setDays(Number(e.target.value))}><option value={1}>24 horas (recomendado)</option><option value={7}>7 dias</option></select></label>
        <p className="small-note">Após o prazo, o acesso é bloqueado e o arquivo é removido na próxima abertura ou enquanto o app estiver aberto. Use uma senha forte e exclusiva. O áudio não substitui a evolução revisada.</p>
        <button type="button" className="secondary" disabled={!consent || !professional.trim() || password.length < 12 || password !== confirmation} onClick={() => void start()}><GlassIcon name="audio" size={22}/>Iniciar gravação</button>
      </fieldset>
    </details>
    {busy && <div className="audio-session"><p role="status">{status === 'requesting' ? 'Aguardando permissão do microfone…' : status === 'saving' ? 'Criptografando e salvando…' : status === 'retry' ? 'Gravação aguardando salvamento' : `${status === 'paused' ? 'Pausado' : 'Gravando'} · ${clock(seconds)} / 15:00`}</p>
      {(status === 'recording' || status === 'paused') && <div className="audio-actions"><button type="button" className="secondary" onClick={() => { const r = recorder.current; if (r?.state === 'recording') { r.pause(); setStatus('paused') } else if (r?.state === 'paused') { r.resume(); setStatus('recording') } }}>{status === 'paused' ? <Play size={16}/> : <Pause size={16}/>} {status === 'paused' ? 'Retomar' : 'Pausar'}</button><button type="button" className="primary" onClick={() => recorder.current?.stop()}><Square size={16}/>Encerrar e salvar</button></div>}
      {status === 'retry' && <div className="audio-actions"><button type="button" className="primary" onClick={() => { setError(''); void persist() }}>Tentar salvar novamente</button><button type="button" className="secondary" onClick={() => { if (confirm('Descartar o áudio ainda não salvo? Não será possível recuperá-lo.')) { pending.current = null; setStatus('idle'); setBusy(false); setPassword(''); setConfirmation(''); setError('') } }}>Descartar gravação</button></div>}
      <p className="small-note">Mantenha esta página aberta até salvar. Ao ocultar a aba, a gravação é encerrada e salva. Fechar o navegador ou desligar o aparelho antes de salvar pode perder o áudio.</p></div>}
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="small-note">{message}</p>}
    <div className="audio-clips">{!clips.length && <p className="small-note">Nenhum áudio salvo para esta visita.</p>}{clips.map((row, index) => <article className="audio-clip" key={row.id}>
      <h3>Gravação {clips.length - index} · {clock(row.duration)}</h3><p className="small-note">{new Date(row.createdAt).toLocaleString('pt-BR')} · Prazo: {new Date(row.expiresAt).toLocaleString('pt-BR')}</p>
      {opened?.id === row.id ? <><audio ref={player} controls preload="metadata" src={opened.url} aria-label="Reprodução do áudio da visita"/><p className="small-note">Registrado por {opened.consent.professional}. {opened.consent.mode === 'dictation' ? 'Relato do profissional.' : `Atendimento autorizado por ${opened.consent.authorizedBy === 'patient' ? 'paciente' : 'responsável legal'}.`} Autorização registrada em {new Date(opened.consent.acceptedAt).toLocaleString('pt-BR')}.</p><button type="button" className="text-button" onClick={lock}><LockKeyhole size={16}/>Bloquear áudio</button></> : <button type="button" className="text-button" disabled={busy || unlocking} onClick={() => { lock(); setUnlockId(row.id); setError('') }}><LockKeyhole size={16}/>Desbloquear para ouvir</button>}
      {unlockId === row.id && <div className="audio-unlock"><label>Senha desta gravação<input type="password" autoComplete="off" value={unlockPassword} onChange={e => setUnlockPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (!unlocking) void unlock(row) } }}/></label><button type="button" className="secondary" disabled={unlocking || !unlockPassword} onClick={() => void unlock(row)}>{unlocking ? 'Desbloqueando…' : 'Ouvir áudio'}</button><button type="button" className="text-button" disabled={unlocking} onClick={() => { setUnlockId(''); setUnlockPassword('') }}>Cancelar</button></div>}
      {deleteId === row.id ? <div className="audio-delete"><p>Excluir definitivamente este áudio e o registro da autorização? A evolução será mantida. Esta ação também pode atender a uma solicitação de retirada da autorização.</p><button type="button" className="secondary" onClick={() => void remove(row.id)}>Confirmar exclusão do áudio</button><button type="button" className="text-button" onClick={() => setDeleteId('')}>Cancelar</button></div> : <button type="button" className="text-button" disabled={busy || unlocking} onClick={() => setDeleteId(row.id)}><Trash2 size={16}/>Excluir áudio</button>}
    </article>)}</div>
    <p className="small-note">O player bloqueia ao ocultar a aba ou após 5 minutos sem interação. Quem tiver a senha e acesso a este navegador poderá ouvir. Ainda não há identificação por conta ou compartilhamento entre dispositivos.</p>
  </section>
}
