export function toSpanishStatus(status: string | null | undefined): string {
  const normalized = (status ?? '').trim().toLowerCase()
  if (!normalized) return 'Sin estado'

  const labels: Record<string, string> = {
    draft: 'Borrador',
    approved: 'Aprobado',
    planned: 'Planificada',
    done: 'Completada',
    generated: 'Generado',
    active: 'Activa',
    archived: 'Archivada',
  }
  return labels[normalized] ?? status ?? 'Sin estado'
}
