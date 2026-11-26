import { useEffect, useRef, useState } from 'react'
import GlassIcon from './GlassIcon'

export default function ProfilePhoto({ name, photo, onChange }: {
  name: string; photo: string; onChange: (photo: string) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const upload = useRef<HTMLInputElement>(null)
  const preview = useRef<HTMLCanvasElement>(null)
  const [source, setSource] = useState('')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(1)
  const [x, setX] = useState(50)
  const [y, setY] = useState(50)
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!source) return
    const img = new Image()
    img.onload = () => { setImage(img); setReady(true) }
    img.onerror = () => setError('Não foi possível ler a foto. Escolha outra imagem.')
    img.src = source
    return () => {
      img.onload = img.onerror = null
      if (source.startsWith('blob:')) URL.revokeObjectURL(source)
    }
  }, [source])

  useEffect(() => {
    const ctx = preview.current?.getContext('2d')
    if (!ctx || !image) return
    const side = Math.min(image.width, image.height) / zoom
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, 192, 192)
    ctx.drawImage(image, (image.width - side) * x / 100, (image.height - side) * y / 100, side, side, 0, 0, 192, 192)
  }, [image, zoom, x, y])

  function positionPhoto(axis: 'horizontal' | 'vertical', value: number) {
    if (!image) return
    const dimension = axis === 'horizontal' ? image.naturalWidth : image.naturalHeight
    const cropSize = Math.min(image.naturalWidth, image.naturalHeight) / zoom
    // Leave room to pan when the crop fills this dimension.
    if (dimension - cropSize < 1) setZoom(Math.min(3, zoom * 1.25))
    if (axis === 'horizontal') setX(value)
    else setY(value)
  }

  function show(src: string) {
    setError('')
    if (src !== source) { setReady(false); setImage(null); setSource(src) }
    setZoom(1); setX(50); setY(50)
    if (!dialog.current?.open) dialog.current?.showModal()
  }
  function edit() {
    if (photo) show(photo)
    else upload.current?.click()
  }
  function finish(value: string) {
    onChange(value)
    dialog.current?.close()
  }
  const action = photo ? 'Editar foto' : 'Escolher foto'
  return <>
    <div className="profile-identity">
      <button type="button" className="profile-portrait" aria-label={action + ' de perfil'} onClick={edit}>
        {photo ? <img src={photo} alt=""/> : <GlassIcon name="perfil" size={42}/>}
      </button>
      <div><strong>{name.trim() || 'Foto de perfil'}</strong>
        <div className="photo-actions"><button type="button" className="text-button" onClick={edit}>{action}</button></div>
      </div>
    </div>
    <input hidden ref={upload} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
        setError('Escolha uma imagem JPG, PNG ou WebP de até 8 MB.')
        return
      }
      show(URL.createObjectURL(file))
    }}/>
    {error && !dialog.current?.open && <p role="alert">{error}</p>}
    <dialog className="workspace-dialog profile-photo-editor" ref={dialog} aria-label="Editar foto de perfil"
      onClose={() => { setSource(''); setImage(null); setReady(false); setError('') }}>
      <h2>Editar foto de perfil</h2>
      <canvas ref={preview} width={192} height={192} aria-label="Prévia da foto de perfil"/>
      <label>Zoom<input type="range" min="1" max="3" step="0.05" value={zoom} onChange={e => setZoom(e.target.valueAsNumber)}/></label>
      <label>Posição horizontal<input type="range" min="0" max="100" value={x} disabled={!ready} onChange={e => positionPhoto('horizontal', e.target.valueAsNumber)}/></label>
      <label>Posição vertical<input type="range" min="0" max="100" value={y} disabled={!ready} onChange={e => positionPhoto('vertical', e.target.valueAsNumber)}/></label>
      {error && <p role="alert">{error}</p>}
      <div className="photo-actions">
        <button type="button" className="text-button" onClick={() => upload.current?.click()}>Trocar foto</button>
        {photo && <button type="button" className="text-button" onClick={() => finish('')}>Remover foto</button>}
      </div>
      <div className="start-actions">
        <button type="button" className="primary" disabled={!ready} onClick={() => {
          if (preview.current) finish(preview.current.toDataURL('image/jpeg', 0.86))
        }}>Aplicar foto</button>
        <button type="button" className="secondary" onClick={() => dialog.current?.close()}>Cancelar</button>
      </div>
    </dialog>
  </>
}
