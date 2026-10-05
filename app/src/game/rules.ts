import type { Piece, PieceKind, Pos, Side, Submission } from './types'

export const COLS = 9
export const ROWS = 10

export const PIECE_NAME: Record<Side, Record<PieceKind, string>> = {
  red: {
    general: '帅',
    advisor: '仕',
    elephant: '相',
    chariot: '俥',
    horse: '傌',
    cannon: '炮',
    soldier: '兵',
  },
  black: {
    general: '将',
    advisor: '士',
    elephant: '象',
    chariot: '车',
    horse: '马',
    cannon: '炮',
    soldier: '卒',
  },
}

/** §3.1 棋子等级：将 > 车 > 马 > 炮 > 士 > 象 > 兵 */
export const BASE_GRADE: Record<PieceKind, number> = {
  general: 7,
  chariot: 6,
  horse: 5,
  cannon: 4,
  advisor: 3,
  elephant: 2,
  soldier: 1,
}

/** AI 估值用的子力价值 */
const PIECE_VALUE: Record<PieceKind, number> = {
  general: 1000,
  chariot: 60,
  horse: 52,
  cannon: 45,
  advisor: 30,
  elephant: 20,
  soldier: 10,
}

const CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']

const BACK_RANK: PieceKind[] = [
  'chariot',
  'horse',
  'elephant',
  'advisor',
  'general',
  'advisor',
  'elephant',
  'horse',
  'chariot',
]

export function other(side: Side): Side {
  return side === 'red' ? 'black' : 'red'
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS
}

export function samePos(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y
}

export function posKey(p: Pos): string {
  return `${p.x},${p.y}`
}

/** 己方底线所在的半场：黑 y 0..4，红 y 5..9 */
export function ownHalf(side: Side, y: number): boolean {
  return side === 'red' ? y >= 5 : y <= 4
}

export function crossedRiver(piece: Piece): boolean {
  return !ownHalf(piece.side, piece.y)
}

/** 前进方向：红向上（y 减小），黑向下（y 增大） */
export function forward(side: Side): number {
  return side === 'red' ? -1 : 1
}

export function promotionRank(side: Side): number {
  return side === 'red' ? 0 : 9
}

export function inPalace(side: Side, x: number, y: number): boolean {
  if (x < 3 || x > 5) return false
  return side === 'red' ? y >= 7 && y <= 9 : y >= 0 && y <= 2
}

export function gradeOf(piece: Piece): number {
  // §7.3 升格后等级视为 3（等同士）
  if (piece.kind === 'soldier' && piece.promoted) return BASE_GRADE.advisor
  return BASE_GRADE[piece.kind]
}

export function valueOf(piece: Piece): number {
  if (piece.kind === 'soldier' && piece.promoted) return PIECE_VALUE.advisor
  return PIECE_VALUE[piece.kind]
}

export function pieceAt(pieces: Piece[], x: number, y: number): Piece | undefined {
  return pieces.find((p) => p.x === x && p.y === y)
}

export function findGeneral(pieces: Piece[], side: Side): Piece | undefined {
  return pieces.find((p) => p.side === side && p.kind === 'general')
}

export function createInitialPieces(): Piece[] {
  const pieces: Piece[] = []
  const push = (side: Side, kind: PieceKind, x: number, y: number) => {
    pieces.push({ id: `${side[0]}${kind}${x}${y}`, side, kind, x, y, promoted: false })
  }
  BACK_RANK.forEach((kind, x) => push('black', kind, x, 0))
  push('black', 'cannon', 1, 2)
  push('black', 'cannon', 7, 2)
  for (const x of [0, 2, 4, 6, 8]) push('black', 'soldier', x, 3)
  BACK_RANK.forEach((kind, x) => push('red', kind, x, 9))
  push('red', 'cannon', 1, 7)
  push('red', 'cannon', 7, 7)
  for (const x of [0, 2, 4, 6, 8]) push('red', 'soldier', x, 6)
  return pieces
}

/** §7.1 白脸将：双方帅将在同一直线且中间无子 */
export function generalsFacing(pieces: Piece[]): boolean {
  const red = findGeneral(pieces, 'red')
  const black = findGeneral(pieces, 'black')
  if (!red || !black || red.x !== black.x) return false
  const top = Math.min(red.y, black.y)
  const bottom = Math.max(red.y, black.y)
  for (let y = top + 1; y < bottom; y++) {
    if (pieceAt(pieces, red.x, y)) return false
  }
  return true
}

