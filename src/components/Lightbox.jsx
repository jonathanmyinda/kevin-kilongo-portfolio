import { useEffect, useRef, useState } from 'react'
import Arrow from './Arrow'

export default function Lightbox({ images, initialIndex, trigger, onClose }) {
  const dialog = useRef(null)
  const [index, setIndex] = useState(initialIndex)
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)
  const closeTimer = useRef(null)
  const image = images[index]
  const move = (delta) => { if (!closingRef.current) setIndex((current) => (current + delta + images.length) % images.length) }
  const requestClose = () => {
    if (closingRef.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { onClose(); return }
    closingRef.current = true
    setClosing(true)
    closeTimer.current = window.setTimeout(onClose, 180)
  }

  useEffect(() => {
    const element = dialog.current
    const previousOverflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      window.clearTimeout(closeTimer.current)
      element.close()
      document.body.style.overflow = previousOverflow
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [trigger])

  return (
    <dialog ref={dialog} className="lightbox" data-closing={closing || undefined} aria-label="Visionneuse des visuels du projet" aria-describedby="lightbox-caption"
      onCancel={(event) => { event.preventDefault(); requestClose() }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) }
        if (event.key === 'ArrowRight') { event.preventDefault(); move(1) }
      }}>
      <div className="lightbox__bar">
        <span className="eyebrow" aria-live="polite" aria-atomic="true">Visuel {index + 1} / {images.length}</span>
        <button type="button" className="lightbox__close" onClick={requestClose} autoFocus>Fermer <span aria-hidden="true">×</span></button>
      </div>
      <figure className="lightbox__figure">
        <div className="lightbox__image"><img key={image.src} src={image.src} alt={image.alt} width={image.width} height={image.height} style={{ maxWidth: `min(${image.width}px, 100%)`, maxHeight: `min(${image.height}px, 65dvh)` }} /></div>
        <figcaption id="lightbox-caption">{image.alt}{image.credit && <span>Pour {image.credit}</span>}</figcaption>
      </figure>
      <div className="lightbox__controls">
        <button type="button" onClick={() => move(-1)} disabled={images.length < 2}><Arrow direction="left" /> Précédent</button>
        <span className="lightbox__hint">← → pour parcourir · Échap pour fermer</span>
        <button type="button" onClick={() => move(1)} disabled={images.length < 2}>Suivant <Arrow direction="right" /></button>
      </div>
    </dialog>
  )
}
