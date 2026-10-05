export type Side = 'red' | 'black'

export type PieceKind =
  | 'general'
  | 'advisor'
  | 'elephant'
  | 'chariot'
  | 'horse'
  | 'cannon'
  | 'soldier'

export interface Pos {
  x: number
  y: number
}

export interface Piece extends Pos {
  id: string
  side: Side
  kind: PieceKind
  /** §7.3 底兵升格 */
  promoted: boolean
}

/** 一次秘密提交的着法：棋子 + 起终点 */
export interface PlannedMove {
  pieceId: string
  side: Side
  kind: PieceKind
  from: Pos
  to: Pos
}

/** null = 按兵不动 */
export type Submission = PlannedMove | null

export type Phase = 'decide' | 'handover' | 'reveal' | 'resolve' | 'over'

export type GameMode = 'ai' | 'hotseat'

export interface GameSettings {
  mode: GameMode
  /** 人机模式下人类执子方 */
  playerSide: Side
  aiLevel: 'easy' | 'normal'
  /** §9 决策阶段时长（秒） */
  decideSeconds: number
  /** §7.3 兵的升格，默认开启 */
  promoteSoldier: boolean
  /** §7.1 白脸将兜底裁决 */
  facingRule: boolean
  /** §10 视角旋转，让自己的棋子在下方 */
  rotated: boolean
  sound: boolean
}

export type VerdictKind =
  | 'pass'
  | 'move'
  | 'capture'
  | 'contest'
  | 'cross'
  | 'promote'
  | 'facing'

export interface VerdictEvent {
  kind: VerdictKind
  side?: Side
  /** 裁决依据的规则编号，如 6.2.1 */
  rule?: string
  text: string
}

export interface ResolvedRound {
  round: number
  red: Submission
  black: Submission
  /** 基于回合开始快照的中文着法描述 */
  labels: { red: string; black: string }
  pieces: Piece[]
  events: VerdictEvent[]
  summary: string
  /** 本回合是否有棋子被移除 */
  capture: boolean
  winner: Side | 'draw' | null
  reason: string
}

export interface LogEntry {
  round: number
  red: Submission
  black: Submission
  labels: { red: string; black: string }
  summary: string
  events: VerdictEvent[]
  winner: Side | 'draw' | null
}
