import { expect, test, type Page } from '@playwright/test'

// Диагностика игры — window.__diag (см. src/main.ts).
interface Diag {
  state: string
  time: number
  fps: number
  fps5: number
  kills: number
  level: number
  hp: number
  px: number
  py: number
  enemies: number
  parts: number
  projs: number
  bossActive: boolean
  bossDashes: number
  bossSummons: number
  lanternProcs: number
}

declare global {
  interface Window { __diag: Diag }
}

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(String(e)))
  return errors
}

const diag = (page: Page) => page.evaluate(() => window.__diag)

// ВНИМАНИЕ: сиды (?seed=) пришпилены к текущему балансу. Любая правка
// логики/баланса меняет раны — тогда сиды надо переподобрать
// через `node scripts/calibrate.mjs "1 2 3 4 5 6 7 8" 8`.
const SEED_WIN = 7   // доходит до босса и побеждает (~5:34)
const SEED_DIE = 2   // умирает до босса (~2:56)

test('страница грузится: канвас, тайтл, ноль ошибок консоли', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/')
  await expect(page.locator('canvas#game')).toBeVisible()
  await page.waitForTimeout(2500)
  const d = await diag(page)
  expect(d.state).toBe('title')
  expect(errors).toEqual([])
})

test('симуляция инпута двигает игрока', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto(`/?seed=${SEED_WIN}`)
  await page.waitForTimeout(600)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  const before = await diag(page)
  expect(before.state).toBe('run')
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(1000)
  await page.keyboard.up('ArrowRight')
  await page.waitForTimeout(300)
  const after = await diag(page)
  expect(after.px - before.px).toBeGreaterThan(60)
  // и WASD тоже
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(700)
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(300)
  const after2 = await diag(page)
  expect(before.py - after2.py).toBeGreaterThan(40)
  expect(errors).toEqual([])
})

test('30 секунд игры в реальном времени: fps ≥ 55, убийства > 0', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto(`/?bot=1&seed=${SEED_WIN}`)
  await page.waitForFunction(() => window.__diag && window.__diag.time >= 30, undefined, { timeout: 60_000 })
  const d = await diag(page)
  expect(d.state).toBe('run')
  expect(d.fps5).toBeGreaterThanOrEqual(55)
  expect(d.kills).toBeGreaterThan(0)
  expect(errors).toEqual([])
})

test('стресс: ~300 врагов и 200+ снарядов/частиц при fps ≥ 55', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto(`/?stress=1&seed=${SEED_WIN}`)
  await page.waitForTimeout(600)
  await page.keyboard.press('Enter')
  // 12 секунд под полной нагрузкой
  await page.waitForFunction(() => window.__diag && window.__diag.time >= 12, undefined, { timeout: 40_000 })
  const d = await diag(page)
  expect(d.enemies).toBeGreaterThanOrEqual(290)
  expect(d.parts + d.projs).toBeGreaterThanOrEqual(180)
  expect(d.fps5).toBeGreaterThanOrEqual(55)
  expect(errors).toEqual([])
})

test('бот доживает минимум до 2:00 на дефолтном балансе', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto(`/?bot=1&seed=${SEED_WIN}&speed=6`)
  await page.waitForFunction(
    () => {
      const d = window.__diag
      return d && (d.time >= 120 || d.state === 'over')
    },
    undefined,
    { timeout: 120_000 },
  )
  const d = await diag(page)
  expect(d.state).toBe('run')
  expect(d.time).toBeGreaterThanOrEqual(120)
  expect(errors).toEqual([])
})

test('полный ран: босс на 5:00, фазы, уязвимость к фонарю, победа, рестарт', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto(`/?bot=1&seed=${SEED_WIN}&speed=8`)
  // босс должен выйти на 5:00
  await page.waitForFunction(() => window.__diag && window.__diag.bossActive, undefined, { timeout: 180_000 })
  const atBoss = await diag(page)
  expect(atBoss.time).toBeGreaterThanOrEqual(299)
  expect(atBoss.time).toBeLessThan(312)
  // дожидаемся конца боя
  await page.waitForFunction(
    () => window.__diag.state === 'win' || window.__diag.state === 'over',
    undefined,
    { timeout: 180_000 },
  )
  const end = await diag(page)
  // фазы босса и уязвимость под фонарём реально срабатывали
  expect(end.bossDashes).toBeGreaterThan(0)
  expect(end.bossSummons).toBeGreaterThan(0)
  expect(end.lanternProcs).toBeGreaterThan(0)
  // на этом сиде бот побеждает — проверяем экран победы
  expect(end.state).toBe('win')
  // рестарт без перезагрузки страницы
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => window.__diag.state === 'run', undefined, { timeout: 10_000 })
  const restarted = await diag(page)
  expect(restarted.time).toBeLessThan(60)
  expect(restarted.bossActive).toBe(false)
  expect(errors).toEqual([])
})

