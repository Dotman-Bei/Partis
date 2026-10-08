/**
 * The Partis mark: a heavy P whose counter is a round punch hole, with the detached square
 * stub torn off at the door. Same geometry as brand/partis-mark.svg (64-unit grid); drawn in
 * currentColor so the surrounding tile sets the colour.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M16 8H35a16 16 0 0 1 0 32h-8v13a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3ZM28 24a7 7 0 1 0 14 0a7 7 0 1 0-14 0Z"
      />
      <path
        fill="currentColor"
        d="M40 46h8a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3Z"
      />
    </svg>
  );
}

/** The mark in its app tile (yellow tile, black mark). */
export function LogoTile({ large }: { large?: boolean }) {
  return (
    <span className={`logo${large ? " large" : ""}`} aria-hidden="true">
      <LogoMark />
    </span>
  );
}
