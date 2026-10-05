import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { GameSettings, LogEntry, Phase, Piece, ResolvedRound, Side, Submission } from './types'
import { createInitialPieces, other } from './rules'
import { chooseMove } from './ai'
import { resolveRound } from './resolve'
import { playSound } from './sound'

/** 揭示阶段时长（动画 + 阅读双方着法） */
export const REVEAL_MS = 1600
/** 结算阶段时长（棋子走位 + 裁决说明） */
export const RESOLVE_MS = 1700
/** §8 连续 60 回合未吃子判和 */
const DRAW_AFTER = 60
/** §9 双方连续按兵不动后的快棋时长 */
const FAST_MS = 5000

export const defaultSettings: GameSettings = {
  mode: 'ai',
  playerSide: 'red',
  aiLevel: 'normal',
  decideSeconds: 30,
  promoteSoldier: true,
  facingRule: true,
  rotated: false,
  sound: true,
}

interface Snapshot {
  pieces: Piece[]
  round: number
  sinceCapture: number
  bothPass: number
  durationMs: number
}

interface State {
  settings: GameSettings
  pieces: Piece[]
  round: number
  phase: Phase
  acting: Side
  redPlan: Submission
  blackPlan: Submission
  durationMs: number
  last: ResolvedRound | null
  log: LogEntry[]
  sinceCapture: number
  bothPass: number
  winner: Side | 'draw' | null
  reason: string
  history: Snapshot[]
}

type Action =
  | { type: 'settings'; settings: GameSettings }
  | { type: 'restart'; settings?: GameSettings }
  | { type: 'submit'; side: Side; move: Submission; aiMove?: Submission; timeout?: boolean }
  | { type: 'handoverReady' }
  | { type: 'resolve' }
  | { type: 'next' }
  | { type: 'undo' }

function firstSide(settings: GameSettings): Side {
  return settings.mode === 'ai' ? settings.playerSide : 'red'
}

function decideMs(settings: GameSettings, bothPass: number): number {
  if (bothPass >= 3) return FAST_MS
  return Math.max(2, settings.decideSeconds) * 1000
}

function initialState(settings: GameSettings): State {
  return {
    settings,
    pieces: createInitialPieces(),
    round: 1,
    phase: 'decide',
    acting: firstSide(settings),
    redPlan: null,
    blackPlan: null,
    durationMs: decideMs(settings, 0),
    last: null,
    log: [],
    sinceCapture: 0,
    bothPass: 0,
    winner: null,
    reason: '',
    history: [],
  }
}

function snapshotOf(state: State): Snapshot {
  return {
    pieces: state.pieces,
    round: state.round,
    sinceCapture: state.sinceCapture,
    bothPass: state.bothPass,
    durationMs: state.durationMs,
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'settings': {
      const next = action.settings
      const structural =
        next.mode !== state.settings.mode ||
        next.playerSide !== state.settings.playerSide ||
        next.aiLevel !== state.settings.aiLevel
      if (structural) return initialState(next)
      return {
        ...state,
        settings: next,
        durationMs:
          state.phase === 'decide' ? decideMs(next, state.bothPass) : state.durationMs,
      }
    }
    case 'restart':
      return initialState(action.settings ?? state.settings)
    case 'submit': {
      if (state.phase !== 'decide' || action.side !== state.acting) return state
      const base: State = {
        ...state,
        redPlan: action.side === 'red' ? action.move : state.redPlan,
        blackPlan: action.side === 'black' ? action.move : state.blackPlan,
      }
      if (state.settings.mode === 'ai') {
        return {
          ...base,
          redPlan: state.settings.playerSide === 'red' ? action.move : (action.aiMove ?? null),
          blackPlan: state.settings.playerSide === 'black' ? action.move : (action.aiMove ?? null),
          phase: 'reveal',
        }
      }
      if (state.acting === 'red') return { ...base, phase: 'handover' }
      return { ...base, phase: 'reveal' }
    }
    case 'handoverReady': {
      if (state.phase !== 'handover') return state
      return { ...state, phase: 'decide', acting: 'black' }
    }
    case 'resolve': {
      if (state.phase !== 'reveal') return state
      const history = [snapshotOf(state), ...state.history].slice(0, 30)
      const resolved = resolveRound(
        state.pieces,
        state.round,
        state.redPlan,
        state.blackPlan,
        {
          facingRule: state.settings.facingRule,
          promoteSoldier: state.settings.promoteSoldier,
        },
      )
      let winner = resolved.winner
      let reason = resolved.reason
      const sinceCapture = resolved.capture ? 0 : state.sinceCapture + 1
      if (!winner && sinceCapture >= DRAW_AFTER) {
        winner = 'draw'
        reason = `连续 ${DRAW_AFTER} 回合未吃子 → 和棋（§8）`
      }
      const bothPass = resolved.red === null && resolved.black === null ? state.bothPass + 1 : 0
      const entry: LogEntry = {
        round: state.round,
        red: resolved.red,
        black: resolved.black,
        labels: resolved.labels,
        summary: resolved.summary,
        events: resolved.events,
        winner,
      }
      return {
        ...state,
        history,
        pieces: resolved.pieces,
        last: resolved,
        log: [entry, ...state.log].slice(0, 60),
        sinceCapture,
        bothPass,
        winner,
        reason,
        phase: winner ? 'over' : 'resolve',
      }
    }
    case 'next': {
      if (state.phase !== 'resolve') return state
      return {
        ...state,
        phase: 'decide',
        round: state.round + 1,
        acting: firstSide(state.settings),
        redPlan: null,
        blackPlan: null,
        durationMs: decideMs(state.settings, state.bothPass),
        last: null,
      }
    }
    case 'undo': {
      if (state.history.length === 0) return state
      const [prev, ...rest] = state.history
      return {
        ...state,
        history: rest,
        pieces: prev.pieces,
        round: prev.round,
        sinceCapture: prev.sinceCapture,
        bothPass: prev.bothPass,
        durationMs: prev.durationMs,
        phase: 'decide',
        acting: firstSide(state.settings),
        redPlan: null,
        blackPlan: null,
        last: null,
        winner: null,
        reason: '',
        log: state.log.slice(1),
      }
    }
    default:
      return state
  }
}

