/** Dado (d20 estilizado) + runas decorativas — solo visual, sin significado mecánico en juego. */
export function HeaderOrnaments() {
  return (
    <div className="header-ornaments" aria-hidden>
      <svg className="header-d20" viewBox="0 0 40 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <title>d20</title>
        <path
          d="M20 2L38 14v16L20 42 2 30V14L20 2z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
          fill="currentColor"
          fillOpacity="0.12"
        />
        <path d="M20 2v40M2 14l36 0M2 30h36M11 8l18 28M29 8L11 36" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <circle cx="20" cy="22" r="2.2" fill="currentColor" opacity="0.85" />
      </svg>
      <span className="header-runes">ᚦ ✦ ᚱ ✦ ᛟ</span>
    </div>
  )
}
