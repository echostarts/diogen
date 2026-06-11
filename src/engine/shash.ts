// Spatial hash на typed arrays (counting sort): ноль аллокаций на тик.
// Сетка центрируется на игроке каждый тик; всё за пределами прижимается к краю.

export class SpatialHash {
  readonly cell: number
  readonly cols: number
  readonly rows: number
  /** Результаты последнего query — индексы сущностей. */
  readonly out: Int32Array

  private ox = 0
  private oy = 0
  private n = 0
  private readonly start: Int32Array   // начало каждой ячейки (после build)
  private readonly cursor: Int32Array
  private readonly cellOf: Int32Array  // временно: ячейка каждого элемента
  private readonly tmpIdx: Int32Array
  private readonly items: Int32Array   // индексы, отсортированные по ячейкам

  constructor(cell = 44, cols = 64, rows = 64, cap = 512) {
    this.cell = cell
    this.cols = cols
    this.rows = rows
    const cells = cols * rows
    this.start = new Int32Array(cells + 1)
    this.cursor = new Int32Array(cells + 1)
    this.cellOf = new Int32Array(cap)
    this.tmpIdx = new Int32Array(cap)
    this.items = new Int32Array(cap)
    this.out = new Int32Array(cap)
  }

  /** Начать заполнение, центр сетки в (cx, cy). */
  begin(cx: number, cy: number): void {
    this.ox = cx - (this.cols * this.cell) / 2
    this.oy = cy - (this.rows * this.cell) / 2
    this.n = 0
    this.start.fill(0)
  }

  add(idx: number, x: number, y: number): void {
    if (this.n >= this.tmpIdx.length) return
    let cx = ((x - this.ox) / this.cell) | 0
    let cy = ((y - this.oy) / this.cell) | 0
    if (cx < 0) cx = 0; else if (cx >= this.cols) cx = this.cols - 1
    if (cy < 0) cy = 0; else if (cy >= this.rows) cy = this.rows - 1
    const c = cy * this.cols + cx
    this.cellOf[this.n] = c
    this.tmpIdx[this.n] = idx
    this.start[c + 1]++
    this.n++
  }

  build(): void {
    const cells = this.cols * this.rows
    for (let c = 0; c < cells; c++) this.start[c + 1] += this.start[c]
    for (let c = 0; c <= cells; c++) this.cursor[c] = this.start[c]
    for (let i = 0; i < this.n; i++) {
      const c = this.cellOf[i]
      this.items[this.cursor[c]++] = this.tmpIdx[i]
    }
  }

  /** Кандидаты в круге (x,y,r) → this.out, возвращает количество. */
  query(x: number, y: number, r: number): number {
    let cx0 = ((x - r - this.ox) / this.cell) | 0
    let cy0 = ((y - r - this.oy) / this.cell) | 0
    let cx1 = ((x + r - this.ox) / this.cell) | 0
    let cy1 = ((y + r - this.oy) / this.cell) | 0
    if (cx0 < 0) cx0 = 0
    if (cy0 < 0) cy0 = 0
    if (cx1 >= this.cols) cx1 = this.cols - 1
    if (cy1 >= this.rows) cy1 = this.rows - 1
    let count = 0
    const cap = this.out.length
    for (let cy = cy0; cy <= cy1; cy++) {
      const row = cy * this.cols
      for (let cx = cx0; cx <= cx1; cx++) {
        const c = row + cx
        const e = this.start[c + 1]
        for (let k = this.start[c]; k < e; k++) {
          if (count < cap) this.out[count++] = this.items[k]
        }
      }
    }
    return count
  }
}
