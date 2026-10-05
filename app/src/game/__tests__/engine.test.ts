import type { Piece, PlannedMove, Side } from '../types'
import { resolveRound } from '../resolve'
import { legalMoves, createInitialPieces, pieceAt, generalsFacing } from '../rules'
import { makeMove } from '../ai'

let failed = 0
function check(name: string, cond: boolean, extra = ''): void {
  if (cond) {
    console.log(`  ✓ ${name}`)
  } else {
    failed += 1
    console.log(`  ✗ ${name} ${extra}`)
  }
}

function p(side: Side, kind: Piece['kind'], x: number, y: number, promoted = false): Piece {
  return { id: `${side}-${kind}-${x}-${y}`, side, kind, x, y, promoted }
}

function mv(piece: Piece, x: number, y: number): PlannedMove {
  return makeMove(piece, { x, y })
}

const full = { facingRule: false, promoteSoldier: true }
const withFacing = { facingRule: true, promoteSoldier: true }

function run(
  pieces: Piece[],
  red: PlannedMove | null,
  black: PlannedMove | null,
  options = full,
) {
  return resolveRound(pieces, 1, red, black, options)
}

console.log('§3 / §5 走法合法性')
{
  const pieces = createInitialPieces()
  const cannon = pieces.find((q) => q.side === 'red' && q.kind === 'cannon' && q.x === 7) as Piece
  const moves = legalMoves(cannon, pieces, { facingRule: true })
  check('红炮开局可平移/直进', moves.length > 8, `got ${moves.length}`)
  const general = pieces.find((q) => q.side === 'red' && q.kind === 'general') as Piece
  check('§7.1 帅无任何合法着法', legalMoves(general, pieces, { facingRule: true }).length === 0)
  const horse = pieces.find((q) => q.side === 'red' && q.kind === 'horse' && q.x === 1) as Piece
  check('开局傌有 2 个跳点', legalMoves(horse, pieces, { facingRule: true }).length === 2)
  const elephant = pieces.find((q) => q.side === 'red' && q.kind === 'elephant' && q.x === 2) as Piece
  check('开局相有 2 个田字（塞眼后）', legalMoves(elephant, pieces, { facingRule: true }).length === 2)
  // 蹩马腿：正前方一格有子，则向前两格偏一跳全部受阻
  const board = [p('red', 'horse', 4, 5), p('black', 'soldier', 4, 4), p('black', 'general', 4, 0)]
  const h = board[0]
  const hm = legalMoves(h, board, { facingRule: false })
  check('蹩马腿：正面有子则不能向上直跳', !hm.some((t) => t.y === 3))
  // 炮架
  const cBoard = [p('red', 'cannon', 0, 0), p('black', 'soldier', 0, 2), p('black', 'chariot', 0, 5), p('red', 'general', 8, 9), p('black', 'general', 8, 0)]
  const c = cBoard[0]
  const cms = legalMoves(c, cBoard, { facingRule: false })
  check('炮隔一子可吃第二子', cms.some((t) => t.x === 0 && t.y === 5))
  check('炮不可吃紧邻炮架', !cms.some((t) => t.x === 0 && t.y === 2))
  check('炮直线移动路径无子才可行', cms.some((t) => t.x === 0 && t.y === 1) && !cms.some((t) => t.x === 0 && t.y === 4))
}

