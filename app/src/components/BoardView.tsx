import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Piece, PlannedMove, Pos, Side, Submission } from '../game/types'
import { COLS, PIECE_NAME, ROWS, posKey } from '../game/rules'

const CELL = 100
const PAD = 62
const W = (COLS - 1) * CELL + PAD * 2
const H = (ROWS - 1) * CELL + PAD * 2
const R = 44

interface BoardViewProps {
  pieces: Piece[]
  rotated: boolean
  activeSide: Side | null
  selectedId: string | null
  targets: Pos[]
  pending: PlannedMove | null
  reveal: { red: Submission; black: Submission } | null
  showArrows: boolean
  flash: Pos[]
  lastMove?: { red: Submission; black: Submission } | null
  onPick(id: string): void
  onTarget(pos: Pos): void
}

interface Ghost {
  piece: Piece
  x: number
  y: number
}

function GridLines({ rotated }: { rotated: boolean }) {
  const px = (x: number) => PAD + x * CELL
  const py = (y: number) => PAD + y * CELL
  const lines: ReactNode[] = []
  for (let y = 0; y < ROWS; y++) {
    lines.push(
      <line key={`h${y}`} x1={px(0)} y1={py(y)} x2={px(COLS - 1)} y2={py(y)} />,
    )
  }
  for (let x = 0; x < COLS; x++) {
    if (x === 0 || x === COLS - 1) {
      lines.push(<line key={`v${x}`} x1={px(x)} y1={py(0)} x2={px(x)} y2={py(ROWS - 1)} />)
      continue
    }
    lines.push(<line key={`v${x}a`} x1={px(x)} y1={py(0)} x2={px(x)} y2={py(4)} />)
    lines.push(<line key={`v${x}b`} x1={px(x)} y1={py(5)} x2={px(x)} y2={py(ROWS - 1)} />)
  }
  const marks: Array<[number, number]> = [
    [1, 2],
    [7, 2],
    [1, 7],
    [7, 7],
    [0, 3],
    [2, 3],
    [4, 3],
    [6, 3],
    [8, 3],
    [0, 6],
    [2, 6],
    [4, 6],
    [6, 6],
    [8, 6],
  ]
  const brackets: ReactNode[] = []
  const k = 7
  const len = 16
  marks.forEach(([mx, my]) => {
    for (const sx of [1, -1]) {
      for (const sy of [1, -1]) {
        if (mx + sx < 0 || mx + sx >= COLS || my + sy < 0 || my + sy >= ROWS) continue
        const ax = px(mx) + sx * k
        const ay = py(my) + sy * k
        brackets.push(
          <path
            key={`m${mx}-${my}-${sx}-${sy}`}
            d={`M ${ax} ${ay + sy * len} L ${ax} ${ay} L ${ax + sx * len} ${ay}`}
          />,
        )
      }
    }
  })
  const palace = (top: number) => {
    const y0 = py(top)
    const y1 = py(top + 2)
    return [
      <line key={`pa${top}`} x1={px(3)} y1={y0} x2={px(5)} y2={y1} />,
      <line key={`pb${top}`} x1={px(5)} y1={y0} x2={px(3)} y2={y1} />,
    ]
  }
  const left = rotated ? '漢 界' : '楚 河'
  const right = rotated ? '楚 河' : '漢 界'
  return (
    <g className="board-lines">
      {lines}
      {brackets}
      {palace(0)}
      {palace(ROWS - 3)}
      <text x={px(1.6)} y={py(4.5)} className="river-text">
        {left}
      </text>
      <text x={px(6.4)} y={py(4.5)} className="river-text">
        {right}
      </text>
    </g>
  )
}

