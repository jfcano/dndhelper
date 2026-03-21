import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'title'> & {
  /** Texto para `title` y `aria-label` (y lectores de pantalla) */
  label: string
  /** Etiqueta corta visible en pantallas anchas (≥768px), junto al icono */
  textShort?: string
  /** Cuando está en curso una acción (muestra animación en el icono) */
  busy?: boolean
  /** Etiqueta accesible mientras `busy` (ej. "Guardando…") */
  busyLabel?: string
  /** Texto corto mientras `busy` en escritorio (por defecto "…") */
  busyShort?: string
  children: ReactNode
}

/**
 * Botón con icono; opcionalmente `textShort` en escritorio.
 * Con `busy`, el SVG hijo recibe animación (definida en CSS).
 */
export function IconButton({
  label,
  textShort,
  busy,
  busyLabel,
  busyShort,
  className,
  children,
  disabled,
  ...rest
}: Props) {
  const text = busy && busyLabel ? busyLabel : label
  const isDisabled = Boolean(disabled || busy)
  const shortVisible = busy ? (busyShort ?? '…') : textShort
  return (
    <button
      type="button"
      className={[
        'btn-icon',
        shortVisible ? 'btn-icon--labeled' : '',
        busy ? 'btn-icon--busy' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      title={text}
      aria-label={text}
      aria-busy={busy || undefined}
      {...rest}
      disabled={isDisabled}
    >
      {children}
      {shortVisible ? (
        <span className="btn-icon__short" aria-hidden>
          {shortVisible}
        </span>
      ) : null}
    </button>
  )
}
