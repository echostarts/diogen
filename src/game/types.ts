export interface Enemy {
  uid: number
  kind: number // EK_*
  x: number
  y: number
  hp: number
  maxHp: number
  r: number
  speed: number
  dmg: number
  xp: number
  kx: number // knockback-скорость
  ky: number
  flash: number
  dying: boolean
  facing: number
  seed: number // фаза анимации/поведения, 0..1
  fire: number // кулдаун выстрела софиста
  ramCd: number
  dogCd: number
  elite: boolean
}

export interface Proj {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  dmg: number
  pierce: number
  life: number
  hostile: boolean
  lastUid: number
}

export interface Gem {
  x: number
  y: number
  v: number
  t: number
  pull: number
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  col: number
  drag: number
  /** 0 — квадратик, 1 — вращающийся глиняный черепок. */
  shape: number
  rot: number
  rotV: number
}

export interface DmgNum {
  x: number
  y: number
  v: number
  t: number
  big: boolean
}

export interface Floater {
  x: number
  y: number
  t: number
  text: string
}

// Состояния пса: 0 — рядом с игроком, 1 — рывок к цели, 2 — возврат.
export interface Dog {
  x: number
  y: number
  state: number
  tUid: number
  tIdx: number
  timer: number
  facing: number
  seed: number
}

export interface Boss {
  active: boolean
  dead: boolean
  x: number
  y: number
  r: number
  hp: number
  maxHp: number
  // 0 walk, 1 telegraph, 2 dash, 3 recover, 4 cast (призыв)
  phase: number
  pt: number
  dx: number
  dy: number
  dashLeft: number
  dashFull: number
  hitThisDash: boolean
  summonCd: number
  touchCd: number
  dogCd: number
  flash: number
  facing: number
}
