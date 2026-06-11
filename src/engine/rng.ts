// mulberry32 — маленький детерминированный ГПСЧ для воспроизводимых ранов (?seed=).
export class RNG {
  private s: number

  constructor(seed: number) {
    this.s = seed >>> 0
    if (this.s === 0) this.s = 0x9e3779b9
  }

  next(): number {
    let t = (this.s += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  range(a: number, b: number): number {
    return a + (b - a) * this.next()
  }

  int(n: number): number {
    return (this.next() * n) | 0
  }
}
