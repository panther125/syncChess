import { Link } from 'react-router'
import { Badge } from '../components/ui/badge'

const GRADES = [
  { g: 7, name: '帅 / 将', note: '最高等级，但不可移动（§7.1）' },
  { g: 6, name: '车', note: '次于将' },
  { g: 5, name: '马', note: '' },
  { g: 4, name: '炮', note: '静止时按 4 级；主动移动参与争夺时无视等级必胜' },
  { g: 3, name: '士 / 仕', note: '底兵升格后也视为 3 级' },
  { g: 2, name: '象 / 相', note: '' },
  { g: 1, name: '兵 / 卒', note: '最低等级' },
]

const FLOW = [
  {
    no: 'A',
    title: '秘密决策（限时，默认 30 秒）',
    body: '双方各自选择 1 枚己方棋子 + 1 个合法落点，对方不可见；也可以按兵不动。着法必须在当前盘面下合法（马腿、象眼、炮架、车路照常）。',
  },
  { no: 'B', title: '同时揭示', body: '双方着法在同一时刻亮出，棋盘同时画出两条箭头。' },
  {
    no: 'C',
    title: '并行结算',
    body: '全部裁决基于回合开始时的盘面快照，一次性并行执行；本回合已被吃掉的棋子不再参与后续判定。',
  },
]

const CONFLICTS = [
  {
    tag: '§6.1',
    title: '基本并行',
    body: '目标格不同且路径不交叉 → 两子同时执行，互不干扰。',
  },
  {
    tag: '§6.2',
    title: '同格争夺（对撞）',
    body: '1. 移动中的炮必胜 → 炮吃掉对方并占格；2. 双方均非移动炮 → 等级高者吃掉低者并占格；3. 等级相同 → 同归于尽，该格留空。',
  },
  {
    tag: '§6.3',
    title: '吃将',
    body: '将不可动，故无法应将。着法指向对方将帅所在格且无子来犯同格 → 吃将立即获胜，无反制。',
  },
  {
    tag: '§6.4',
    title: '路径交叉（擦肩）',
    body: '两枚移动棋子的路径在同一回合内交叉（含直线对穿交换位置）→ 同归于尽，两格均留空。同向行驶、错时经过同一格不触发。',
  },
  {
    tag: '§6.5',
    title: '一方动、一方静',
    body: '目标格上是静止的非炮敌子 → 按传统吃子；目标格上是静止的炮 → 按等级争夺，冲撞者等级低于 4（士 / 象 / 兵）反被炮吃。',
  },
  {
    tag: '§7.2',
    title: '炮的移动必胜',
    body: '只要炮本回合主动移动并参与同格争夺，即无视对方等级取胜（吃将另判，见 §6.3）。',
  },
  {
    tag: '§7.3',
    title: '兵的升格（默认开启）',
    body: '兵 / 卒抵达对方底线后，等级视为 3（等同士），且可后退一格。',
  },
  {
    tag: '§8',
    title: '胜负与和棋',
    body: '吃将胜；对方全部可动棋子受困 → 围困胜；双方连续 60 个同步回合未吃子 → 和棋；双方将帅同回合同被吃 → 和棋。',
  },
  {
    tag: '§9',
    title: '时间与节奏',
    body: '默认决策 30 秒（快节奏 5 秒 / 标准 10 秒 / 15 秒可选），剩余 3 秒提示音；超时＝按兵不动；双方同时按兵不动累计 3 次 → 强制进入 5 秒快棋直到有人行动。',
  },
]

const NOTES = [
  '擦肩判定采用连续时间模型：把两枚移动棋子看作沿各自路径匀速直线行驶，只要求出两者在同一时刻位于同一位置（交点可以在途中，不必是整格）才算交叉。因此同向等速行驶、以及错时先后经过同一格都不触发同归于尽；迎头对穿则一定在途中相遇。',
  '一方落点恰好是对方本回合出发格（非对穿交换）时，对手已经离开，此格视为空格，不构成吃子。',
  '白脸将（§7.1）在提交阶段就禁止「单独一手造成照面」的着法；只有双方同时清掉照面线上的挡子才可能在结算后出现照面——此时单方负责方判负，双方同时负责则判和。',
  '静止的非炮子被吃时不比较等级（沿用传统吃子），这是本游戏与「军棋大吃小」的关键差异：兵可以吃静止的车，但兵去吃静止的炮会反被吃。',
  '双人同屏以「交接设备」实现秘密同时决策：红方决策并密封 → 遮屏交接 → 黑方在完整限时内决策 → 双方着法同时揭示、并行结算。黑方决策时棋盘自动旋转 180°（§10）。',
  '底兵升格在结算后立即标记，新等级与后退能力从下一回合起生效。',
]

