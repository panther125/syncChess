import type { Piece, PlannedMove, Side, Submission } from './types'
import {
  allLegalMoves,
  crossedRiver,
  findGeneral,
  gradeOf,
  other,
  pseudoMoves,
  samePos,
  valueOf,
} from './rules'
import type { ResolveOptions } from './resolve'
import { resolveRound } from './resolve'

export interface AiOptions extends ResolveOptions {
  level: 'easy' | 'normal'
}

function material(pieces: Piece[], side: Side): number {
  return pieces.reduce((sum, p) => (p.side === side ? sum + valueOf(p) : sum), 0)
}

/** 落位后这枚静止棋子面临的威胁（对手下回合可以冲撞 / 吃掉它） */
function captureRisk(after: Piece[], target: Piece): number {
  const enemy = other(target.side)
  let worst = 0
  for (const piece of after) {
    if (piece.side !== enemy) continue
    const canReach = pseudoMoves(piece, after).some((to) => samePos(to, target))
    if (!canReach) continue
    const mine = valueOf(target)
    const theirs = valueOf(piece)
    if (piece.kind === 'cannon') {
      // §6.2.1 移动炮必胜；若目标也是静止炮则同级同归于尽
      worst = Math.max(worst, target.kind === 'cannon' ? mine + theirs * 0.5 : mine)
      continue
    }
    if (target.kind === 'cannon') {
      // §6.5 冲撞静止的炮：等级比较
      const gm = gradeOf(target)
      const ga = gradeOf(piece)
      if (ga > gm) worst = Math.max(worst, mine)
      else if (ga < gm) worst = Math.max(worst, -theirs * 0.5)
      else worst = Math.max(worst, (mine + theirs) * 0.5)
      continue
    }
    worst = Math.max(worst, mine)
  }
  return worst
}

/** 向对方九宫推进的区位奖励 */
function advanceBonus(piece: Piece, pieces: Piece[]): number {
  const enemyGeneral = findGeneral(pieces, other(piece.side))
  if (!enemyGeneral) return 0
  const dist = Math.abs(piece.x - enemyGeneral.x) + Math.abs(piece.y - enemyGeneral.y)
  const riverBonus = piece.kind === 'soldier' && crossedRiver(piece) ? 6 : 0
  return Math.max(0, 12 - dist) * 0.8 + riverBonus
}

export function makeMove(piece: Piece, to: { x: number; y: number }): PlannedMove {
  return {
    pieceId: piece.id,
    side: piece.side,
    kind: piece.kind,
    from: { x: piece.x, y: piece.y },
    to: { x: to.x, y: to.y },
  }
}

export function chooseMove(
  snapshot: Piece[],
  side: Side,
  options: AiOptions,
  random = Math.random,
): Submission {
  const candidates = allLegalMoves(side, snapshot, options)
  if (candidates.length === 0) return null

  const scored: Array<{ move: PlannedMove; score: number }> = candidates.map(({ piece, to }) => {
    const move = makeMove(piece, to)
    const redMove = side === 'red' ? move : null
    const blackMove = side === 'black' ? move : null
    const res = resolveRound(snapshot, 0, redMove, blackMove, { ...options, light: true })
    let score =
      material(res.pieces, side) -
      material(snapshot, side) +
      (material(snapshot, other(side)) - material(res.pieces, other(side)))
    const landed = res.pieces.find((p) => p.id === piece.id)
    if (!landed) {
      score -= valueOf(piece) * 1.2
    } else {
      score -= captureRisk(res.pieces, landed) * 0.7
      score += advanceBonus(landed, res.pieces)
    }
    if (res.winner === side) score += 100000
    else if (res.winner && res.winner !== 'draw') score -= 100000
    return { move, score }
  })

  scored.sort((a, b) => b.score - a.score)

  const noise = options.level === 'easy' ? 18 : 4
  const jittered = scored.map((c) => ({ move: c.move, score: c.score - random() * noise }))
  jittered.sort((a, b) => b.score - a.score)
  const best = jittered[0]
  // 除非所有着法都明显亏损，否则 AI 不会主动按兵不动
  return best.score < -24 ? null : best.move
}