console.log('§6.2 同格争夺')
{
  const r = p('red', 'chariot', 0, 0)
  const b = p('black', 'horse', 8, 0)
  const res = run([r, b, p('red', 'general', 1, 9), p('black', 'general', 7, 9)], mv(r, 4, 0), mv(b, 4, 0))
  check('车(6) 胜 马(5)：马被吃，车占格', !!pieceAt(res.pieces, 4, 0) && pieceAt(res.pieces, 4, 0)?.side === 'red')
  check('裁决文案含 §6.2.2', res.events.some((e) => e.rule === '6.2.2'))

  const rc = p('red', 'cannon', 0, 4)
  const bc = p('black', 'chariot', 8, 4)
  const res2 = run([rc, bc, p('red', 'general', 1, 9), p('black', 'general', 7, 9)], mv(rc, 4, 4), mv(bc, 4, 4))
  check('§6.2.1 移动炮无视等级胜车', pieceAt(res2.pieces, 4, 4)?.kind === 'cannon')

  const r1 = p('red', 'chariot', 0, 0)
  const b1 = p('black', 'chariot', 8, 0)
  const res3 = run([r1, b1, p('red', 'general', 1, 9), p('black', 'general', 7, 9)], mv(r1, 4, 0), mv(b1, 4, 0))
  check('§6.2.3 同级同归于尽，该格留空', !pieceAt(res3.pieces, 4, 0) && res3.pieces.length === 2)

  const ra = p('red', 'advisor', 4, 8)
  const bs = p('black', 'soldier', 6, 7)
  const res4 = run(
    [ra, bs, p('red', 'general', 4, 9), p('black', 'general', 4, 0)],
    mv(ra, 3, 7),
    mv(bs, 3, 7),
  )
  check('士(3) 胜 兵(1)', pieceAt(res4.pieces, 3, 7)?.side === 'red')
}

console.log('§6.4 路径交叉（擦肩）')
{
  const r = p('red', 'chariot', 4, 9)
  const b = p('black', 'chariot', 4, 0)
  const res = run([r, b], mv(r, 4, 0), mv(b, 4, 9))
  check('直线对穿交换 → 同归于尽', res.pieces.length === 0 && res.events.some((e) => e.kind === 'cross'))

  const r2 = p('red', 'chariot', 0, 0)
  const b2 = p('black', 'chariot', 0, 1)
  const res2 = run([r2, b2], mv(r2, 0, 6), mv(b2, 0, 7))
  check('同向等速行驶不触发擦肩（§6.4）', res2.pieces.length === 2 && !!pieceAt(res2.pieces, 0, 6) && !!pieceAt(res2.pieces, 0, 7))

  const r3 = p('red', 'chariot', 0, 0)
  const b3 = p('black', 'chariot', 0, 3)
  const res3 = run([r3, b3], mv(r3, 0, 6), mv(b3, 0, 0))
  check('迎头途中相遇 → 擦肩同归于尽', res3.pieces.length === 0 && res3.events.some((e) => e.kind === 'cross'))

  const r4 = p('red', 'horse', 3, 3)
  const b4 = p('black', 'horse', 5, 3)
  const res4 = run([r4, b4], mv(r4, 4, 5), mv(b4, 4, 5))
  check('双马同跳一格按 §6.2 裁决（同归于尽）', res4.pieces.length === 0 && !pieceAt(res4.pieces, 4, 5))
}

console.log('§6.5 一方动、一方静')
{
  const r = p('red', 'soldier', 4, 5)
  const b = p('black', 'chariot', 4, 4)
  const res = run([r, b], mv(r, 4, 4), null)
  check('兵吃静止的车（不比等级）', pieceAt(res.pieces, 4, 4)?.kind === 'soldier')

  const r2 = p('red', 'soldier', 4, 5)
  const b2 = p('black', 'cannon', 4, 4)
  const res2 = run([r2, b2], mv(r2, 4, 4), null)
  check('兵冲静止炮 → 兵阵亡，炮原地不动', !pieceAt(res2.pieces, 4, 4) || pieceAt(res2.pieces, 4, 4)?.side === 'black')

  const r3 = p('red', 'chariot', 4, 7)
  const b3 = p('black', 'cannon', 4, 4)
  const res3 = run([r3, b3], mv(r3, 4, 4), null)
  check('车吃静止炮 → 车(6) 胜 炮(4)', pieceAt(res3.pieces, 4, 4)?.kind === 'chariot')

  const r4 = p('red', 'cannon', 0, 7)
  const b4 = p('black', 'cannon', 0, 4)
  const scr4 = p('red', 'soldier', 0, 5)
  const res4 = run([r4, b4, scr4], mv(r4, 0, 4), null)
  check('移动炮吃静止炮按 §6.2.1 必胜', pieceAt(res4.pieces, 0, 4)?.side === 'red')

  // 对手离开起点 → 落入空格，不吃子
  const r5 = p('red', 'chariot', 0, 0)
  const b5 = p('black', 'soldier', 0, 3)
  const res5 = run([r5, b5], mv(r5, 0, 3), mv(b5, 1, 3))
  check('落点＝对方起点（非对穿）视为空格，不构成吃子', !!pieceAt(res5.pieces, 0, 3) && !!pieceAt(res5.pieces, 1, 3))
}

