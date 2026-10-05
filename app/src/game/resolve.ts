import type {
  Piece,
  Pos,
  PlannedMove,
  ResolvedRound,
  Side,
  Submission,
  VerdictEvent,
} from './types'
import {
  PIECE_NAME,
  describeSubmission,
  findGeneral,
  generalsFacing,
  gradeOf,
  hasAnyLegalMove,
  other,
  pathOf,
  pieceAt,
  promotionRank,
  samePos,
} from './rules'

export interface ResolveOptions {
  facingRule: boolean
  promoteSoldier: boolean
  /** AI 推演用：跳过胜负/受困判定以省算力 */
  light?: boolean
}

interface Mover {
  side: Side
  piece: Piece
  move: PlannedMove
  path: Pos[]
}

export function sideName(side: Side): string {
  return side === 'red' ? '红方' : '黑方'
}

export function pieceName(piece: Piece): string {
  return `${sideName(piece.side)}${PIECE_NAME[piece.side][piece.kind]}`
}

/**
 * §6.4 擦肩判定：把两枚移动棋子看作在本回合内匀速沿路径折线移动，
 * 若存在同一时刻两者位于同一位置则判为路径交叉（含直线对穿交换位置）。
 * 同向行驶、错时经过同一格都不会触发。
 */
function meetPoint(pathA: Pos[], pathB: Pos[]): Pos | null {
  const lenA = pathA.length - 1
  const lenB = pathB.length - 1
  if (lenA < 1 || lenB < 1) return null
  const eps = 1e-9
  for (let i = 0; i < lenA; i++) {
    for (let j = 0; j < lenB; j++) {
      const from = Math.max(i / lenA, j / lenB)
      const to = Math.min((i + 1) / lenA, (j + 1) / lenB)
      if (to < from - eps) continue
      const a0 = pathA[i]
      const a1 = pathA[i + 1]
      const b0 = pathB[j]
      const b1 = pathB[j + 1]
      const ua = { x: a1.x - a0.x, y: a1.y - a0.y }
      const ub = { x: b1.x - b0.x, y: b1.y - b0.y }
      // pos(t) = c + len * t * u
      const ca = { x: a0.x - i * ua.x, y: a0.y - i * ua.y }
      const cb = { x: b0.x - j * ub.x, y: b0.y - j * ub.y }
      const kx = lenA * ua.x - lenB * ub.x
      const ky = lenA * ua.y - lenB * ub.y
      const rx = cb.x - ca.x
      const ry = cb.y - ca.y
      let t = Number.NaN
      if (Math.abs(kx) > eps) t = rx / kx
      else if (Math.abs(ky) > eps) {
        if (Math.abs(rx) > eps) continue
        t = ry / ky
      } else {
        // 速度向量完全相同：除非重合，否则永不相遇
        continue
      }
      if (!Number.isFinite(t) || t <= eps || t > 1 + eps) continue
      if (t < from - eps || t > to + eps) continue
      const pa = { x: ca.x + lenA * t * ua.x, y: ca.y + lenA * t * ua.y }
      const pb = { x: cb.x + lenB * t * ub.x, y: cb.y + lenB * t * ub.y }
      if (Math.abs(pa.x - pb.x) > 1e-6 || Math.abs(pa.y - pb.y) > 1e-6) continue
      return { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }
    }
  }
  return null
}

