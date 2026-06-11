import { PAL } from '../config'

/** Процедурные иконки апгрейдов/оружия. Рисует в квадрат size×size с центром (cx, cy). */
export function drawIcon(ctx: CanvasRenderingContext2D, id: string, cx: number, cy: number, size: number): void {
  const u = size / 24
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(u, u)
  ctx.lineCap = 'round'
  const cream = PAL.cream
  const ochre = PAL.ochre
  const glow = PAL.glow
  switch (id) {
    case 'w_lantern': {
      ctx.fillStyle = glow
      ctx.globalAlpha = 0.35
      ctx.beginPath()
      ctx.arc(0, 1, 11, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.fillStyle = cream
      ctx.fillRect(-5, -6, 10, 13)
      ctx.fillStyle = glow
      ctx.fillRect(-3, -3.6, 6, 8)
      ctx.fillStyle = cream
      ctx.fillRect(-1.6, -10, 3.2, 4)
      break
    }
    case 'w_sun': {
      ctx.fillStyle = glow
      ctx.globalAlpha = 0.3
      ctx.beginPath()
      ctx.arc(0, 0, 11.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.fillStyle = ochre
      ctx.beginPath()
      ctx.arc(0, 0, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = cream
      ctx.lineWidth = 2
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(Math.cos(a) * 8.2, Math.sin(a) * 8.2)
        ctx.lineTo(Math.cos(a) * 11.5, Math.sin(a) * 11.5)
        ctx.stroke()
      }
      break
    }
    case 'w_spit': {
      ctx.fillStyle = cream
      ctx.beginPath()
      ctx.moveTo(0, -10)
      ctx.quadraticCurveTo(7.5, 2, 0, 9)
      ctx.quadraticCurveTo(-7.5, 2, 0, -10)
      ctx.fill()
      ctx.fillStyle = ochre
      ctx.beginPath()
      ctx.arc(1.6, 2.6, 2.4, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'e_pack': {
      // три силуэта-пса уступом
      ctx.fillStyle = cream
      for (let k = 0; k < 3; k++) {
        const off = (k - 1) * 6
        ctx.globalAlpha = k === 1 ? 1 : 0.55
        ctx.beginPath()
        ctx.ellipse(off - 1, off * 0.5, 6.5, 3.4, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(off + 5.5, off * 0.5 - 2, 2.6, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.fillStyle = ochre
      ctx.beginPath()
      ctx.arc(4.5, -3, 1.4, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'e_fan': {
      // веер из трёх капель
      ctx.fillStyle = cream
      for (let k = -1; k <= 1; k++) {
        ctx.save()
        ctx.rotate(k * 0.5)
        ctx.globalAlpha = k === 0 ? 1 : 0.6
        ctx.beginPath()
        ctx.moveTo(0, -10.5)
        ctx.quadraticCurveTo(4.6, 0, 0, 5.5)
        ctx.quadraticCurveTo(-4.6, 0, 0, -10.5)
        ctx.fill()
        ctx.restore()
      }
      ctx.globalAlpha = 1
      break
    }
    case 'e_pithos': {
      // пифос — большая остродонная бочка
      ctx.fillStyle = cream
      ctx.beginPath()
      ctx.moveTo(-8.5, -7)
      ctx.quadraticCurveTo(-10.5, 2, 0, 11)
      ctx.quadraticCurveTo(10.5, 2, 8.5, -7)
      ctx.closePath()
      ctx.fill()
      ctx.fillRect(-9.5, -9.5, 19, 3.2)
      ctx.strokeStyle = ochre
      ctx.lineWidth = 1.8
      ctx.beginPath(); ctx.moveTo(-8.8, -2.4); ctx.lineTo(8.8, -2.4); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(-6.6, 3.4); ctx.lineTo(6.6, 3.4); ctx.stroke()
      break
    }
    case 'w_dogs':
    case 'p_dog': {
      ctx.fillStyle = cream
      ctx.beginPath()
      ctx.ellipse(-1, 1, 7, 4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(6.5, -2, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillRect(-6.5, 3, 2, 5)
      ctx.fillRect(2.5, 3, 2, 5)
      ctx.strokeStyle = cream
      ctx.lineWidth = 1.8
      ctx.beginPath()
      ctx.moveTo(-7.5, 0)
      ctx.quadraticCurveTo(-11, -3, -9.5, -6)
      ctx.stroke()
      if (id === 'p_dog') {
        ctx.strokeStyle = ochre
        ctx.lineWidth = 2.4
        ctx.beginPath()
        ctx.moveTo(7, -10.5); ctx.lineTo(7, -4.5)
        ctx.moveTo(4, -7.5); ctx.lineTo(10, -7.5)
        ctx.stroke()
      }
      break
    }
    case 'w_barrel': {
      ctx.fillStyle = cream
      ctx.beginPath()
      ctx.roundRect(-9, -7, 18, 14, 5)
      ctx.fill()
      ctx.strokeStyle = PAL.ink2
      ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.moveTo(-9, -2.4); ctx.lineTo(9, -2.4); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(-9, 2.8); ctx.lineTo(9, 2.8); ctx.stroke()
      ctx.strokeStyle = ochre
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(11, -8)
      ctx.quadraticCurveTo(14, 0, 11, 8)
      ctx.stroke()
      break
    }
    case 'p_dmg': {
      ctx.fillStyle = cream
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        const r = i % 2 === 0 ? 10 : 4.4
        const x = Math.cos(a) * r
        const y = Math.sin(a) * r
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = ochre
      ctx.beginPath()
      ctx.arc(0, 0, 2.6, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'p_aspd': {
      ctx.strokeStyle = cream
      ctx.lineWidth = 3.4
      ctx.beginPath()
      ctx.moveTo(-8, -8); ctx.lineTo(-1, 0); ctx.lineTo(-8, 8)
      ctx.stroke()
      ctx.strokeStyle = ochre
      ctx.beginPath()
      ctx.moveTo(1, -8); ctx.lineTo(8, 0); ctx.lineTo(1, 8)
      ctx.stroke()
      break
    }
    case 'p_area': {
      ctx.strokeStyle = cream
      ctx.lineWidth = 2.2
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.stroke()
      ctx.globalAlpha = 0.7
      ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI * 2); ctx.stroke()
      ctx.globalAlpha = 0.4
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.stroke()
      ctx.globalAlpha = 1
      break
    }
    case 'p_mspd': {
      // сандалия с ветерком
      ctx.fillStyle = cream
      ctx.beginPath()
      ctx.ellipse(1, 3, 8, 3.4, -0.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = cream
      ctx.lineWidth = 1.8
      ctx.beginPath(); ctx.moveTo(-2, 1); ctx.lineTo(2, -5); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(2, 1); ctx.lineTo(-1, -5); ctx.stroke()
      ctx.strokeStyle = ochre
      ctx.beginPath()
      ctx.moveTo(-11, -2); ctx.lineTo(-5, -2)
      ctx.moveTo(-12, 2); ctx.lineTo(-7, 2)
      ctx.stroke()
      break
    }
    case 'p_magnet': {
      // чаша, в которую само летит
      ctx.fillStyle = cream
      ctx.beginPath()
      ctx.arc(0, 2, 8, 0, Math.PI)
      ctx.closePath()
      ctx.fill()
      ctx.fillRect(-9.5, 0.5, 19, 2)
      ctx.fillStyle = ochre
      ctx.beginPath(); ctx.arc(-5, -6, 1.8, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(1, -9, 1.8, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(6, -5, 1.8, 0, Math.PI * 2); ctx.fill()
      break
    }
    case 'p_hp': {
      ctx.fillStyle = cream
      ctx.beginPath()
      ctx.ellipse(0, 1, 7, 9, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillRect(-3.4, -11.5, 6.8, 4)
      ctx.fillStyle = ochre
      ctx.fillRect(-7.2, -0.5, 14.4, 2.6)
      break
    }
    case 'p_pierce': {
      ctx.strokeStyle = ochre
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(-4, 0, 4.6, 0, Math.PI * 2); ctx.stroke()
      ctx.globalAlpha = 0.6
      ctx.beginPath(); ctx.arc(5, 0, 4.6, 0, Math.PI * 2); ctx.stroke()
      ctx.globalAlpha = 1
      ctx.strokeStyle = cream
      ctx.lineWidth = 2.6
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(11, 0); ctx.stroke()
      ctx.fillStyle = cream
      ctx.beginPath()
      ctx.moveTo(14, 0); ctx.lineTo(8, -3.6); ctx.lineTo(8, 3.6)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'p_ask': {
      // надтреснутая чаша: меньше — значит точнее
      ctx.fillStyle = cream
      ctx.beginPath()
      ctx.arc(0, -1, 8, 0, Math.PI)
      ctx.closePath()
      ctx.fill()
      ctx.fillRect(-2, 6, 4, 3)
      ctx.strokeStyle = PAL.ink2
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(2, -1); ctx.lineTo(4, 2.5); ctx.lineTo(1, 4.5)
      ctx.stroke()
      ctx.fillStyle = ochre
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - 0.3
        const r = i % 2 === 0 ? 4.6 : 2
        const x = 8 + Math.cos(a) * r
        const y = -8 + Math.sin(a) * r
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fill()
      break
    }
    default: {
      // похлёбка
      ctx.fillStyle = cream
      ctx.beginPath()
      ctx.arc(0, 1, 8.5, 0, Math.PI)
      ctx.closePath()
      ctx.fill()
      ctx.fillRect(-10, -0.5, 20, 2.4)
      ctx.strokeStyle = ochre
      ctx.lineWidth = 1.8
      ctx.beginPath()
      ctx.moveTo(-3.5, -4); ctx.quadraticCurveTo(-5.5, -7.5, -3.5, -10.5)
      ctx.moveTo(2, -4); ctx.quadraticCurveTo(0, -7.5, 2, -10.5)
      ctx.stroke()
    }
  }
  ctx.restore()
}