console.log('§6.3 / §8 吃将与胜负')
{
  const r = p('red', 'chariot', 4, 5)
  const b = p('black', 'general', 4, 0)
  const rg = p('red', 'general', 0, 9)
  const res = run([r, b, rg], mv(r, 4, 0), null)
  check('吃将立即获胜', res.winner === 'red' && res.pieces.length === 2)

  const r2 = p('red', 'general', 4, 9)
  const b2 = p('black', 'soldier', 4, 8)
  const bg2 = p('black', 'general', 0, 0)
  const res2 = run([r2, b2, bg2], null, mv(b2, 4, 9))
  check('黑卒吃红帅 → 黑胜', res2.winner === 'black')

  const onlyGeneral = [p('black', 'general', 4, 0), p('red', 'chariot', 0, 9), p('red', 'general', 8, 9)]
  const res3 = run(onlyGeneral, mv(onlyGeneral[1], 0, 0), null)
  check('对方只剩不可动的将 → 围困胜', res3.winner === 'red' && res3.reason.includes('围困'))
}

console.log('§7.3 底兵升格')
{
  const r = p('red', 'soldier', 4, 1)
  const b = p('black', 'general', 0, 0)
  const res = run([r, b], mv(r, 4, 0), null)
  const promoted = res.pieces.find((q) => q.kind === 'soldier') as Piece
  check('抵达对方底线后标记升格', promoted.promoted === true)
  const moves = legalMoves(promoted, res.pieces, { facingRule: false })
  check('升格兵可后退一格', moves.some((t) => t.x === 4 && t.y === 1))
  const off = run([r, b], mv(r, 4, 0), null, { facingRule: false, promoteSoldier: false })
  check('关闭开关后不升格', !(off.pieces.find((q) => q.kind === 'soldier') as Piece).promoted)
}

console.log('§7.1 白脸将')
{
  const board = [p('red', 'general', 4, 9), p('black', 'general', 4, 0), p('red', 'soldier', 4, 4)]
  const blocker = board[2]
  const moves = legalMoves(blocker, board, { facingRule: true })
  check('照面线上的挡子不能横走离开', !moves.some((t) => t.y === 4 && t.x !== 4))
  check('前进仍可（保持遮挡）', moves.some((t) => t.x === 4 && t.y === 3))
  const noFilter = legalMoves(blocker, board, { facingRule: false })
  check('关闭规则后允许离开', noFilter.some((t) => t.x !== 4 && t.y === 4))

  const bothClear = [
    p('red', 'general', 4, 9),
    p('black', 'general', 4, 0),
    p('red', 'soldier', 4, 4),
    p('black', 'soldier', 4, 5),
  ]
  check('前置快照尚未照面', !generalsFacing(bothClear))
  const res = run(bothClear, mv(bothClear[2], 3, 4), mv(bothClear[3], 3, 5), withFacing)
  check('双方同时清开照面线 → 双方违规判和', res.winner === 'draw' && res.reason.includes('白脸将'))
}

console.log('§6.6 / 超时')
{
  const r = p('red', 'chariot', 0, 0)
  const b = p('black', 'chariot', 8, 8)
  const res = run([r, b], null, null)
  check('双方按兵不动，盘面不变', res.pieces.length === 2 && res.summary.includes('按兵不动'))
  const res2 = run([r, b], null, mv(b, 8, 0))
  check('单方行动照常执行', !!pieceAt(res2.pieces, 8, 0))
}

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 条失败`)
if (failed > 0) process.exitCode = 1
