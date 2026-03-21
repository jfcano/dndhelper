import type { SVGAttributes } from 'react'

const common: SVGAttributes<SVGSVGElement> = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export function IconArrowLeft(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

export function IconChevronLeft(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

export function IconChevronRight(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

export function IconSun(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

export function IconMoon(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

export function IconPlus(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconMinus(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M5 12h14" />
    </svg>
  )
}

export function IconTrash(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" />
    </svg>
  )
}

export function IconSave(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </svg>
  )
}

export function IconCheck(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

export function IconLink(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M10 13a5 5 0 007.07.07l1-1a5 5 0 00-7.07-7.07l-1.82 1.81M14 11a5 5 0 00-7.07-.07l-1 1a5 5 0 007.07 7.07l1.81-1.81" />
    </svg>
  )
}

/** Varita — IA / generación automática */
export function IconSparkles(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M4 20L18 6M15 3l6 6-3 3-6-6 3-3z" />
      <path d="M8 16l-2 4 4-2" />
    </svg>
  )
}

export function IconRotateCcw(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}

export function IconX(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

export function IconUsers(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

export function IconScroll(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M8 4h8a2 2 0 012 2v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" />
      <path d="M10 9h4M10 13h4M10 17h2" />
    </svg>
  )
}

export function IconGlobe(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  )
}

/** Subir documento — manuales PDF para RAG */
export function IconUploadDoc(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M12 18v-6M9 15l3-3 3 3" />
    </svg>
  )
}

/** Engranaje — ajustes / configuración */
export function IconCog(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

/** Libro abierto — consultas RAG sobre reglas / PDFs */
export function IconBook(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
      <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
    </svg>
  )
}
