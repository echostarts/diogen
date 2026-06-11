// Доводим до левел-апа руками (зажатые клавиши), снимаем экран выбора,
// выбираем карту клавишей 2 и проверяем, что игра продолжилась.
import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto('http://localhost:5187/?seed=5&speed=6')
await page.waitForTimeout(800)
await page.keyboard.press('Enter')

// двигаемся кругами, пока не наберём уровень
const keys = ['KeyD', 'KeyS', 'KeyA', 'KeyW']
let ki = 0
for (let i = 0; i < 120; i++) {
  const st = await page.evaluate(() => window.__diag.state)
  if (st === 'levelup') break
  const k = keys[ki++ % 4]
  await page.keyboard.down(k)
  await page.waitForTimeout(400)
  await page.keyboard.up(k)
}
await page.waitForTimeout(300)
await page.screenshot({ path: '/tmp/shot-levelup.png' })
console.log('state:', await page.evaluate(() => window.__diag.state))
await page.keyboard.press('Digit2')
await page.waitForTimeout(300)
console.log('after pick:', await page.evaluate(() => window.__diag.state))
console.log('errors:', errors.length ? errors : 'none')
await browser.close()