function stepMoves(
  out: Pos[],
  piece: Piece,
  pieces: Piece[],
  deltas: Array<[number, number]>,
): void {
  for (const [dx, dy] of deltas) {
    const x = piece.x + dx
    const y = piece.y + dy
    if (!inBounds(x, y)) continue
    const occupant = pieceAt(pieces, x, y)
    if (occupant && occupant.side === piece.side) continue
    out.push({ x, y })
  }
}

/** 只按走法几何判断（不含白脸将过滤） */
export function pseudoMoves(piece: Piece, pieces: Piece[]): Pos[] {
  const out: Pos[] = []
  switch (piece.kind) {
    case 'general':
      // §7.1 将/帅不可动
      return out
    case 'advisor': {
      const deltas: Array<[number, number]> = [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]
      for (const [dx, dy] of deltas) {
        const x = piece.x + dx
        const y = piece.y + dy
        if (inPalace(piece.side, x, y)) stepMoves(out, piece, pieces, [[dx, dy]])
      }
      break
    }
    case 'elephant': {
      const deltas: Array<[number, number]> = [
        [2, 2],
        [2, -2],
        [-2, 2],
        [-2, -2],
      ]
      for (const [dx, dy] of deltas) {
        const x = piece.x + dx
        const y = piece.y + dy
        if (!inBounds(x, y)) continue
        // 塞眼
        if (pieceAt(pieces, piece.x + dx / 2, piece.y + dy / 2)) continue
        // 不能过河
        if (!ownHalf(piece.side, y)) continue
        const occupant = pieceAt(pieces, x, y)
        if (occupant && occupant.side === piece.side) continue
        out.push({ x, y })
      }
      break
    }
    case 'horse': {
      const jumps: Array<[number, number, number, number]> = [
        [1, 2, 0, 1],
        [1, -2, 0, -1],
        [-1, 2, 0, 1],
        [-1, -2, 0, -1],
        [2, 1, 1, 0],
        [2, -1, 1, 0],
        [-2, 1, -1, 0],
        [-2, -1, -1, 0],
      ]
      for (const [dx, dy, lx, ly] of jumps) {
        const x = piece.x + dx
        const y = piece.y + dy
        if (!inBounds(x, y)) continue
        // 蹩马腿
        if (pieceAt(pieces, piece.x + lx, piece.y + ly)) continue
        const occupant = pieceAt(pieces, x, y)
        if (occupant && occupant.side === piece.side) continue
        out.push({ x, y })
      }
      break
    }
    case 'chariot': {
      for (const [dx, dy] of DIRS) {
        let x = piece.x + dx
        let y = piece.y + dy
        while (inBounds(x, y)) {
          const occupant = pieceAt(pieces, x, y)
          if (!occupant) {
            out.push({ x, y })
          } else {
            if (occupant.side !== piece.side) out.push({ x, y })
            break
          }
          x += dx
          y += dy
        }
      }
      break
    }
    case 'cannon': {
      for (const [dx, dy] of DIRS) {
        let x = piece.x + dx
        let y = piece.y + dy
        while (inBounds(x, y) && !pieceAt(pieces, x, y)) {
          out.push({ x, y })
          x += dx
          y += dy
        }
        // 越过唯一炮架后的第一个子才可吃
        x += dx
        y += dy
        while (inBounds(x, y)) {
          const occupant = pieceAt(pieces, x, y)
          if (occupant) {
            if (occupant.side !== piece.side) out.push({ x, y })
            break
          }
          x += dx
          y += dy
        }
      }
      break
    }
    case 'soldier': {
      const fwd = forward(piece.side)
      stepMoves(out, piece, pieces, [[0, fwd]])
      if (crossedRiver(piece)) {
        stepMoves(out, piece, pieces, [
          [1, 0],
          [-1, 0],
        ])
        // §7.3 升格后可后退一格
        if (piece.promoted) stepMoves(out, piece, pieces, [[0, -fwd]])
      }
      break
    }
  }
  return out
}

export const DIRS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

