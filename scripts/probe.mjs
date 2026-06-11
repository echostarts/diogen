// Быстрая проба: открыть игру, собрать ошибки консоли, наснимать скриншотов.
// Использование: node scripts/probe.mjs [url-параметры] [секунды-игры]
import { chromium } from '@playwright/test'

const qs = process.argv[2] ?? ''
const playSec = Number(process.argv[3] ?? '6')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto('http://localhost:5187/' + qs)
await page.waitForTimeout(1200)
await page.screenshot({ path: '/tmp/shot-title.png' })

// старт с клавиатуры
await page.keyboard.press('Enter')
await page.waitForTimeout(500)
await page.screenshot({ path: '/tmp/shot-run0.png' })

// немного поиграть: подвигаться по кругу
const t0 = Date.now()
const keys = ['KeyD', 'KeyS', 'KeyA', 'KeyW']
let ki = 0
while (Date.now() - t0 < playSec * 1000) {
  const k = keys[ki++ % 4]
  await page.keyboard.down(k)
  await page.waitForTimeout(700)
  await page.keyboard.up(k)
}
await page.screenshot({ path: '/tmp/shot-run1.png' })
const diag = await page.evaluate(() => window.__diag)
console.log('diag:', JSON.stringify(diag))
console.log('console errors:', errors.length ? errors : 'none')
await browser.close()
