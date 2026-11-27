// Single source of truth for Quinn, Coach Quinn's mascot: a pixel-art
// emperor penguin in a yellow-and-white striped headband. Shared by the in-app
// <QuinnMark> component, the share cards and the build-time app-icon
// generator (scripts/gen-icons.ts) so they never drift.
//
// Quinn is drawn as vector shapes traced from a photo of an emperor penguin
// and rasterised onto a pixel grid: each cell takes the colour of the
// top-most shape under its centre. Tracing keeps him true to life: the sleek
// black hood running into a long, thin beak with an orange stripe along its
// lower half, the yellow teardrop behind the hood, the cream chest, the black
// back down the far side, and a tall body that's widest low down.

export const QUINN_PALETTE = {
  K: '#0c1117', // black plumage
  k: '#2a333c', // sheen, and the eye
  e: '#8796a3', // glint in the eye
  W: '#f7fbff', // white belly
  w: '#cbdbe7', // belly in shadow
  L: '#f6efc4', // cream chest
  O: '#f6c21c', // ear patch
  o: '#f9e08a', // ear patch fading into the chest
  P: '#f5a25a', // stripe on the lower beak
  F: '#2c3a47', // feet
  Y: '#f7c948', // headband: emperor yellow
  H: '#ffffff', // headband: white stripe
} as const

type Ink = keyof typeof QUINN_PALETTE

export interface PixelCell {
  x: number
  y: number
  fill: string
}

/** A point test in drawing units (x right, y down). */
type Shape = (x: number, y: number) => boolean
type Pt = [number, number]

const ellipse = (cx: number, cy: number, rx: number, ry: number): Shape => (x, y) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

