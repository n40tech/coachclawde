/** The usual chip look: accent when picked, quiet otherwise. */
export function chipLook(on: boolean, base = 'px-3 py-2.5 rounded-2xl text-sm font-medium text-center'): string {
  return `${base} transition-all duration-150 ${
    on
      ? 'bg-accent-fill text-white shadow-lg shadow-ice/20'
      : 'bg-slush text-frost border border-rime hover:text-snow'
  }`
}
