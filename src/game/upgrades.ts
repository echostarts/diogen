import type { World } from './world'

export interface UpDef {
  id: string
  name: string
  desc: string
  max: number
  lvl(w: World): number
  avail(w: World): boolean
  apply(w: World): void
}

export const UPGRADES: UpDef[] = [
  // --- оружие ---
  {
    id: 'w_lantern', name: 'ФОНАРЬ', desc: 'Ищу человека. Круг света жжёт всех внутри: +30% урона, +8% радиуса.',
    max: 5, lvl: (w) => w.weapons.lantern, avail: () => true,
    apply: (w) => { w.weapons.lantern++ },
  },
  {
    id: 'w_spit', name: 'ПЛЕВОК ЦИНИЗМА', desc: 'Снаряд в ближайшего гражданина. Уровни: +25% урона, чаще.',
    max: 5, lvl: (w) => w.weapons.spit, avail: () => true,
    apply: (w) => { w.weapons.spit++ },
  },
  {
    id: 'w_dogs', name: 'ПСЫ', desc: 'Двое псов носятся между ближайшими врагами. Уровни: +28% урона, быстрее.',
    max: 5, lvl: (w) => w.weapons.dogs, avail: () => true,
    apply: (w) => { w.weapons.dogs++ },
  },
  {
    id: 'w_barrel', name: 'БОЧКА-ТАРАН', desc: 'Дави на скорости, отбрасывай. Движение копит рывок: ПРОБЕЛ.',
    max: 5, lvl: (w) => w.weapons.barrel, avail: () => true,
    apply: (w) => { w.weapons.barrel++ },
  },
  // --- пассивки ---
  {
    id: 'p_dmg', name: 'ЖЕЛЧЬ', desc: '+20% урона. Аргументы стали тяжелее.',
    max: 5, lvl: (w) => w.pass.dmg, avail: () => true,
    apply: (w) => { w.pass.dmg++ },
  },
  {
    id: 'p_aspd', name: 'ЕХИДСТВО', desc: '+15% скорости атаки. Реплики — без пауз.',
    max: 5, lvl: (w) => w.pass.aspd, avail: () => true,
    apply: (w) => { w.pass.aspd++ },
  },
  {
    id: 'p_area', name: 'ШИРОТА ВЗГЛЯДОВ', desc: '+15% радиуса и размера эффектов.',
    max: 5, lvl: (w) => w.pass.area, avail: () => true,
    apply: (w) => { w.pass.area++ },
  },
  {
    id: 'p_mspd', name: 'БОСЫЕ ПЯТКИ', desc: '+10% скорости движения. Обувь — лишнее.',
    max: 5, lvl: (w) => w.pass.mspd, avail: () => true,
    apply: (w) => { w.pass.mspd++ },
  },
  {
    id: 'p_magnet', name: 'ПРОТЯНУТАЯ ЧАША', desc: '+25% радиуса подбора оливок.',
    max: 5, lvl: (w) => w.pass.magnet, avail: () => true,
    apply: (w) => { w.pass.magnet++ },
  },
  {
    id: 'p_hp', name: 'КРЕПКАЯ КЛЁПКА', desc: '+20 к максимуму HP и полное лечение.',
    max: 5, lvl: (w) => w.pass.hp, avail: () => true,
    apply: (w) => {
      w.pass.hp++
      w.player.maxHp += 20
      w.player.hp = w.player.maxHp
    },
  },
  {
    id: 'p_dog', name: 'ЕЩЁ ПЁС', desc: '+1 пёс в стаю. Город прокормит.',
    max: 5, lvl: (w) => w.pass.dog, avail: (w) => w.weapons.dogs > 0,
    apply: (w) => { w.pass.dog++ },
  },
  {
    id: 'p_pierce', name: 'СКВОЗНАЯ ОСТРОТА', desc: '+1 пробитие плевка: достаётся и стоящим сзади.',
    max: 5, lvl: (w) => w.pass.pierce, avail: (w) => w.weapons.spit > 0,
    apply: (w) => { w.pass.pierce++ },
  },
  {
    id: 'p_ask', name: 'АСКЕЗА', desc: '−25% макс. HP, +35% урона. Меньше нужно — больнее бьёшь.',
    max: 2, lvl: (w) => w.pass.ask, avail: () => true,
    apply: (w) => {
      w.pass.ask++
      w.player.maxHp = Math.max(20, Math.round(w.player.maxHp * 0.75))
      if (w.player.hp > w.player.maxHp) w.player.hp = w.player.maxHp
    },
  },
  // --- эволюция ---
  {
    id: 'w_sun', name: 'СОЛНЦЕ', desc: 'Эволюция Фонаря: свет идёт от самой бочки. Шире, жарче, и никто его не заслонит.',
    max: 1, lvl: (w) => (w.sun ? 1 : 0), avail: (w) => w.weapons.lantern >= 5 && w.pass.area >= 3 && !w.sun,
    apply: (w) => { w.sun = true },
  },
]

// Запасной вариант, когда всё прокачано: просто похлёбка.
export const FALLBACK: UpDef = {
  id: 'f_soup', name: 'ПОХЛЁБКА', desc: '+25 HP. Чечевица. Без церемоний.',
  max: 99, lvl: () => 0, avail: () => true,
  apply: (w) => { w.player.hp = Math.min(w.player.maxHp, w.player.hp + 25) },
}

export function defByIndex(i: number): UpDef {
  return i < 0 ? FALLBACK : UPGRADES[i]
}

const cand: number[] = []
const weights: number[] = []

/**
 * Заполняет out тремя индексами UPGRADES (или -1 для похлёбки).
 * Пока открыто меньше двух оружий, оружейные карты выпадают вдвое чаще —
 * ран без атак скучен и для человека, и для бота.
 */
export function rollChoices(w: World, out: number[]): void {
  cand.length = 0
  weights.length = 0
  const armed =
    (w.weapons.lantern > 0 ? 1 : 0) + (w.weapons.spit > 0 ? 1 : 0) +
    (w.weapons.dogs > 0 ? 1 : 0) + (w.weapons.barrel > 0 ? 1 : 0)
  for (let i = 0; i < UPGRADES.length; i++) {
    const u = UPGRADES[i]
    if (!u.avail(w) || u.lvl(w) >= u.max) continue
    cand.push(i)
    // эволюция — редкий момент, пусть бросается в глаза
    weights.push(u.id === 'w_sun' ? 3 : u.id.startsWith('w_') && armed < 2 ? 2 : 1)
  }
  // взвешенный выбор без возвращения
  for (let k = 0; k < 3; k++) {
    let total = 0
    for (let i = 0; i < cand.length; i++) total += weights[i]
    if (total <= 0) { out[k] = -1; continue }
    let roll = w.rng.next() * total
    let pick = cand.length - 1
    for (let i = 0; i < cand.length; i++) {
      roll -= weights[i]
      if (roll < 0) { pick = i; break }
    }
    out[k] = cand[pick]
    weights[pick] = 0
  }
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V']

export function roman(n: number): string {
  return n >= 0 && n < ROMAN.length ? ROMAN[n] : String(n)
}