test('смерть: экран поражения и рестарт клавишей R', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto(`/?bot=1&seed=${SEED_DIE}&speed=8`)
  await page.waitForFunction(() => window.__diag.state === 'over', undefined, { timeout: 180_000 })
  const d = await diag(page)
  expect(d.hp).toBeLessThanOrEqual(0)
  await page.keyboard.press('KeyR')
  await page.waitForFunction(() => window.__diag.state === 'run', undefined, { timeout: 10_000 })
  expect(errors).toEqual([])
})

test('пауза на Esc и продолжение', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto(`/?seed=${SEED_WIN}`)
  await page.waitForTimeout(600)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  expect((await diag(page)).state).toBe('pause')
  const tPaused = (await diag(page)).time
  await page.waitForTimeout(700)
  expect((await diag(page)).time).toBeCloseTo(tPaused, 1)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  expect((await diag(page)).state).toBe('run')
  expect(errors).toEqual([])
})

test.describe('тач-управление', () => {
  test.use({ hasTouch: true })

  test('тап стартует игру, виртуальный стик двигает игрока', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto(`/?seed=${SEED_WIN}`)
    await page.waitForTimeout(600)
    await page.touchscreen.tap(640, 360)
    await page.waitForTimeout(400)
    expect((await diag(page)).state).toBe('run')
    const before = await diag(page)
    // стик: палец сел слева и потянул вправо
    const canvas = page.locator('canvas')
    await canvas.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', clientX: 300, clientY: 400, isPrimary: true })
    await canvas.dispatchEvent('pointermove', { pointerId: 7, pointerType: 'touch', clientX: 390, clientY: 400, isPrimary: true })
    await page.waitForTimeout(1000)
    await canvas.dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: 390, clientY: 400, isPrimary: true })
    await page.waitForTimeout(200)
    const after = await diag(page)
    expect(after.px - before.px).toBeGreaterThan(60)
    expect(errors).toEqual([])
  })
})

test('лавка: покупка за черепки повышает стартовые статы', async ({ page }) => {
  const errors = trackErrors(page)
  await page.addInitScript(() => {
    localStorage.setItem('diogen_meta', JSON.stringify({ w: 100, hp: 0, dmg: 0, spd: 0, mag: 0 }))
  })
  await page.goto(`/?seed=${SEED_WIN}`)
  await page.waitForTimeout(600)
  await page.keyboard.press('KeyL')
  await page.waitForTimeout(300)
  expect((await diag(page)).state).toBe('shop')
  await page.keyboard.press('Enter') // купить «Толстые доски» (15 черепков)
  await page.waitForTimeout(300)
  expect((await diag(page)).wallet).toBe(85)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  expect((await diag(page)).state).toBe('title')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  const d = await diag(page)
  expect(d.state).toBe('run')
  expect(d.maxHp).toBe(108) // 100 + 8 за уровень лавки
  expect(errors).toEqual([])
})

test('второй герой: выкуп Гиппархии за черепки и старт за неё', async ({ page }) => {
  const errors = trackErrors(page)
  await page.addInitScript(() => {
    localStorage.setItem('diogen_meta', JSON.stringify({ w: 200, hp: 0, dmg: 0, spd: 0, mag: 0, chars: 1 }))
  })
  await page.goto(`/?seed=${SEED_WIN}`)
  await page.waitForTimeout(600)
  await page.keyboard.press('ArrowRight') // листаем на Гиппархию (закрыта)
  await page.waitForTimeout(250)
  await page.keyboard.press('Enter') // выкуп за 150
  await page.waitForTimeout(300)
  expect((await diag(page)).wallet).toBe(50)
  await page.keyboard.press('Enter') // старт за неё
  await page.waitForTimeout(500)
  const d = await diag(page)
  expect(d.state).toBe('run')
  expect(d.maxHp).toBe(80) // у Гиппархии меньше здоровья
  expect(errors).toEqual([])
})

test('быстрая победа через ?bosshp: экран победы работает', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto(`/?bot=1&seed=${SEED_WIN}&speed=8&bosshp=120`)
  await page.waitForFunction(
    () => window.__diag.state === 'win' || window.__diag.state === 'over',
    undefined,
    { timeout: 180_000 },
  )
  expect((await diag(page)).state).toBe('win')
  expect(errors).toEqual([])
})
