import { useEffect, useRef } from 'react'

export type ConfirmCascadeDeleteDialogProps = {
  open: boolean
  onClose: () => void
  title: string
  description: string
  /** Elementos que también se eliminarán o perderán */
  details?: string[]
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: () => void | Promise<void>
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
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  busy = false,
  onConfirm,
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

  return (
    <dialog
      ref={ref}
      className="confirm-cascade-delete-dialog"
      style={{
        maxWidth: 440,
        width: 'calc(100% - 24px)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        padding: 0,
        background: 'var(--card-panel-bg)',
        color: 'var(--text)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
      }}
    >
      <div style={{ padding: '18px 20px 16px' }}>
        <h3 style={{ margin: '0 0 10px', fontFamily: 'var(--heading)', fontSize: '1.05rem', color: 'var(--text-heading)' }}>
          {title}
        </h3>
        <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.45, opacity: 0.92 }}>{description}</p>
        {details && details.length > 0 ? (
          <div
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--table-shell-bg)',
              border: '1px solid var(--border-subtle)',
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6, opacity: 0.9 }}>También se perderá o eliminará:</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p style={{ margin: 0, fontSize: 12, color: 'var(--danger)', opacity: 0.95 }}>Esta acción no se puede deshacer.</p>
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
            background: 'var(--danger)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 14px',
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? 'Eliminando…' : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
