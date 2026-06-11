// Все балансные ручки и палитра — в одном месте, чтобы калибровать не бегая по файлам.

export const VIEW_W = 1280
export const VIEW_H = 720
export const STEP = 1 / 60

// Палитра чернофигурной вазописи.
export const PAL = {
  bg: '#b25c28',      // терракота
  bgDark: '#96491e',
  ink: '#211510',     // тёплый почти-чёрный
  ink2: '#362115',
  ochre: '#e3a94f',
  cream: '#f3e6c8',
  blood: '#7e2f1d',
  olive: '#5d6b27',
  glow: '#ffd9a0',
}

// Цвета частиц по индексу (Particle.col).
export const PCOLS = [PAL.ink, PAL.blood, PAL.cream, PAL.ochre, PAL.olive, PAL.glow]
export const PC_INK = 0
export const PC_BLOOD = 1
export const PC_CREAM = 2
export const PC_OCHRE = 3
export const PC_OLIVE = 4
export const PC_GLOW = 5

// Типы врагов.
export const EK_MERCHANT = 0
export const EK_GUARD = 1
export const EK_PLATONIST = 2
export const EK_SOPHIST = 3
export const EK_PLATO = 4 // мини-босс на 2:30

export interface EnemyDef {
  hp: number
  speed: number
  r: number
  dmg: number
  xp: number
}

export const ENEMY_DEF: EnemyDef[] = [
  { hp: 13, speed: 98, r: 10, dmg: 7, xp: 2 },   // торговец: быстрый, хилый, x2 XP
  { hp: 36, speed: 60, r: 12, dmg: 10, xp: 1 },  // стражник
  { hp: 120, speed: 33, r: 17, dmg: 15, xp: 1 }, // платоник: танк
  { hp: 28, speed: 58, r: 11, dmg: 7, xp: 1 },   // софист: дистанция + снаряды
  { hp: 360, speed: 27, r: 26, dmg: 20, xp: 0 }, // сам Платон: мини-босс, зовёт платоников
]

// Играбельные персонажи.
export interface CharDef {
  id: string
  name: string
  hp: number
  speed: number
  /** Стартовое оружие. */
  start: 'lantern' | 'spit'
  /** Есть ли бочка (таран + рывок через оружие). */
  barrel: boolean
  /** Врождённое пробитие плевка. */
  pierce: number
  /** Без бочки: уворот на пробеле (перезарядка, сек). */
  dodgeCd: number
  desc: string
  cost: number // черепки; 0 = открыт сразу
}

export const CHARS: CharDef[] = [
  {
    id: 'diogen', name: 'ДИОГЕН', hp: 100, speed: 175,
    start: 'lantern', barrel: true, pierce: 0, dodgeCd: 0,
    desc: 'Бочка, фонарь и пять минут терпения. Классика жанра.',
    cost: 0,
  },
  {
    id: 'hipparchia', name: 'ГИППАРХИЯ', hp: 80, speed: 194,
    start: 'spit', barrel: false, pierce: 1, dodgeCd: 3.4,
    desc: 'Без бочки: быстрее, язык острее (+1 пробитие), ПРОБЕЛ — шаг в сторону.',
    cost: 150,
  },
]

export const CFG = {
  player: { hp: 100, speed: 175, r: 13, magnet: 125, pickup: 26, iframes: 0.5 },
  bossAt: 300, // секунда выхода Александра

  caps: { enemies: 360, projs: 280, gems: 420, parts: 700, nums: 120 },

  lantern: { dmg: 9, int: 0.55, radius: 64, orbit: 80, spin: 1.6, kb: 70 },
  spit: { dmg: 16, int: 0.72, speed: 470, range: 640, r: 5, kb: 140 },
  dogs: { dmg: 12, speed: 430, acquire: 460, chain: 340, hitCd: 0.4, base: 2 },
  barrel: {
    dmg: 16, thresh: 0.62, kb: 280, hitCd: 0.5,
    charge: 2.6, dashT: 0.38, dashMul: 2.7, dashDmg: 1.8,
  },

  sophist: { near: 210, far: 330, fireCd: 2.8, fireRange: 470, projSpeed: 135, projDmg: 10, projR: 7 },

  // Рост HP врагов со временем.
  hpScale: (t: number) => 1 + t / 120,

  // Кривая опыта.
  xpNeed: (lvl: number) => Math.round(4 + lvl * 2.6 + lvl * lvl * 0.1),

  spawn: {
    // [секунда, спавнов в секунду] — между точками линейная интерполяция
    rate: [
      [0, 0.9], [60, 1.7], [120, 2.6], [180, 3.5], [240, 4.3], [285, 5.2],
    ] as Array<[number, number]>,
    bursts: [45, 105, 165, 225, 265],
    ringDist: 730,
    afterBossMul: 0, // дуэль есть дуэль: толпу приводит только сам Александр
  },

  // Мини-босс Платон.
  mini: { at: 150, summonCd: 8, summonN: 3, gems: 12 },

  // Элитные граждане: реже, толще, щедрее.
  elite: { after: 100, chance: 0.04, hpMul: 3, rMul: 1.35, dmgMul: 1.25, spdMul: 0.88, xp: 6 },

  // Эволюции оружия.
  sun: { dmgMul: 1.6, radiusMul: 1.55, intMul: 0.85 },
  pack: { extraDogs: 3, dmgMul: 1.4, spdMul: 1.25 },
  fan: { count: 3, spread: 0.17 },
  pithos: { thresh: 0.35, chargeMul: 1.8, kbMul: 1.3 },

  // Лавка Диогена (мета-прогресс, черепки).
  meta: { costBase: 15, costStep: 25, max: 5, killsPerShard: 10, winBonus: 20 },

  boss: {
    hp: 3800, r: 30, speed: 56, enrageSpeed: 78,
    dashSpeed: 950, dashDmg: 27, touchDmg: 20, touchCd: 0.8,
    telegraph: 0.85, enrageTelegraph: 0.62, recover: 0.6,
    walkMin: 1.5, walkVar: 1.3,
    summonCd: 11, summonN: 5, cast: 0.9,
    lanternBonus: 1.5,
  },
}
