// Серия ботовских ранов по сидам — оценить разброс выживаемости.
// node scripts/calibrate.mjs "1 2 3 4" [speed]
import { chromium } from '@playwright/test'

const seeds = (process.argv[2] ?? '1 2 3').split(/\s+/)
const speed = process.argv[3] ?? '8'

const browser = await chromium.launch()
for (const seed of seeds) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`http://localhost:5187/?bot=1&seed=${seed}&speed=${speed}`)
  await page.waitForFunction(
    () => window.__diag && (window.__diag.state === 'over' || window.__diag.state === 'win'),
    undefined,
    { timeout: 300000 },
  ).catch(() => {})
  const d = await page.evaluate(() => window.__diag)
  const t = `${Math.floor(d.time / 60)}:${String(Math.floor(d.time) % 60).padStart(2, '0')}`
  console.log(
    `seed=${seed} → ${d.state} @ ${t} | kills=${d.kills} lvl=${d.level} ` +
    `boss(dash=${d.bossDashes} summ=${d.bossSummons} lant=${d.lanternProcs} hp=${Math.round(d.bossHp)}) err=${errors.length}`,
  )
  await page.close()
}
await browser.close()
