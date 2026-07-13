import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'

interface Props {
  onDetected: (codigo: string) => void
  onClose: () => void
}

/** Abre a câmera e lê o código de barras (EAN-13). Câmera traseira quando disponível. */
export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let controls: IScannerControls | undefined
    let cancelado = false

    reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current!,
        (result) => {
          if (result && !cancelado) {
            cancelado = true
            controls?.stop()
            onDetected(result.getText())
          }
        },
      )
      .then((c) => {
        controls = c
        if (cancelado) c.stop()
      })
      .catch(() => setErro('Não consegui acessar a câmera. Use a opção manual.'))

    return () => {
      cancelado = true
      controls?.stop()
    }
  }, [onDetected])

  return (
    <div
      role="dialog"
      aria-label="Leitor de código de barras"
      style={{
        position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.85)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 18,
      }}
    >
      <div style={{ width: '100%', maxWidth: 480, textAlign: 'center', color: '#fff' }}>
        <p style={{ marginBottom: 12 }}>Aponte a câmera para o código de barras</p>
        {erro ? (
          <p className="card" style={{ color: 'var(--danger)' }}>{erro}</p>
        ) : (
          <video
            ref={videoRef}
            style={{ width: '100%', borderRadius: 16, background: '#000', aspectRatio: '4/3', objectFit: 'cover' }}
            muted
            playsInline
          />
        )}
        <button className="btn btn-block" style={{ marginTop: 16 }} onClick={onClose}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