export interface GameApi {
  state: State
  remainingMs: number
  /** 本回合是否已因超时而强制提交 */
  timedOut: boolean
  submit(move: Submission, timeout?: boolean): void
  pass(): void
  handoverReady(): void
  undo(): void
  restart(): void
  updateSettings(settings: GameSettings): void
}

export function useGame(initial: GameSettings = defaultSettings): GameApi {
  const [state, dispatch] = useReducer(reducer, initial, initialState)
  const [remainingMs, setRemainingMs] = useState(state.durationMs)
  const [timedOut, setTimedOut] = useState(false)
  const stateRef = useRef(state)
  stateRef.current = state
  const busyRef = useRef(false)

  const updateSettings = useCallback((settings: GameSettings) => {
    dispatch({ type: 'settings', settings })
  }, [])

  const submit = useCallback((move: Submission, timeout = false) => {
    const current = stateRef.current
    if (current.phase !== 'decide' || busyRef.current) return
    busyRef.current = true
    const aiMove =
      current.settings.mode === 'ai'
        ? chooseMove(current.pieces, other(current.settings.playerSide), {
            level: current.settings.aiLevel,
            facingRule: current.settings.facingRule,
            promoteSoldier: current.settings.promoteSoldier,
          })
        : undefined
    playSound(timeout ? 'warn' : 'submit', current.settings.sound)
    dispatch({ type: 'submit', side: current.acting, move, aiMove, timeout })
    setTimedOut(timeout)
    window.setTimeout(() => {
      busyRef.current = false
    }, 300)
  }, [])

  const pass = useCallback(() => submit(null), [submit])

  useEffect(() => {
    if (state.phase !== 'decide') return
    busyRef.current = false
    setTimedOut(false)
    const deadline = Date.now() + state.durationMs
    setRemainingMs(state.durationMs)
    let warned = false
    const id = window.setInterval(() => {
      const left = Math.max(0, deadline - Date.now())
      setRemainingMs(left)
      if (left <= 3000 && !warned) {
        warned = true
        playSound('warn', stateRef.current.settings.sound)
      } else if (left > 0 && left % 1000 < 120 && left <= 6000) {
        playSound('tick', stateRef.current.settings.sound)
      }
      if (left === 0) submit(null, true)
    }, 100)
    return () => window.clearInterval(id)
  }, [state.phase, state.round, state.acting, state.durationMs, submit])

  useEffect(() => {
    if (state.phase !== 'reveal') return
    playSound('reveal', state.settings.sound)
    const id = window.setTimeout(() => dispatch({ type: 'resolve' }), REVEAL_MS)
    return () => window.clearTimeout(id)
  }, [state.phase, state.round, state.settings.sound])

  useEffect(() => {
    if (state.phase !== 'resolve' || !state.last) return
    if (state.last.capture) playSound('capture', state.settings.sound)
    const id = window.setTimeout(() => dispatch({ type: 'next' }), RESOLVE_MS)
    return () => window.clearTimeout(id)
  }, [state.phase, state.round, state.last, state.settings.sound])

  useEffect(() => {
    if (state.phase !== 'over') return
    const sound = state.winner === 'draw' ? 'draw' : state.winner === state.settings.playerSide ? 'win' : 'lose'
    playSound(sound, state.settings.sound)
  }, [state.phase, state.winner, state.settings.playerSide, state.settings.sound])

  const handoverReady = useCallback(() => dispatch({ type: 'handoverReady' }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const restart = useCallback(() => dispatch({ type: 'restart' }), [])

  return useMemo(
    () => ({ state, remainingMs, timedOut, submit, pass, handoverReady, undo, restart, updateSettings }),
    [state, remainingMs, timedOut, submit, pass, handoverReady, undo, restart, updateSettings],
  )
}