function withMove(pieces: Piece[], piece: Piece, to: Pos): Piece[] {
  return pieces.map((p) =>
    p.id === piece.id ? { ...p, x: to.x, y: to.y } : p,
  )
}

export interface RuleOptions {
  facingRule: boolean
}

/** §5.1 提交时的合法性检查 */
export function legalMoves(
  piece: Piece,
  pieces: Piece[],
  options: RuleOptions,
): Pos[] {
  const raw = pseudoMoves(piece, pieces)
  if (!options.facingRule) return raw
  return raw.filter((to) => !generalsFacing(withMove(pieces, piece, to)))
}

export function isLegalTarget(
  piece: Piece,
  pieces: Piece[],
  to: Pos,
  options: RuleOptions,
): boolean {
  return legalMoves(piece, pieces, options).some((p) => samePos(p, to))
}

export function sidePieces(pieces: Piece[], side: Side): Piece[] {
  return pieces.filter((p) => p.side === side)
}

/** §8 围困判定：己方是否还有可动棋子 */
export function hasAnyLegalMove(
  side: Side,
  pieces: Piece[],
  options: RuleOptions,
): boolean {
  return sidePieces(pieces, side).some(
    (p) => legalMoves(p, pieces, options).length > 0,
  )
}

/** 所有合法着法（AI 用） */
export function allLegalMoves(
  side: Side,
  pieces: Piece[],
  options: RuleOptions,
): Array<{ piece: Piece; to: Pos }> {
  const out: Array<{ piece: Piece; to: Pos }> = []
  for (const piece of sidePieces(pieces, side)) {
    for (const to of legalMoves(piece, pieces, options)) {
      out.push({ piece, to })
    }
  }
  return out
}

/** 移动过程中依次经过的格子（含起点与终点），用于 §6.4 擦肩判定 */
export function pathOf(piece: Piece, from: Pos, to: Pos): Pos[] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (piece.kind === 'chariot' || piece.kind === 'cannon') {
    const steps = Math.max(Math.abs(dx), Math.abs(dy))
    const sx = Math.sign(dx)
    const sy = Math.sign(dy)
    const path: Pos[] = []
    for (let i = 0; i <= steps; i++) {
      path.push({ x: from.x + sx * i, y: from.y + sy * i })
    }
    return path
  }
  if (piece.kind === 'horse') {
    const leg =
      Math.abs(dx) === 2
        ? { x: from.x + dx / 2, y: from.y }
        : { x: from.x, y: from.y + dy / 2 }
    return [from, leg, to]
  }
  if (piece.kind === 'elephant') {
    return [from, { x: from.x + dx / 2, y: from.y + dy / 2 }, to]
  }
  return [from, to]
}

export function fileLabel(side: Side, x: number): string {
  return side === 'red' ? CN[9 - x] : String(x + 1)
}

export function stepLabel(side: Side, n: number): string {
  return side === 'red' ? CN[n] : String(n)
}

/** 中文纵线记法，如 炮二平五 / 马8进7 */
export function moveLabel(piece: Piece, from: Pos, to: Pos): string {
  const name = PIECE_NAME[piece.side][piece.kind]
  const dy = to.y - from.y
  if (dy === 0) {
    return `${name}${fileLabel(piece.side, from.x)}平${fileLabel(piece.side, to.x)}`
  }
  const toward = piece.side === 'red' ? dy < 0 : dy > 0
  const verb = toward ? '进' : '退'
  if (piece.kind === 'advisor' || piece.kind === 'elephant' || piece.kind === 'horse') {
    return `${name}${fileLabel(piece.side, from.x)}${verb}${fileLabel(piece.side, to.x)}`
  }
  return `${name}${fileLabel(piece.side, from.x)}${verb}${stepLabel(piece.side, Math.abs(dy))}`
}

export function describeSubmission(
  pieces: Piece[],
  submission: Submission,
  side: Side,
): string {
  const sideName = side === 'red' ? '红方' : '黑方'
  if (!submission) return `${sideName} 按兵不动`
  const piece = pieceAt(pieces, submission.from.x, submission.from.y)
  if (!piece) return `${sideName} 无名着法`
  return `${sideName} ${moveLabel(piece, submission.from, submission.to)}`
}
