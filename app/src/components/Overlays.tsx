import { Button } from './ui/button'
import type { Piece, Side } from '../game/types'
import { sideName } from '../game/resolve'

export function HandoverOverlay({
  nextSide,
  rotated,
  onReady,
}: {
  nextSide: Side
  rotated: boolean
  onReady(): void
}) {
  return (
    <div className="overlay-shell">
      <div className="overlay-card">
        <p className="overlay-kicker">同步决策 · 交接</p>
        <h2 className="overlay-title">
          红方着法已密封
          <span className="overlay-arrow">↓</span>
          现在交给 <em className={`overlay-side overlay-${nextSide}`}>{sideName(nextSide)}</em>
        </h2>
        <p className="overlay-desc">
          请对方接手设备后点击下面的按钮开始 {rotated ? '（棋盘会自动转到你的视角）' : '秘密决策'}。
          <br />
          倒计时从点击后开始，超时视为按兵不动。
        </p>
        <Button size="lg" className="overlay-cta" onClick={onReady}>
          我是{sideName(nextSide)}，开始决策
        </Button>
      </div>
    </div>
  )
}

export function ResultOverlay({
  winner,
  reason,
  rounds,
  playerSide,
  alive,
  onRestart,
  onUndo,
  onExit,
}: {
  winner: Side | 'draw' | null
  reason: string
  rounds: number
  playerSide: Side
  alive: { red: Piece[]; black: Piece[] }
  onRestart(): void
  onUndo(): void
  onExit(): void
}) {
  const text = winner === 'red' || winner === 'black' ? `${sideName(winner)}胜` : '和棋'
  const tone = winner === 'draw' ? 'draw' : winner === playerSide ? 'good' : 'bad'
  return (
    <div className="overlay-shell overlay-solid">
      <div className={`overlay-card result-card result-${tone}`}>
        <p className="overlay-kicker">终局 · 第 {rounds} 回合</p>
        <h2 className="result-title">{text}</h2>
        <p className="overlay-desc">{reason}</p>
        <div className="result-alive">
          <div>
            <span className="strip-name">红方存活</span> <b>{alive.red.length}</b> 子
          </div>
          <div>
            <span className="strip-name">黑方存活</span> <b>{alive.black.length}</b> 子
          </div>
        </div>
        <div className="result-actions">
          <Button size="lg" onClick={onRestart}>
            再来一局
          </Button>
          <Button size="lg" variant="ghost" onClick={onUndo}>
            回到本回合重想
          </Button>
          <Button size="lg" variant="outline" onClick={onExit}>
            返回主菜单
          </Button>
        </div>
      </div>
    </div>
  )
}
