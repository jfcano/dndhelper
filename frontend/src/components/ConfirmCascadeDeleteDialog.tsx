import { useEffect, useRef } from 'react'

export type ConfirmCascadeDeleteDialogProps = {
  open: boolean
  onClose: () => void
  title: string
  description: string
  /** Elementos que también se eliminarán o perderán */
  details?: string[]
  /** Encabezado de la lista de detalles (por defecto: texto de borrados en cascada) */
  detailsSectionTitle?: string
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  /** Texto del botón de confirmación mientras `busy` (p. ej. «Vaciando…») */
  busyLabel?: string
  onConfirm: () => void | Promise<void>
  /** `large`: modal más ancho (avisos críticos). `highRisk`: refuerzo visual + cabecera de riesgo */
  size?: 'default' | 'large'
  highRisk?: boolean
}

/**
 * Diálogo modal para borrados: avisa de datos dependientes y exige confirmación.
 */
export function ConfirmCascadeDeleteDialog({
  open,
  onClose,
  title,
  description,
  details,
  detailsSectionTitle = 'También se perderá o eliminará:',
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  busy = false,
  busyLabel = 'Eliminando…',
  onConfirm,
  size = 'default',
  highRisk = false,
}: ConfirmCascadeDeleteDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open) {
      if (!el.open) el.showModal()
    } else if (el.open) {
      el.close()
    }
  }, [open])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onDialogClose = () => {
      if (!busy) onClose()
    }
    el.addEventListener('close', onDialogClose)
    return () => el.removeEventListener('close', onDialogClose)
  }, [busy, onClose])

  async function handleConfirm() {
    if (busy) return
    await onConfirm()
  }

  const maxWidth = size === 'large' ? 580 : 440
  const padX = size === 'large' ? 24 : 20
  const padY = size === 'large' ? 22 : 18

  return (
    <dialog
      ref={ref}
      className={highRisk ? 'confirm-cascade-delete-dialog confirm-cascade-delete-dialog--high-risk' : 'confirm-cascade-delete-dialog'}
      style={{
        maxWidth,
        width: 'calc(100% - 24px)',
        border: highRisk ? '1px solid var(--danger-border)' : '1px solid var(--border-subtle)',
        borderRadius: 12,
        padding: 0,
        background: 'var(--card-panel-bg)',
        color: 'var(--text)',
        boxShadow: highRisk
          ? '0 16px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(180, 50, 65, 0.12)'
          : '0 12px 40px rgba(0,0,0,0.35)',
      }}
    >
      {highRisk ? (
        <div
          style={{
            padding: `${padY}px ${padX}px 16px`,
            background: 'var(--danger-bg)',
            borderBottom: '1px solid var(--danger-border)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--heading)',
              fontSize: size === 'large' ? '1.08rem' : '1rem',
              letterSpacing: '0.04em',
              color: 'var(--danger)',
            }}
          >
            Riesgo alto — operación irreversible
          </p>
          <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.55, opacity: 0.95 }}>
            No hay papelera: lo que se borre del índice y del disco de subidas no se puede recuperar. Las campañas,
            mundos y sesiones en la base de datos <strong>no</strong> se eliminan, pero dejarás de tener consultas RAG
            sobre esas fuentes hasta que vuelvas a subir e indexar documentos.
          </p>
        </div>
      ) : null}
      <div style={{ padding: `${padY}px ${padX}px ${highRisk ? 18 : 16}px` }}>
        <h3
          style={{
            margin: '0 0 12px',
            fontFamily: 'var(--heading)',
            fontSize: highRisk ? '1.2rem' : '1.05rem',
            color: 'var(--text-heading)',
            lineHeight: 1.3,
          }}
        >
          {title}
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: highRisk ? 15 : 14, lineHeight: 1.55, opacity: 0.92 }}>{description}</p>
        {details && details.length > 0 ? (
          <div
            style={{
              marginBottom: 14,
              padding: '12px 14px',
              borderRadius: 8,
              background: 'var(--table-shell-bg)',
              border: '1px solid var(--border-subtle)',
              fontSize: highRisk ? 14 : 13,
              lineHeight: 1.55,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8, opacity: 0.92 }}>{detailsSectionTitle}</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p style={{ margin: 0, fontSize: 12, color: 'var(--danger)', opacity: 0.98 }}>Esta acción no se puede deshacer.</p>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          padding: '12px 16px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--table-shell-bg)',
        }}
      >
        <button type="button" disabled={busy} onClick={() => ref.current?.close()}>
          {cancelLabel}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleConfirm()}
          style={{
            background: 'var(--danger-button)',
            color: 'var(--danger-button-text)',
            border: 'none',
            borderRadius: 8,
            padding: highRisk ? '10px 18px' : '8px 14px',
            fontSize: highRisk ? 15 : undefined,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
