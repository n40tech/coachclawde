/** The usual chip look: accent when picked, quiet otherwise. */
export function chipLook(on: boolean, base = 'px-3 py-2.5 rounded-2xl text-sm font-medium text-center'): string {
  return `${base} transition-all duration-150 ${
    on
      ? 'bg-[#d97756] text-white shadow-lg shadow-[#d97756]/20'
      : 'bg-[#1a1a1a] text-[#a8a29e] border border-[#2a2a2a] hover:text-[#f5f5f0]'
  }`
}