function BoardViewBase({
  pieces,
  rotated,
  activeSide,
  selectedId,
  targets,
  pending,
  reveal,
  showArrows,
  flash,
  lastMove,
  onPick,
  onTarget,
}: BoardViewProps) {
  const sx = (x: number) => (rotated ? COLS - 1 - x : x)
  const sy = (y: number) => (rotated ? ROWS - 1 - y : y)
  const px = (x: number) => PAD + x * CELL
  const py = (y: number) => PAD + y * CELL
  const at = (pos: Pos) => ({ x: px(sx(pos.x)), y: py(sy(pos.y)) })

  const [ghosts, setGhosts] = useState<Ghost[]>([])
  const prevRef = useRef<Piece[]>(pieces)

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = pieces
    const alive = new Set(pieces.map((p) => p.id))
    const dying = prev.filter((p) => !alive.has(p.id))
    if (dying.length === 0) {
      setGhosts([])
      return
    }
    setGhosts(dying.map((piece) => ({ piece, x: piece.x, y: piece.y })))
    const id = window.setTimeout(() => setGhosts([]), 620)
    return () => window.clearTimeout(id)
  }, [pieces])

  const flashKeys = useMemo(() => new Set(flash.map(posKey)), [flash])

  const renderPiece = (piece: Piece, key: string, extra?: string) => {
    const p = at(piece)
    const selectable = activeSide === piece.side
    const glyph = PIECE_NAME[piece.side][piece.kind]
    return (
      <g
        key={key}
        style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
        className={`piece piece-${piece.side} ${extra ?? ''} ${selectable ? 'is-selectable' : ''} ${
          selectedId === piece.id ? 'is-selected' : ''
        }`}
        onPointerDown={(e) => {
          e.stopPropagation()
          if (selectable) onPick(piece.id)
        }}
      >
        <circle className="piece-shadow" r={R} cx={2} cy={4} />
        <circle className="piece-face" r={R} />
        <circle className="piece-ring" r={R - 8} />
        {piece.promoted && <circle className="piece-star" r={R - 3} />}
        <text className="piece-glyph" y={2} textAnchor="middle" dominantBaseline="central">
          {glyph}
        </text>
      </g>
    )
  }

  const arrows = showArrows && reveal ? [reveal.red, reveal.black] : []
  const trail = lastMove && !showArrows ? [lastMove.red, lastMove.black] : []

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="board-svg" role="img" aria-label="同步象棋棋盘">
      <defs>
        <radialGradient id="board-bg" cx="50%" cy="42%" r="78%">
          <stop offset="0%" stopColor="var(--board-hi)" />
          <stop offset="100%" stopColor="var(--board-lo)" />
        </radialGradient>
        <marker id="arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--arrow-red)" />
        </marker>
        <marker id="arrow-black" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--arrow-black)" />
        </marker>
        <marker id="arrow-target" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--target)" />
        </marker>
      </defs>

      <rect x={0} y={0} width={W} height={H} rx={26} className="board-frame" />
      <rect x={16} y={16} width={W - 32} height={H - 32} rx={18} fill="url(#board-bg)" />
      <GridLines rotated={rotated} />

      {trail.filter(Boolean).map((m, i) => {
        const move = m as PlannedMove
        const from = at(move.from)
        const to = at(move.to)
        return (
          <g key={`trail${i}`} className="trail">
            <circle cx={from.x} cy={from.y} r={10} />
            <circle cx={to.x} cy={to.y} r={10} />
          </g>
        )
      })}

      {flashKeys.size > 0 &&
        [...flashKeys].map((key) => {
          const [fx, fy] = key.split(',').map(Number)
          const p = at({ x: fx, y: fy })
          return (
            <g key={`flash${key}`} className="flash">
              <rect x={p.x - 50} y={p.y - 50} width={100} height={100} rx={12} />
              <circle cx={p.x} cy={p.y} r={56} />
            </g>
          )
        })}

      {targets.map((t) => {
        const p = at(t)
        const occupied = pieces.some((q) => q.x === t.x && q.y === t.y)
        return (
          <g
            key={`t${posKey(t)}`}
            className={`target ${occupied ? 'target-hit' : ''}`}
            onPointerDown={(e) => {
              e.stopPropagation()
              onTarget(t)
            }}
          >
            <circle cx={p.x} cy={p.y} r={54} className="hit-area" />
            {occupied ? (
              <circle cx={p.x} cy={p.y} r={50} className="hit-ring" />
            ) : (
              <circle cx={p.x} cy={p.y} r={14} className="hit-dot" />
            )}
          </g>
        )
      })}

      {pending && !showArrows && (
        <g className="pending-arrow">
          <line
            x1={at(pending.from).x}
            y1={at(pending.from).y}
            x2={at(pending.to).x}
            y2={at(pending.to).y}
            markerEnd="url(#arrow-target)"
          />
          <circle cx={at(pending.to).x} cy={at(pending.to).y} r={R - 2} className="pending-ring" />
        </g>
      )}

      {arrows.filter(Boolean).map((m, i) => {
        const move = m as PlannedMove
        const from = at(move.from)
        const to = at(move.to)
        const side = move.side
        return (
          <g key={`a${i}`} className={`arrow arrow-${side}`}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              markerEnd={side === 'red' ? 'url(#arrow-red)' : 'url(#arrow-black)'}
            />
            <circle cx={from.x} cy={from.y} r={R + 6} className="arrow-origin" />
            <text x={to.x} y={to.y - R - 16} textAnchor="middle" className="arrow-label">
              {PIECE_NAME[side][move.kind]}
              {side === 'red' ? '·红方' : '·黑方'}
            </text>
          </g>
        )
      })}

      {ghosts.map((g) => renderPiece({ ...g.piece, x: g.x, y: g.y }, `ghost-${g.piece.id}`, 'is-dying'))}
      {pieces.map((piece) => renderPiece(piece, piece.id))}
    </svg>
  )
}

export const BoardView = memo(BoardViewBase)
