// Кроп центра экрана после N секунд игры ботом (ускоренной) — рассмотреть арт.
import { chromium } from '@playwright/test'

const sec = Number(process.argv[2] ?? '30')
const speed = process.argv[3] ?? '4'
const seed = process.argv[4] ?? '7'
const extra = process.argv[5] ?? ''

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(`http://localhost:5187/?bot=1&seed=${seed}&speed=${speed}${extra}`)
await page.waitForFunction(
  (s) => window.__diag && (window.__diag.time >= s || window.__diag.state === 'over' || window.__diag.state === 'win'),
  sec,
  { timeout: 240000 },
)
await page.screenshot({ path: '/tmp/zoom-full.png' })
await page.screenshot({ path: '/tmp/zoom-center.png', clip: { x: 420, y: 200, width: 440, height: 320 } })
const diag = await page.evaluate(() => window.__diag)
console.log('diag:', JSON.stringify(diag))
console.log('errors:', errors.length ? errors : 'none')
await browser.close()
