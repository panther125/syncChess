import type { ReactNode } from 'react'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { ScrollArea } from './ui/scroll-area'
import type { LogEntry, Piece, PieceKind, PlannedMove, ResolvedRound, Side } from '../game/types'
import { BASE_GRADE, PIECE_NAME } from '../game/rules'
import { sideName } from '../game/resolve'

export function CountdownRing({ ms, total }: { ms: number; total: number }) {
  const ratio = total > 0 ? Math.max(0, Math.min(1, ms / total)) : 0
  const r = 30
  const c = 2 * Math.PI * r
  const urgent = ms <= 3000
  return (
    <div className={`ring ${urgent ? 'ring-urgent' : ''}`}>
      <svg viewBox="0 0 72 72" className="ring-svg" aria-hidden>
        <circle cx="36" cy="36" r={r} className="ring-track" />
        <circle
          cx="36"
          cy="36"
          r={r}
          className="ring-value"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
        />
      </svg>
      <span className="ring-text">{(Math.ceil(ms / 100) / 10).toFixed(1)}</span>
    </div>
  )
}

function MiniPieces({ pieces }: { pieces: Piece[] }) {
  if (pieces.length === 0) return <span className="empty-note">已全数阵亡</span>
  return (
    <span className="mini-row">
      {pieces.map((p) => (
        <span key={p.id} className={`mini mini-${p.side} ${p.promoted ? 'mini-star' : ''}`}>
          {PIECE_NAME[p.side][p.kind]}
        </span>
      ))}
    </span>
  )
}

export function SideStrip({
  side,
  pieces,
  alive,
  status,
  turn,
}: {
  side: Side
  pieces: Piece[]
  alive: Piece[]
  status: ReactNode
  turn: boolean
}) {
  return (
    <div className={`strip strip-${side} ${turn ? 'strip-turn' : ''}`}>
      <div className="strip-head">
        <span className={`dot dot-${side}`} />
        <span className="strip-name">{sideName(side)}</span>
        <span className="strip-count">存活 {alive.length} / {pieces.length}</span>
      </div>
      <div className="strip-body">
        <MiniPieces pieces={alive} />
      </div>
      <div className="strip-status">{status}</div>
    </div>
  )
}

export function GradeLegend() {
  const sample: Array<{ side: Side; kind: PieceKind }> = [
    { side: 'red', kind: 'chariot' },
    { side: 'red', kind: 'horse' },
    { side: 'red', kind: 'cannon' },
    { side: 'black', kind: 'advisor' },
    { side: 'black', kind: 'elephant' },
    { side: 'black', kind: 'soldier' },
  ]
  return (
    <div className="legend">
      <div className="legend-title">冲突裁决等级（§3.1）</div>
      <div className="legend-row">
        <span className="legend-chain">将 7 &gt; 车 6 &gt; 马 5 &gt; 炮 4 &gt; 士 3 &gt; 象 2 &gt; 兵 1</span>
      </div>
      <ul className="legend-list">
        <li>同格争夺：移动中的<b>炮必胜</b>（§6.2.1）</li>
        <li>否则等级高者吃掉低者并占格（§6.2.2）</li>
        <li>等级相同 → <b>同归于尽</b>，该格留空（§6.2.3）</li>
        <li>路径交叉 / 对穿交换 → 同归于尽（§6.4）</li>
      </ul>
      <div className="legend-note">
        冲撞静止的炮同样按等级裁决：士 / 象 / 兵 去吃静止炮，反被炮吃（§6.5）。
      </div>
      <div className="mini-row legend-sample">
        {sample.map((s) => (
          <span key={`${s.side}${s.kind}`} className={`mini mini-${s.side}`}>
            {PIECE_NAME[s.side][s.kind]}
            <i>{BASE_GRADE[s.kind]}</i>
          </span>
        ))}
      </div>
    </div>
  )
}

