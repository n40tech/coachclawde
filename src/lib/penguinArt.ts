// Single source of truth for Quinn, Coach Quinn's mascot: a pixel-art
// emperor penguin in a yellow-and-white striped headband. Shared by the in-app
// <QuinnMark> component and the build-time app-icon generator
// (scripts/gen-icons.ts) so the two never drift.
//
// Legend:
//   K black plumage   k back sheen      e eye glint
//   W belly white     w belly shadow    L pale-yellow chest
//   O ear patch       P beak stripe     F feet
//   Y band yellow     H band white      . transparent

/** Quinn, full length, beak to the left. */
const BODY = [
  '......KKKK......',
  '....KKKKKKKK....',
  '...YYYYYYYYYY...',
  '...HHHHHHHHHHYH.',
  '...YYYYYYYYYYHYH',
  '...KKKKKKKKKKY..',
  '..KKeKKKKKKKKk..',
  'KKKKKKKKKKKKKk..',
  '.PPPKKKKOKKKKk..',
  '....KKKOOKKKKk..',
  '...KKLLOOKKKKk..',
  '..KKLLLLOKKKKKk.',
  '.KKWLLLLLWKKKKk.',
  'KK.WWWWWWWWKK.kk',
  'K..KWWWWWWWWK..k',
  '...KWWWWWWWWK...',
  '...KWWWWWWWwK...',
  '...KwWWWWWWwK...',
  '....KwwwwwwK....',
  '...FFFF..FFFF...',
]

/**
 * Quinn's head in close-up, turned to the left: the app icon. Bigger
 * pixels, so more detail fits (the long beak with its stripe, the ear patch
 * fading into the chest, the knot of the headband).
 */
const HEAD = [
  '........KKKKKK......',
  '......KKKKKKKKKK....',
  '.....KKKKKKKKKKKKk..',
  '....YYYYYYYYYYYYYY..',
  '....HHHHHHHHHHHHHHYH',
  '....YYYYYYYYYYYYYYHY',
  '....KKKKKKKKKKKKKYHY',
  '....KKKeKKKKKKKKkY.Y',
  '...KKKKKKKKKKKKKKk..',
  '.KKKKKKKKKKKKKKKKk..',
  'KKKKKKKKKKKKKKKKKk..',
  '.PPPPPKKKKKKOKKKKk..',
  '...PPKKKKKKOOKKKKk..',
  '......KKKKOOOKKKKk..',
  '......KKKLOOOKKKKKk.',
  '......KKLLLOOKKKKKk.',
  '.....KKLLLLLOKKKKKk.',
  '.....KLLLLLLLLKKKKKk',
  '....KKWLLLLLLWWKKKKk',
  '....KWWWWWWWWWWWKKKk',
]

export const QUINN_PALETTE: Record<string, string> = {
  K: '#0c1720', // black plumage (a touch of ocean in it)
  k: '#22394d', // sheen along the back
  e: '#d9f2ff', // glint in the eye
  W: '#f7fbff', // polar white belly
  w: '#cfe1ee', // belly in shadow
  L: '#fde9a6', // the pale yellow chest
  O: '#f7b335', // ear patch
  P: '#f08a3c', // stripe on the beak
  F: '#2b3c4c', // feet
  Y: '#f7c948', // headband: emperor yellow
  H: '#ffffff', // headband: white stripe
}

export interface PixelCell {
  x: number
  y: number
  fill: string
}

function cells(grid: string[]): PixelCell[] {
  const out: PixelCell[] = []
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const fill = QUINN_PALETTE[row[x]]
      if (fill) out.push({ x, y, fill })
    }
  })
  return out
}

export const QUINN_COLS = BODY[0].length
export const QUINN_ROWS = BODY.length
export const QUINN_HEAD_COLS = HEAD[0].length
export const QUINN_HEAD_ROWS = HEAD.length

/** Quinn's full-length pixels (unit coordinates). */
export function quinnCells(): PixelCell[] {
  return cells(BODY)
}

/** The head close-up's pixels (unit coordinates), for the app icon. */
export function quinnHeadCells(): PixelCell[] {
  return cells(HEAD)
}