export default function Rules() {
  return (
    <div className="rules-page">
      <nav className="home-nav rules-nav">
        <Link to="/" className="brand-title">
          同步象棋
        </Link>
        <Link to="/game" className="plain-link">
          直接进入棋盘 →
        </Link>
      </nav>

      <header className="rules-head">
        <p className="eyebrow">玩法设计文档 v0.1 · 规则层</p>
        <h1 className="rules-title">同步象棋规则速查</h1>
        <p className="rules-lead">
          基于标准中国象棋棋盘（9 × 10）与 32 枚棋子，废除「红先黑后」：每一轮双方同时、秘密提交着法，
          系统在同一时刻揭示并结算，产生对撞、错位、伏击等传统象棋不可能出现的局面。核心体验＝信息不完全 +
          同步决策 + 冲突裁决。
        </p>
      </header>

      <section className="rules-section">
        <h2>回合流程</h2>
        <ol className="flow-list">
          {FLOW.map((f) => (
            <li key={f.no}>
              <span className="flow-no">{f.no}</span>
              <div>
                <b>{f.title}</b>
                <p>{f.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rules-section">
        <h2>棋子等级（冲突裁决用）</h2>
        <p className="rules-motto">记忆口诀：将 &gt; 车 &gt; 马 &gt; 炮 &gt; 士 &gt; 象 &gt; 兵</p>
        <div className="grade-table">
          {GRADES.map((g) => (
            <div className="grade-row" key={g.g}>
              <span className="grade-no">{g.g}</span>
              <span className="grade-name">{g.name}</span>
              <span className="grade-note">{g.note}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rules-section">
        <h2>走法与裁决</h2>
        <p className="rules-sub">
          每枚棋子的走法与传统象棋一致：仕象限行宫内、象不过河且塞眼不可走、马蹩腿、车直线无阻、炮不吃子时直线任意格、吃子时需且仅需一个炮架、兵未过河只可前进、过河后可横走、不可后退；帅 / 将本局不可移动。
        </p>
        <div className="conflict-grid">
          {CONFLICTS.map((c) => (
            <article className="conflict-card" key={c.tag}>
              <header>
                <Badge variant="outline">{c.tag}</Badge>
                <h3>{c.title}</h3>
              </header>
              <p>{c.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rules-section">
        <h2>示例</h2>
        <ul className="example-list">
          <li>红车与黑马同抢一格 → 车（6）胜，马被吃。</li>
          <li>红炮主动移动与黑车同抢一格 → 炮胜（无视车等级）。</li>
          <li>红炮不动，黑炮移动来撞红炮所在格 → 黑炮是移动方，胜；黑车来吃红炮 → 车（6）胜炮（4）。</li>
          <li>红兵移动到黑静止炮所在格 → 兵（1）冲撞炮（4），兵阵亡，炮原地不动。</li>
          <li>两车在同一直线上迎面对穿 → 途中相遇，同归于尽，两格留空。</li>
        </ul>
      </section>

      <section className="rules-section">
        <h2>本实现的规则解读</h2>
        <p className="rules-sub">
          设计文档在同步结算处留有几处空白，代码里的补齐方式如下，对局中的裁决文案会标注对应条款。
        </p>
        <ol className="note-list">
          {NOTES.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ol>
      </section>

      <section className="rules-section">
        <h2>进阶与可选规则（文档 §11，本版本未实现）</h2>
        <div className="future-grid">
          <article>
            <b>暗同步</b>
            <p>决策阶段只选棋子，落点在揭示瞬间随机取一个合法点。</p>
          </article>
          <article>
            <b>双将局</b>
            <p>双方各有两枚将，任一将被吃即负，拉长中盘。</p>
          </article>
          <article>
            <b>连续同步</b>
            <p>一回合最多提交 2 步连续着法，揭示后一次性结算。</p>
          </article>
          <article>
            <b>弃子宣言 / 炮架连锁</b>
            <p>被吃换下一回合 +5 秒；炮吃子时炮架被震离随机一格。</p>
          </article>
        </div>
      </section>

      <footer className="home-foot">
        <span>网络同步与表现层不在本版本范围内 · 当前为纯前端本地对战实现</span>
      </footer>
    </div>
  )
}