/** Even-odd point-in-polygon. */
const polygon = (pts: Pt[]): Shape => (x, y) => {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

const and = (...s: Shape[]): Shape => (x, y) => s.every((f) => f(x, y))
const or = (...s: Shape[]): Shape => (x, y) => s.some((f) => f(x, y))
const rows = (from: number, to: number): Shape => (_x, y) => y >= from && y < to

/**
 * Rasterise layers drawn in a `w` × `h` frame of drawing units onto a
 * `cols` × `rows` grid: each cell takes the colour of the top-most layer
 * under its centre.
 */
function rasterise(cols: number, rowCount: number, frame: [number, number, number, number], layers: [Shape, Ink][]): PixelCell[] {
  const [fx, fy, fw, fh] = frame
  const out: PixelCell[] = []
  for (let y = 0; y < rowCount; y++) {
    for (let x = 0; x < cols; x++) {
      const px = fx + ((x + 0.5) / cols) * fw
      const py = fy + ((y + 0.5) / rowCount) * fh
      let ink: Ink | undefined
      for (const [shape, colour] of layers) if (shape(px, py)) ink = colour
      if (ink) out.push({ x, y, fill: QUINN_PALETTE[ink] })
    }
  }
  return out
}

// --- The head, traced from a photo of an emperor penguin (690 × 566) -------
// A sleek wedge: the crown slopes straight down the forehead into a long,
// thin beak that curves a little at the tip; the black hood ends in a curve
// under the throat. Coordinates are the photo's pixels.

const HOOD: Pt[] = [
  [104, 279], [128, 258], [160, 243], [200, 233], [234, 214], [262, 184], [292, 156],
  [330, 139], [376, 134], [420, 140], [460, 158], [492, 186], [512, 218], [522, 252],
  [518, 288], [502, 316], [474, 334], [430, 346], [384, 354], [338, 362], [306, 360],
  [294, 338], [280, 310], [256, 292], [222, 282], [180, 279], [140, 282], [114, 286],
]
/** The orange stripe along the lower half of the beak, from the gape forward. */
const BEAK_STRIPE: Pt[] = [[160, 266], [200, 257], [250, 253], [318, 256], [324, 268], [262, 274], [206, 274], [166, 276]]
const EYE: Pt = [376, 231]
/** The ear patch: a yellow teardrop behind the hood. */
const EAR: Pt[] = [[476, 236], [494, 224], [510, 240], [518, 270], [516, 300], [506, 326], [492, 334], [482, 312], [476, 280]]
/** The headband: a thin bar across the crown (yellow, white, yellow). */
const BAND = { left: 248, right: 480, top: 156, bottom: 192 }
/** Black down the back of the neck and side, past the cream chest. */
const BACK: Pt[] = [
  [508, 300], [526, 316], [566, 370], [616, 432], [662, 500], [700, 560], [700, 620],
  [650, 620], [618, 520], [580, 450], [540, 396], [508, 356], [498, 330],
]

function headShapes(t: (p: Pt) => Pt, scale: number, minBand = 0) {
  const tp = (pts: Pt[]) => polygon(pts.map(t))
  const [ex, ey] = t(EYE)
  const b = { l: t([BAND.left, BAND.top]), r: t([BAND.right, BAND.bottom]) }
  // At coarse resolutions the band is thickened about its middle to four
  // rows of pixels, so each stripe gets whole rows.
  const grow = Math.max(0, minBand - (b.r[1] - b.l[1])) / 2
  b.l[1] -= grow
  b.r[1] += grow
  // Thin yellow, a broader white, thin yellow (1 : 2 : 1), as on the photo.
  const q = (b.r[1] - b.l[1]) / 4
  const bar = (from: number, to: number): Shape => (x, y) => x >= b.l[0] && x <= b.r[0] && y >= from && y < to
  return {
    hood: tp(HOOD),
    stripe: tp(BEAK_STRIPE),
    eye: ellipse(ex, ey, 13 * scale, 9 * scale),
    glint: ellipse(ex - 4 * scale, ey - 3 * scale, 4.5 * scale, 4 * scale),
    ear: tp(EAR),
    back: tp(BACK),
    bandTop: bar(b.l[1], b.l[1] + q),
    bandMid: bar(b.l[1] + q, b.l[1] + 3 * q),
    bandLow: bar(b.l[1] + 3 * q, b.r[1]),
  }
}

// --- Head close-up: 48 × 48, turned to the left (the app icon) -------------

export const QUINN_HEAD_COLS = 48
export const QUINN_HEAD_ROWS = 48

function headLayers(): [Shape, Ink][] {
  const h = headShapes((p) => p, 1, 37.7)
  // The cream chest swelling below the hood, out past the back stripe.
  const chest = polygon([
    [306, 358], [270, 380], [236, 412], [208, 452], [188, 500], [176, 560], [172, 620],
    [700, 620], [700, 420], [640, 380], [580, 340], [520, 300], [470, 332], [400, 350],
  ])
  // The ear patch's yellow running down into the cream, under the hood.
  const glow = polygon([[484, 318], [500, 330], [510, 350], [504, 372], [490, 382], [476, 370], [474, 344]])
  return [
    [chest, 'L'],
    [glow, 'o'],
    [h.back, 'K'],
    [h.hood, 'K'],
    [h.ear, 'O'],
    [h.stripe, 'P'],
    [h.eye, 'k'],
    [h.glint, 'e'],
    [h.bandTop, 'Y'],
    [h.bandMid, 'H'],
    [h.bandLow, 'Y'],
  ]
}

// --- Full length: 36 × 72, facing left -------------------------------------
// The same head on a tall emperor's body: a head about a sixth of his
// height, narrow at the shoulders, widest low down, a thin black flipper
// along the near side, the back showing as a black band on the far side,
// small feet. Drawn in a 400 × 800 frame.

export const QUINN_COLS = 36
export const QUINN_ROWS = 72

function bodyLayers(): [Shape, Ink][] {
  const s = 0.6
  const t = ([x, y]: Pt): Pt => [(x - 104) * s + 46, (y - 134) * s + 24]
  const h = headShapes(t, s, 44.4)
  const body = polygon([
    [180, 120], [160, 160], [138, 210], [118, 270], [100, 340], [86, 420], [80, 500],
    [86, 580], [104, 650], [138, 708], [190, 742], [246, 746], [298, 724], [336, 676],
    [356, 600], [358, 510], [348, 420], [330, 330], [310, 250], [258, 156], [250, 110],
  ])
  // The front, from the throat down: cream at the top, white below.
  const front = polygon([
    [190, 130], [170, 170], [148, 222], [128, 282], [112, 350], [100, 430], [96, 510],
    [102, 590], [120, 656], [152, 708], [200, 734], [246, 734], [282, 712], [304, 668],
    [312, 600], [312, 510], [304, 420], [290, 330], [274, 250], [250, 170], [232, 140],
  ])
  const flipper = polygon([
    [128, 230], [112, 280], [96, 350], [84, 420], [78, 480], [76, 520], [90, 470],
    [104, 400], [118, 330], [132, 270], [146, 236],
  ])
  const sheen = polygon([[300, 250], [330, 330], [348, 420], [356, 510], [354, 600], [338, 668], [344, 600], [344, 510], [336, 420], [320, 330]])
  const ear = polygon(EAR.map(t))
  const chestCream = and(front, ellipse(230, 170, 150, 210))
  const chestFade = and(front, ellipse(262, 180, 26, 34))
  const feet = or(ellipse(170, 750, 44, 14), ellipse(262, 750, 44, 14))
  return [
    [feet, 'F'],
    [body, 'K'],
    [sheen, 'k'],
    [front, 'W'],
    [chestCream, 'L'],
    [and(front, rows(650, 800)), 'w'],
    [chestFade, 'o'],
    [flipper, 'K'],
    [h.hood, 'K'],
    [ear, 'O'],
    [h.stripe, 'P'],
    [h.eye, 'k'],
    [h.glint, 'e'],
    [h.bandTop, 'Y'],
    [h.bandMid, 'H'],
    [h.bandLow, 'Y'],
  ]
}

const BODY_CELLS = rasterise(QUINN_COLS, QUINN_ROWS, [0, 0, 400, 800], bodyLayers())
// The icon is a close-up of the face: beak tip at the left edge, the hood
// filling the upper two-thirds, just the top of the chest at the bottom.
const HEAD_CELLS = rasterise(QUINN_HEAD_COLS, QUINN_HEAD_ROWS, [94, 92, 452, 452], headLayers())

/** Quinn's full-length pixels (unit coordinates). */
export function quinnCells(): PixelCell[] {
  return BODY_CELLS
}

/** The head close-up's pixels (unit coordinates), for the app icon. */
export function quinnHeadCells(): PixelCell[] {
  return HEAD_CELLS
}
