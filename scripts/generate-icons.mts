/**
 * Generates the app icons (Plan P9.1) from the brand mark: the terminal prompt of lucide's
 * SquareTerminal, in white on the brand colour. Run once and commit the PNGs:
 *
 *   node scripts/generate-icons.mts
 *
 * Uses the sharp that Next.js already installs for image optimization, so no new dependency.
 */
import { mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"

const root = join(import.meta.dirname, "..")
const require = createRequire(import.meta.resolve("next/package.json"))
const sharp = require("sharp") as (input: Buffer) => {
  resize: (w: number, h: number) => { png: () => { toFile: (path: string) => Promise<unknown> } }
}

const BRAND = "#171717"

/**
 * The prompt glyph (lucide square-terminal: "m7 11 2-2-2-2" and "M11 13h4"), centred on a 24-unit
 * tile. `scale` sizes the glyph; `radius` rounds the tile (0 = full bleed, for maskable and iOS).
 */
function svg({ scale, radius }: { scale: number; radius: number }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 24 24">
  <rect width="24" height="24" rx="${radius}" fill="${BRAND}"/>
  <g transform="translate(12 12) scale(${scale}) translate(-11 -10)" fill="none" stroke="#ffffff"
     stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="m7 11 2-2-2-2"/>
    <path d="M11 13h4"/>
  </g>
</svg>`
}

const outputs = [
  { file: "public/icons/icon-192.png", size: 192, scale: 1.45, radius: 5 },
  { file: "public/icons/icon-512.png", size: 512, scale: 1.45, radius: 5 },
  // Maskable: full bleed, glyph well inside the central 80% safe zone.
  { file: "public/icons/maskable-512.png", size: 512, scale: 1.15, radius: 0 },
  // iOS rounds the corners itself.
  { file: "src/app/apple-icon.png", size: 180, scale: 1.3, radius: 0 },
]

mkdirSync(join(root, "public/icons"), { recursive: true })
for (const { file, size, scale, radius } of outputs) {
  await sharp(Buffer.from(svg({ scale, radius })))
    .resize(size, size)
    .png()
    .toFile(join(root, file))
  console.log(`${file} (${size}×${size})`)
}