export function VerdictPanel({
  resolved,
  phase,
  reason,
  winner,
}: {
  resolved: ResolvedRound | null
  phase: string
  reason: string
  winner: Side | 'draw' | null
}) {
  if (!resolved || (phase !== 'resolve' && phase !== 'over')) return null
  return (
    <Card className="panel verdict">
      <CardHeader>
        <CardTitle>本回合裁决</CardTitle>
        <div className="verdict-plays">
          <span className="play play-red">{resolved.labels.red}</span>
          <span className="play-vs">同步</span>
          <span className="play play-black">{resolved.labels.black}</span>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="verdict-list">
          {resolved.events.map((e, i) => (
            <li key={i} className={`vline vline-${e.kind}`}>
              {e.rule && <Badge variant="outline" className="vtag">§{e.rule}</Badge>}
              <span>{e.text}</span>
            </li>
          ))}
        </ul>
        {winner && <p className="verdict-final">{reason || resolved.reason}</p>}
      </CardContent>
    </Card>
  )
}

export function LogPanel({ log }: { log: LogEntry[] }) {
  return (
    <Card className="panel">
      <CardHeader>
        <CardTitle>同步日志</CardTitle>
      </CardHeader>
      <CardContent className="log-body">
        {log.length === 0 ? (
          <p className="empty-note">尚无回合结算记录。</p>
        ) : (
          <ScrollArea className="log-scroll">
            <ol className="log-list">
              {log.map((entry) => (
                <li key={entry.round} className="log-item">
                  <div className="log-head">
                    <span className="log-round">第 {entry.round} 回合</span>
                    {entry.winner && <Badge variant="secondary">{entry.winner === 'draw' ? '和棋' : `${sideName(entry.winner)}胜`}</Badge>}
                  </div>
                  <div className="log-plays">
                    <span className="play play-red">{entry.labels.red}</span>
                    <span className="play play-black">{entry.labels.black}</span>
                  </div>
                  <ul className="log-events">
                    {entry.events.map((e, i) => (
                      <li key={i}>{e.text}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

export function statusFor(
  side: Side,
  phase: string,
  acting: Side,
  mode: string,
  playerSide: Side,
  hasPlan: boolean,
): ReactNode {
  if (phase === 'over') return <span className="status-text">对局结束</span>
  if (phase === 'reveal') return <span className="status-text">着法已揭示</span>
  if (phase === 'resolve') return <span className="status-text">结算中</span>
  if (phase === 'handover') {
    return side === 'red' ? (
      <span className="status-ok">红方已提交（秘密）</span>
    ) : (
      <span className="status-wait">等待接手设备</span>
    )
  }
  // decide
  if (mode === 'ai') {
    if (side === playerSide) return <span className="status-wait">秘密决策中…</span>
    return <span className="status-wait">电脑同步决策中…</span>
  }
  if (side === acting) return <span className="status-ok">轮到你秘密决策</span>
  return hasPlan ? <span className="status-text">对方已提交（秘密）</span> : <span className="status-wait">等待对方</span>
}

export function PhaseBar({
  phase,
  acting,
  remainingMs,
  durationMs,
  canAct,
  pending,
  selectedName,
  hint,
  onSubmit,
  onPass,
  onCancel,
  mode,
}: {
  phase: string
  acting: Side
  remainingMs: number
  durationMs: number
  canAct: boolean
  pending: PlannedMove | null
  selectedName: string
  hint: ReactNode
  onSubmit(): void
  onPass(): void
  onCancel(): void
  mode: string
}) {
  const title =
    phase === 'decide'
      ? `${sideName(acting)}秘密决策${mode === 'hotseat' ? '（对方不可见）' : ''}`
      : phase === 'handover'
        ? '交接设备'
        : phase === 'reveal'
          ? '同时揭示'
          : phase === 'resolve'
            ? '并行结算'
            : '回合结束'
  return (
    <div className="phase-bar">
      <div className="phase-left">
        <CountdownRing ms={phase === 'decide' ? remainingMs : 0} total={durationMs} />
        <div className="phase-meta">
          <div className="phase-title">{title}</div>
          <div className="phase-hint">{hint}</div>
        </div>
      </div>
      <div className="phase-actions">
        {phase === 'decide' && canAct && (
          <>
            {pending && <span className="pending-tag">{selectedName}</span>}
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={!pending && !selectedName}>
              取消
            </Button>
            <Button variant="ghost" size="sm" onClick={onPass}>
              按兵不动
            </Button>
            <Button size="sm" onClick={onSubmit} disabled={!pending}>
              提交着法
            </Button>
          </>
        )}
        {phase === 'decide' && !canAct && <span className="status-wait">等待对手…</span>}
        {phase === 'reveal' && <span className="status-text">着法已锁定，等待结算</span>}
      </div>
    </div>
  )
}