/** §6.2 双方移动棋子争夺同一格 */
function contestSquares(
  a: Mover,
  b: Mover,
  removed: Set<string>,
  landed: Map<string, Pos>,
  events: VerdictEvent[],
): void {
  const aCannon = a.piece.kind === 'cannon'
  const bCannon = b.piece.kind === 'cannon'
  if (aCannon && bCannon) {
    removed.add(a.piece.id)
    removed.add(b.piece.id)
    events.push({
      kind: 'contest',
      rule: '6.2.1',
      text: `${pieceName(a.piece)} 与 ${pieceName(b.piece)} 同为移动炮争夺同一格 → 同归于尽`,
    })
    return
  }
  if (aCannon || bCannon) {
    const winner = aCannon ? a : b
    const loser = aCannon ? b : a
    removed.add(loser.piece.id)
    landed.set(winner.piece.id, winner.move.to)
    events.push({
      kind: 'contest',
      side: winner.side,
      rule: '6.2.1',
      text: `${pieceName(winner.piece)} 移动炮必胜 → 吃掉 ${pieceName(loser.piece)}（无视等级）`,
    })
    return
  }
  const ga = gradeOf(a.piece)
  const gb = gradeOf(b.piece)
  if (ga === gb) {
    removed.add(a.piece.id)
    removed.add(b.piece.id)
    events.push({
      kind: 'contest',
      rule: '6.2.3',
      text: `${pieceName(a.piece)} 与 ${pieceName(b.piece)} 同为等级 ${ga} 争夺同一格 → 同归于尽`,
    })
    return
  }
  const winner = ga > gb ? a : b
  const loser = ga > gb ? b : a
  removed.add(loser.piece.id)
  landed.set(winner.piece.id, winner.move.to)
  events.push({
    kind: 'contest',
    side: winner.side,
    rule: '6.2.2',
    text: `${pieceName(winner.piece)}（等级 ${Math.max(ga, gb)}）胜 ${pieceName(loser.piece)}（等级 ${Math.min(ga, gb)}）→ 占格`,
  })
}

/** §6.4 路径交叉：双方同归于尽 */
function crossOut(a: Mover, b: Mover, where: Pos, removed: Set<string>, events: VerdictEvent[]): void {
  removed.add(a.piece.id)
  removed.add(b.piece.id)
  const onSquare = Number.isInteger(where.x) && Number.isInteger(where.y)
  events.push({
    kind: 'cross',
    rule: '6.4',
    text: `${pieceName(a.piece)} 与 ${pieceName(b.piece)} 路径交叉${
      onSquare ? `于 (${where.x + 1}, ${where.y + 1})` : '（途中相遇）'
    } → 同归于尽，两格留空`,
  })
}

/**
 * 单方落点结算。
 * §6.5：目标格若为静止的非炮敌子，按传统吃子；静止的炮则按 §6.2 争夺。
 */
function landMover(
  mover: Mover,
  rival: Mover | null,
  snapshot: Piece[],
  removed: Set<string>,
  landed: Map<string, Pos>,
  events: VerdictEvent[],
): void {
  const to = mover.move.to
  const occupant = pieceAt(snapshot, to.x, to.y)
  if (occupant && rival && occupant.id === rival.piece.id) {
    // 对手本回合离开此格：格已空，直接落位
    landed.set(mover.piece.id, to)
    events.push({
      kind: 'move',
      side: mover.side,
      text: `${pieceName(mover.piece)} 落入 ${pieceName(occupant)} 让出的空格`,
    })
    return
  }
  if (!occupant) {
    landed.set(mover.piece.id, to)
    events.push({
      kind: 'move',
      side: mover.side,
      text: `${pieceName(mover.piece)} 走到空格`,
    })
    return
  }
  if (occupant.side === mover.side) {
    // 提交阶段已禁止，兜底不动
    events.push({
      kind: 'move',
      side: mover.side,
      text: `${pieceName(mover.piece)} 的着法落点上有己方棋子，视为无效`,
    })
    return
  }
  if (occupant.kind === 'general') {
    removed.add(occupant.id)
    landed.set(mover.piece.id, to)
    events.push({
      kind: 'capture',
      side: mover.side,
      rule: '6.3',
      text: `${pieceName(mover.piece)} 吃掉 ${pieceName(occupant)} → 立即获胜`,
    })
    return
  }
  if (occupant.kind === 'cannon') {
    if (mover.piece.kind === 'cannon') {
      removed.add(occupant.id)
      landed.set(mover.piece.id, to)
      events.push({
        kind: 'contest',
        side: mover.side,
        rule: '6.2.1',
        text: `${pieceName(mover.piece)} 移动炮必胜静止的 ${pieceName(occupant)} → 占格`,
      })
      return
    }
    const gm = gradeOf(mover.piece)
    const gs = gradeOf(occupant)
    if (gm > gs) {
      removed.add(occupant.id)
      landed.set(mover.piece.id, to)
      events.push({
        kind: 'contest',
        side: mover.side,
        rule: '6.5',
        text: `${pieceName(mover.piece)}（等级 ${gm}）吃掉静止的炮（等级 ${gs}）`,
      })
      return
    }
    removed.add(mover.piece.id)
    events.push({
      kind: 'contest',
      side: other(mover.side),
      rule: '6.5',
      text: `${pieceName(mover.piece)}（等级 ${gm}）冲撞静止的炮（等级 ${gs}）反被吃 → ${pieceName(mover.piece)} 阵亡`,
    })
    return
  }
  removed.add(occupant.id)
  landed.set(mover.piece.id, to)
  events.push({
    kind: 'capture',
    side: mover.side,
    rule: '6.5',
    text: `${pieceName(mover.piece)} 吃掉 ${pieceName(occupant)}`,
  })
}

