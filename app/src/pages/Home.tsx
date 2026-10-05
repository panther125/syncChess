import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '../components/ui/button'
import { Label } from '../components/ui/label'
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import type { GameSettings, Side } from '../game/types'
import { PIECE_NAME } from '../game/rules'

const SHOWCASE = ['俥', '傌', '炮', '兵', '帅', '車', '馬', '炮', '卒', '将']

function HeroPieces() {
  const glyphs = ['俥', '傌', '炮', '兵', '帅', '車', '馬', '炮', '卒', '将']
  return (
    <div className="hero-pieces" aria-hidden>
      {glyphs.map((g, i) => (
        <span key={i} className={`hero-piece ${i >= 5 ? 'hero-dark' : 'hero-red'}`} style={{ '--i': i } as CSSProperties}>
          {g}
        </span>
      ))}
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<GameSettings['mode']>('ai')
  const [side, setSide] = useState<Side>('red')
  const [level, setLevel] = useState<GameSettings['aiLevel']>('normal')
  const [secs, setSecs] = useState(30)

  const start = () => {
    const query = new URLSearchParams({
      mode,
      secs: String(secs),
    })
    if (mode === 'ai') {
      query.set('side', side)
      query.set('level', level)
    }
    navigate(`/game?${query.toString()}`)
  }

  return (
    <div className="home-page">
      <div className="home-glow" aria-hidden />
      <nav className="home-nav">
        <span className="brand-title">同步象棋</span>
        <div className="home-nav-links">
          <Link to="/rules" className="plain-link">
            玩法设计文档
          </Link>
        </div>
      </nav>

      <header className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow">二人同步博弈 · 纯前端本地对战</p>
          <h1 className="hero-title">
            废除红先黑后，
            <br />
            每一回合<span className="hero-accent">同时、秘密</span>落子
          </h1>
          <p className="hero-lead">
            棋盘、棋子与走法完全沿用中国象棋；但双方在同一轮内各自提交一步着法，系统基于同一盘面快照
            <b>并行结算</b>。同格争夺按等级裁决，移动中的炮必胜，路径交叉则同归于尽——
            你要算自己的棋，也要猜对手这一步想干什么。
          </p>
          <div className="hero-points">
            <div>
              <b>将 / 帅不可动</b>
              <span>护将全靠子力围护，九宫成为每回合的心算焦点</span>
            </div>
            <div>
              <b>炮是刺客</b>
              <span>静止时等级 4 是软肋，主动移动参与争夺时无视等级必胜</span>
            </div>
            <div>
              <b>超时即按兵不动</b>
              <span>犹豫的代价是把先手白送给对方，默认 30 秒一步</span>
            </div>
          </div>
        </div>
        <HeroPieces />
      </header>

      <section className="start-card">
        <div className="start-head">
          <h2>开始一局</h2>
          <p>选择对手与节奏，规则参数随时可在对局页调整。</p>
        </div>

        <div className="mode-grid">
          <button
            type="button"
            className={`mode-tile ${mode === 'ai' ? 'is-on' : ''}`}
            onClick={() => setMode('ai')}
          >
            <span className="mode-tag">推荐</span>
            <h3>人机对战</h3>
            <p>你与电脑在同一轮内各自秘密决策，揭示后统一结算。</p>
          </button>
          <button
            type="button"
            className={`mode-tile ${mode === 'hotseat' ? 'is-on' : ''}`}
            onClick={() => setMode('hotseat')}
          >
            <h3>双人同屏</h3>
            <p>一台设备轮流秘密决策：红方提交后交接设备，黑方再决策，随后同时揭示。</p>
          </button>
        </div>

        <div className="start-controls">
          {mode === 'ai' && (
            <>
              <div className="control-block">
                <Label className="control-label">我方执子</Label>
                <RadioGroup
                  value={side}
                  onValueChange={(v) => setSide(v as Side)}
                  className="inline-radio"
                >
                  <div className="radio-item">
                    <RadioGroupItem value="red" id="home-red" />
                    <Label htmlFor="home-red">
                      {PIECE_NAME.red.general} 红方
                    </Label>
                  </div>
                  <div className="radio-item">
                    <RadioGroupItem value="black" id="home-black" />
                    <Label htmlFor="home-black">
                      {PIECE_NAME.black.general} 黑方
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="control-block">
                <Label className="control-label">电脑难度</Label>
                <Select value={level} onValueChange={(v) => setLevel(v as GameSettings['aiLevel'])}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">简单</SelectItem>
                    <SelectItem value="normal">普通</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="control-block">
            <Label className="control-label">决策时长</Label>
            <Select value={String(secs)} onValueChange={(v) => setSecs(Number(v))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">快节奏 5 秒</SelectItem>
                <SelectItem value="10">标准 10 秒</SelectItem>
                <SelectItem value="15">15 秒</SelectItem>
                <SelectItem value="30">默认 30 秒</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="control-block control-note">
            <span>
              默认开启：兵的升格（§7.3）、白脸将兜底（§7.1）。
              <br />
              连续 3 次双方同时按兵不动 → 自动进入 5 秒快棋（§9）。
            </span>
          </div>
        </div>

        <div className="start-actions">
          <Button size="lg" className="start-cta" onClick={start}>
            进入棋盘
          </Button>
          <Link to="/rules" className="plain-link">
            先看裁决规则
          </Link>
        </div>
      </section>

      <section className="flow-card">
        <h2>一个同步回合</h2>
        <ol className="flow-steps">
          <li>
            <span className="flow-no">A</span>
            <div>
              <b>秘密决策</b>
              <p>双方在限时内各选 1 枚己方棋子 + 1 个合法落点，也可以选择按兵不动。对方看不到你的选择。</p>
            </div>
          </li>
          <li>
            <span className="flow-no">B</span>
            <div>
              <b>同时揭示</b>
              <p>两步着法在同一时刻亮出，棋盘画出双方箭头。</p>
            </div>
          </li>
          <li>
            <span className="flow-no">C</span>
            <div>
              <b>并行结算</b>
              <p>基于回合开始快照一次性裁决：同格争夺、路径交叉、冲撞静止炮，全部同时执行。</p>
            </div>
          </li>
        </ol>
      </section>

      <footer className="home-foot">
        <span>同步象棋 v0.1 · 玩法实现依据《同步象棋-玩法设计文档》</span>
        <span className="foot-pieces">{SHOWCASE.join(' ')}</span>
      </footer>
    </div>
  )
}
