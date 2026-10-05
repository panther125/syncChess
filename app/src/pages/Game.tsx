import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { BoardView } from '../components/BoardView'
import {
  GradeLegend,
  LogPanel,
  PhaseBar,
  SideStrip,
  VerdictPanel,
  statusFor,
} from '../components/GamePanels'
import { HandoverOverlay, ResultOverlay } from '../components/Overlays'
import { SettingsDialog } from '../components/SettingsDialog'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import type { GameSettings, PlannedMove, Pos, Side } from '../game/types'
import {
  PIECE_NAME,
  createInitialPieces,
  describeSubmission,
  legalMoves,
  samePos,
} from '../game/rules'
import { sideName } from '../game/resolve'
import { makeMove } from '../game/ai'
import { defaultSettings, useGame } from '../game/useGame'

export default function Game() {
  const [params] = useSearchParams()
  const bootSettings = useMemo<GameSettings>(
    () => ({
      ...defaultSettings,
      mode: params.get('mode') === 'hotseat' ? 'hotseat' : 'ai',
      playerSide: params.get('side') === 'black' ? 'black' : 'red',
      aiLevel: params.get('level') === 'easy' ? 'easy' : 'normal',
      decideSeconds: Number(params.get('secs') ?? defaultSettings.decideSeconds) || defaultSettings.decideSeconds,
      rotated: params.get('side') === 'black',
    }),
    [params],
  )

  const game = useGame(bootSettings)
  const navigate = useNavigate()
  const { state } = game
  const settings = state.settings
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pending, setPending] = useState<PlannedMove | null>(null)
  const [notice, setNotice] = useState('')

  const canAct =
    state.phase === 'decide' &&
    (settings.mode === 'ai' ? state.acting === settings.playerSide : true)

  const selected = useMemo(
    () => state.pieces.find((p) => p.id === selectedId) ?? null,
    [state.pieces, selectedId],
  )

  const targets = useMemo<Pos[]>(() => {
    if (!canAct || !selected) return []
    return legalMoves(selected, state.pieces, { facingRule: settings.facingRule })
  }, [canAct, selected, state.pieces, settings.facingRule])

  useEffect(() => {
    setSelectedId(null)
    setPending(null)
  }, [state.phase, state.round])

  useEffect(() => {
    if (!notice) return
    const id = window.setTimeout(() => setNotice(''), 2600)
    return () => window.clearTimeout(id)
  }, [notice])

  const pick = useCallback(
    (id: string) => {
      const piece = state.pieces.find((p) => p.id === id)
      if (!piece) return
      if (!canAct) {
        setNotice('现在不是你的决策阶段')
        return
      }
      if (piece.kind === 'general') {
        setNotice('帅 / 将不可移动（§7.1）')
        return
      }
      if (piece.side !== state.acting) {
        setNotice(`本轮轮到${sideName(state.acting)}秘密决策`)
        return
      }
      setSelectedId(id)
      setPending(null)
    },
    [canAct, state.pieces, state.acting],
  )

  const target = useCallback(
    (pos: Pos) => {
      if (!selected) return
      if (!targets.some((t) => samePos(t, pos))) return
      setPending(makeMove(selected, pos))
    },
    [selected, targets],
  )

  const submitPending = useCallback(() => {
    if (!pending) return
    game.submit(pending)
  }, [game, pending])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!canAct) return
      if (e.key === 'Enter') {
        e.preventDefault()
        submitPending()
      } else if (e.key === 'Escape') {
        setSelectedId(null)
        setPending(null)
      } else if (e.key.toLowerCase() === 'p') {
        game.submit(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canAct, submitPending, game])

  const initial = useMemo(() => createInitialPieces(), [])
  const alive = useMemo(
    () => ({
      red: state.pieces.filter((p) => p.side === 'red'),
      black: state.pieces.filter((p) => p.side === 'black'),
    }),
    [state.pieces],
  )

  const rotated =
    settings.mode === 'hotseat'
      ? state.phase === 'handover' || state.acting === 'black'
      : settings.rotated

  const flash = useMemo<Pos[]>(() => {
    if (state.phase === 'reveal') {
      if (state.redPlan && state.blackPlan && samePos(state.redPlan.to, state.blackPlan.to)) {
        return [state.redPlan.to]
      }
      return []
    }
    if (state.phase === 'resolve' || state.phase === 'over') {
      const last = state.last
      if (!last) return []
      const decisive = last.events.some((e) => e.kind !== 'move' && e.kind !== 'pass')
      if (!decisive) return []
      const points: Pos[] = []
      if (last.red) points.push(last.red.to)
      if (last.black) points.push(last.black.to)
      return points
    }
    return []
  }, [state])

  const hint = notice
    ? notice
    : canAct
      ? selected
        ? `已选 ${PIECE_NAME[selected.side][selected.kind]} · 点击亮点选落点，Enter 提交，P 键按兵不动`
        : '点击己方棋子开始秘密决策（将 / 帅不可选）'
      : state.phase === 'reveal'
        ? '双方着法同时亮出，正在按 §6 并行结算'
        : state.phase === 'resolve'
          ? '结算完成，即将进入下一同步回合'
          : state.phase === 'handover'
            ? '请把设备交给对方'
            : '本局已结束'

  const selectedName = pending && selected ? describeSubmission(state.pieces, pending, pending.side) : ''

  const stripStatus = (side: Side) =>
    statusFor(
      side,
      state.phase,
      state.acting,
      settings.mode,
      settings.playerSide,
      side === 'red' ? state.redPlan !== null : state.blackPlan !== null,
    )

  return (
    <div className="game-page">
      <header className="game-header">
        <div className="brand">
          <Link to="/" className="brand-title">
            同步象棋
          </Link>
          <span className="brand-sub">Sync Chess · 同时提交，并行结算</span>
        </div>
        <div className="header-badges">
          <Badge variant="outline">第 {state.round} 回合</Badge>
          <Badge variant="outline">
            {settings.mode === 'ai'
              ? `人机 · 你执${sideName(settings.playerSide)} · ${settings.aiLevel === 'easy' ? '简单' : '普通'}`
              : '双人同屏'}
          </Badge>
          <Badge variant="outline">{settings.decideSeconds}s 决策</Badge>
          <Badge variant="outline">距和棋 {Math.max(0, 60 - state.sinceCapture)} 回合未吃子</Badge>
        </div>
        <div className="header-actions">
          <SettingsDialog
            settings={settings}
            onChange={(next) => game.updateSettings(next)}
            trigger={
              <Button variant="ghost" size="sm">
                设置
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={game.undo}
            disabled={state.history.length === 0 || state.phase !== 'decide'}
          >
            悔棋
          </Button>
          <Button variant="ghost" size="sm" onClick={game.restart}>
            重开
          </Button>
          <Link to="/rules" className="plain-link">
            规则
          </Link>
        </div>
      </header>

      <main className="game-main">
        <section className="board-col">
          <SideStrip
            side="black"
            pieces={initial.filter((p) => p.side === 'black')}
            alive={alive.black}
            status={stripStatus('black')}
            turn={state.phase === 'decide' && state.acting === 'black'}
          />

          <div className="board-wrap">
            <BoardView
              pieces={state.pieces}
              rotated={rotated}
              activeSide={canAct ? state.acting : null}
              selectedId={selectedId}
              targets={targets}
              pending={pending}
              reveal={
                state.phase === 'reveal' || state.phase === 'resolve' || state.phase === 'over'
                  ? {
                      red: state.phase === 'reveal' ? state.redPlan : (state.last?.red ?? null),
                      black: state.phase === 'reveal' ? state.blackPlan : (state.last?.black ?? null),
                    }
                  : null
              }
              showArrows={state.phase === 'reveal'}
              flash={flash}
              lastMove={
                state.phase === 'resolve' || state.phase === 'over'
                  ? { red: state.last?.red ?? null, black: state.last?.black ?? null }
                  : null
              }
              onPick={pick}
              onTarget={target}
            />
            {state.phase === 'handover' && (
              <HandoverOverlay
                nextSide="black"
                rotated={rotated}
                onReady={game.handoverReady}
              />
            )}
          </div>

          <SideStrip
            side="red"
            pieces={initial.filter((p) => p.side === 'red')}
            alive={alive.red}
            status={stripStatus('red')}
            turn={state.phase === 'decide' && state.acting === 'red'}
          />

          <PhaseBar
            phase={state.phase}
            acting={state.acting}
            remainingMs={game.remainingMs}
            durationMs={state.durationMs}
            canAct={canAct}
            pending={pending}
            selectedName={selectedName}
            hint={hint}
            onSubmit={submitPending}
            onPass={() => game.submit(null)}
            onCancel={() => {
              setSelectedId(null)
              setPending(null)
            }}
            mode={settings.mode}
          />
        </section>

        <aside className="side-col">
          {state.phase === 'reveal' && (
            <Card className="panel">
              <CardHeader>
                <CardTitle>同时揭示</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="verdict-plays">
                  <span className="play play-red">
                    {describeSubmission(state.pieces, state.redPlan, 'red')}
                  </span>
                  <span className="play-vs">同步</span>
                  <span className="play play-black">
                    {describeSubmission(state.pieces, state.blackPlan, 'black')}
                  </span>
                </div>
                <p className="empty-note">两枚着法基于回合开始的同一快照并行结算（§6.6）。</p>
              </CardContent>
            </Card>
          )}
          <VerdictPanel
            resolved={state.last}
            phase={state.phase}
            reason={state.reason}
            winner={state.winner}
          />
          <GradeLegend />
          <LogPanel log={state.log} />
        </aside>
      </main>

      {state.phase === 'over' && (
        <ResultOverlay
          winner={state.winner}
          reason={state.reason}
          rounds={state.round}
          playerSide={settings.mode === 'ai' ? settings.playerSide : 'red'}
          alive={alive}
          onRestart={game.restart}
          onUndo={game.undo}
          onExit={() => navigate('/')}
        />
      )}
    </div>
  )
}
