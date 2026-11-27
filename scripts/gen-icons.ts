// Generates the home-screen / PWA app icons (and the favicon) from Quinn's
// pixel art (src/lib/penguinArt), so the installed icon always matches the
// in-app mark: a close-up of Quinn's head, turned to the left, against a
// block of blue ice. Also writes the website's icons (site/assets, also used
// by the README).
//
// Run with:  node --experimental-strip-types scripts/gen-icons.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import { quinnHeadCells, QUINN_HEAD_COLS, QUINN_HEAD_ROWS } from '../src/lib/penguinArt.ts'

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(here, '../public')
const iconsDir = resolve(publicDir, 'icons')
const siteAssetsDir = resolve(here, '../site/assets')
mkdirSync(iconsDir, { recursive: true })
mkdirSync(siteAssetsDir, { recursive: true })

interface SvgOpts {
  /** Canvas size in px */
  size: number
  /** Fraction of the canvas kept clear around the face (safe zone) */
  pad: number
  /** Corner radius in px (browser favicon only: the OS masks the PNG icons) */
  radius?: number
}

function buildSvg({ size, pad, radius = 0 }: SvgOpts): string {
  // The portrait is a close-up of the face, cropped at the chest: it sits
  // on the bottom edge, centred, filling the tile less the padding.
  const scale = (size * (1 - pad)) / Math.max(QUINN_HEAD_COLS, QUINN_HEAD_ROWS)
  const offX = (size - QUINN_HEAD_COLS * scale) / 2
  const offY = size - QUINN_HEAD_ROWS * scale
  const bleed = scale * 0.1
  const u = size / 100

  const cells = quinnHeadCells()
    .map(
      (c) =>
        `<rect x="${(offX + c.x * scale - bleed).toFixed(2)}" y="${(offY + c.y * scale - bleed).toFixed(2)}" ` +
        `width="${(scale + bleed * 2).toFixed(2)}" height="${(scale + bleed * 2).toFixed(2)}" fill="${c.fill}"/>`,
    )
    .join('')

  // Facets of glacier ice behind the head: lighter planes catching the light.
  const facets = [
    `M0 0 L${46 * u} 0 L${20 * u} ${58 * u} L0 ${70 * u} Z`,
    `M${58 * u} 0 L${100 * u} 0 L${100 * u} ${34 * u} L${72 * u} ${20 * u} Z`,
    `M0 ${70 * u} L${20 * u} ${58 * u} L${30 * u} ${100 * u} L0 ${100 * u} Z`,
  ]

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="ice" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#c9f0ff"/>
      <stop offset="0.45" stop-color="#5cc3f2"/>
      <stop offset="1" stop-color="#0b5f9a"/>
    </linearGradient>
    <radialGradient id="light" cx="28%" cy="18%" r="70%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="tile"><rect width="${size}" height="${size}" rx="${radius}"/></clipPath>
  </defs>
  <g clip-path="url(#tile)">
    <rect width="${size}" height="${size}" fill="url(#ice)"/>
    ${facets.map((d, i) => `<path d="${d}" fill="#ffffff" fill-opacity="${[0.16, 0.12, 0.07][i]}"/>`).join('')}
    <rect width="${size}" height="${size}" fill="url(#light)"/>
    <g shape-rendering="crispEdges">${cells}</g>
  </g>
</svg>`
}

function png(svg: string, width: number): Buffer {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng()
}

// Standard PWA icons (the OS applies its own rounded mask, so square + minimal pad).
const any192 = buildSvg({ size: 192, pad: 0 })
const any512 = buildSvg({ size: 512, pad: 0 })
// Maskable needs a generous safe zone so nothing is clipped by the OS mask.
const maskable = buildSvg({ size: 512, pad: 0.18 })
// Apple touch icon: iOS rounds the corners itself.
const apple = buildSvg({ size: 180, pad: 0 })
// Favicon: small rounded tile for the browser tab.
const favicon = buildSvg({ size: 64, pad: 0, radius: 14 })

writeFileSync(resolve(iconsDir, 'icon-192.png'), png(any192, 192))
writeFileSync(resolve(iconsDir, 'icon-512.png'), png(any512, 512))
writeFileSync(resolve(iconsDir, 'maskable-512.png'), png(maskable, 512))
writeFileSync(resolve(iconsDir, 'apple-touch-icon.png'), png(apple, 180))
writeFileSync(resolve(publicDir, 'favicon.svg'), favicon)

// Website + README: a rounded tile like the home-screen icon.
writeFileSync(resolve(siteAssetsDir, 'icon-512.png'), png(buildSvg({ size: 512, pad: 0, radius: 114 }), 512))
writeFileSync(resolve(siteAssetsDir, 'apple-touch-icon.png'), png(apple, 180))
writeFileSync(resolve(siteAssetsDir, 'favicon.svg'), favicon)

console.log('Generated app icons in public/icons + public/favicon.svg, and site/assets')