/** 假设只有这一方行动，是否形成白脸将（用于 §7.1 违规方判定） */
function soloFacing(snapshot: Piece[], mover: Mover | null): boolean {
  if (!mover) return false
  const occupant = pieceAt(snapshot, mover.move.to.x, mover.move.to.y)
  const after = snapshot
    .filter((p) => p.id !== mover.piece.id)
    .filter((p) => !(occupant && p.id === occupant.id && occupant.side !== mover.side))
    .concat([{ ...mover.piece, x: mover.move.to.x, y: mover.move.to.y }])
  return generalsFacing(after)
}

function blockerOnKingFile(snapshot: Piece[], piece: Piece): boolean {
  const red = findGeneral(snapshot, 'red')
  const black = findGeneral(snapshot, 'black')
  if (!red || !black || red.x !== black.x) return false
  const top = Math.min(red.y, black.y)
  const bottom = Math.max(red.y, black.y)
  return piece.x === red.x && piece.y > top && piece.y < bottom
}

export function resolveRound(
  snapshot: Piece[],
  round: number,
  redSubmission: Submission,
  blackSubmission: Submission,
  options: ResolveOptions,
): ResolvedRound {
  const events: VerdictEvent[] = []
  const removed = new Set<string>()
  const landed = new Map<string, Pos>()

  const buildMover = (submission: Submission): Mover | null => {
    if (!submission) return null
    const piece = snapshot.find((p) => p.id === submission.pieceId)
    if (!piece) return null
    return { side: piece.side, piece, move: submission, path: pathOf(piece, submission.from, submission.to) }
  }

  const redMover = buildMover(redSubmission)
  const blackMover = buildMover(blackSubmission)

  if (!redMover && !blackMover) {
    events.push({ kind: 'pass', text: '双方按兵不动，盘面维持原状' })
  } else if (redMover && blackMover) {
    if (samePos(redMover.move.to, blackMover.move.to)) {
      contestSquares(redMover, blackMover, removed, landed, events)
    } else {
      const meet = meetPoint(redMover.path, blackMover.path)
      if (meet) {
        crossOut(redMover, blackMover, meet, removed, events)
      } else {
        landMover(redMover, blackMover, snapshot, removed, landed, events)
        landMover(blackMover, redMover, snapshot, removed, landed, events)
      }
    }
  } else {
    const mover = (redMover ?? blackMover) as Mover
    const quiet = other(mover.side)
    events.push({ kind: 'pass', side: quiet, text: `${sideName(quiet)} 按兵不动` })
    landMover(mover, null, snapshot, removed, landed, events)
  }

  // 生成结算后的盘面
  let pieces = snapshot
    .filter((p) => !removed.has(p.id))
    .map((p) => {
      const to = landed.get(p.id)
      return to ? { ...p, x: to.x, y: to.y } : p
    })

  // §7.3 底兵升格
  if (options.promoteSoldier) {
    pieces = pieces.map((p) => {
      if (p.kind !== 'soldier' || p.promoted) return p
      if (p.y !== promotionRank(p.side)) return p
      if (!landed.has(p.id)) return p
      events.push({
        kind: 'promote',
        side: p.side,
        rule: '7.3',
        text: `${pieceName(p)} 抵达对方底线 → 升格，等级视为 3 且可后退`,
      })
      return { ...p, promoted: true }
    })
  }

  let winner: Side | 'draw' | null = null
  let reason = ''

  const redGeneralLost = !!findGeneral(snapshot, 'red') && !findGeneral(pieces, 'red')
  const blackGeneralLost = !!findGeneral(snapshot, 'black') && !findGeneral(pieces, 'black')
  if (redGeneralLost && blackGeneralLost) {
    winner = 'draw'
    reason = '双方帅将同回合同被吃 → 和棋（§8）'
  } else if (blackGeneralLost) {
    winner = 'red'
    reason = '红方吃掉黑将 → 红方胜（§6.3）'
  } else if (redGeneralLost) {
    winner = 'black'
    reason = '黑方吃掉红帅 → 黑方胜（§6.3）'
  } else if (options.facingRule && generalsFacing(pieces)) {
    const redAtFault = soloFacing(snapshot, redMover)
    const blackAtFault = soloFacing(snapshot, blackMover)
    const redAfter = redMover ? pieces.find((p) => p.id === redMover.piece.id) : undefined
    const blackAfter = blackMover ? pieces.find((p) => p.id === blackMover.piece.id) : undefined
    const redLeftBlocker =
      !!redMover &&
      blockerOnKingFile(snapshot, redMover.piece) &&
      !(redAfter && blockerOnKingFile(pieces, redAfter))
    const blackLeftBlocker =
      !!blackMover &&
      blockerOnKingFile(snapshot, blackMover.piece) &&
      !(blackAfter && blockerOnKingFile(pieces, blackAfter))
    const redGuilty = redAtFault || redLeftBlocker
    const blackGuilty = blackAtFault || blackLeftBlocker
    events.push({
      kind: 'facing',
      rule: '7.1',
      text: '结算后双方帅将在同一直线且中间无子（白脸将）',
    })
    if (redGuilty && !blackGuilty) {
      winner = 'black'
      reason = '红方造成白脸将，违规判负（§7.1）'
    } else if (blackGuilty && !redGuilty) {
      winner = 'red'
      reason = '黑方造成白脸将，违规判负（§7.1）'
    } else {
      winner = 'draw'
      reason = '双方同时造成白脸将，各判违规 → 和棋（§7.1 兜底）'
    }
  }

  if (!winner && !options.light) {
    const ruleOptions = { facingRule: options.facingRule }
    const redCanMove = hasAnyLegalMove('red', pieces, ruleOptions)
    const blackCanMove = hasAnyLegalMove('black', pieces, ruleOptions)
    if (!redCanMove && !blackCanMove) {
      winner = 'draw'
      reason = '双方均无合法着法 → 和棋（§8）'
    } else if (!blackCanMove) {
      winner = 'red'
      reason = '黑方全部可动棋子受困 → 红方围困胜（§8）'
    } else if (!redCanMove) {
      winner = 'black'
      reason = '红方全部可动棋子受困 → 黑方围困胜（§8）'
    }
  }

  const summaryParts: string[] = [
    describeSubmission(snapshot, redSubmission, 'red'),
    describeSubmission(snapshot, blackSubmission, 'black'),
  ]
  const decisive = events.find((e) => e.kind === 'contest' || e.kind === 'cross' || e.kind === 'capture')
  const summary = `${summaryParts.join('  vs  ')} ｜ ${decisive ? decisive.text : '无冲突，各自落位'}`

  return {
    round,
    red: redSubmission,
    black: blackSubmission,
    labels: { red: summaryParts[0], black: summaryParts[1] },
    pieces,
    events,
    summary,
    capture: removed.size > 0,
    winner,
    reason,
  }
}
