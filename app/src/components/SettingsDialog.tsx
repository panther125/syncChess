import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'
import { Label } from './ui/label'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Separator } from './ui/separator'
import { Switch } from './ui/switch'
import type { GameSettings, Side } from '../game/types'
import { defaultSettings } from '../game/useGame'

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="setting-row">
      <div className="setting-label">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  )
}

export function SettingsDialog({
  settings,
  onChange,
  trigger,
}: {
  settings: GameSettings
  onChange(next: GameSettings): void
  trigger: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<GameSettings>(settings)

  const patch = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setDraft(settings)
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="settings-sheet">
        <DialogHeader>
          <DialogTitle>对局设置</DialogTitle>
          <DialogDescription>改动模式或执子方会立即开始新的一局。</DialogDescription>
        </DialogHeader>

        <Row label="对战模式" hint="纯前端本地对战，无需联网">
          <RadioGroup
            value={draft.mode}
            onValueChange={(v) => patch('mode', v as GameSettings['mode'])}
            className="inline-radio"
          >
            <div className="radio-item">
              <RadioGroupItem value="ai" id="mode-ai" />
              <Label htmlFor="mode-ai">人机对战</Label>
            </div>
            <div className="radio-item">
              <RadioGroupItem value="hotseat" id="mode-hotseat" />
              <Label htmlFor="mode-hotseat">双人同屏（交接）</Label>
            </div>
          </RadioGroup>
        </Row>

        {draft.mode === 'ai' && (
          <>
            <Row label="我方执子">
              <RadioGroup
                value={draft.playerSide}
                onValueChange={(v) => patch('playerSide', v as Side)}
                className="inline-radio"
              >
                <div className="radio-item">
                  <RadioGroupItem value="red" id="side-red" />
                  <Label htmlFor="side-red">红方（先选）</Label>
                </div>
                <div className="radio-item">
                  <RadioGroupItem value="black" id="side-black" />
                  <Label htmlFor="side-black">黑方</Label>
                </div>
              </RadioGroup>
            </Row>
            <Row label="电脑难度">
              <Select
                value={draft.aiLevel}
                onValueChange={(v) => patch('aiLevel', v as GameSettings['aiLevel'])}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">简单 · 会读招失误</SelectItem>
                  <SelectItem value="normal">普通 · 贪心兑换</SelectItem>
                </SelectContent>
              </Select>
            </Row>
          </>
        )}

        <Row label="决策时长" hint="超时＝按兵不动（§4）">
          <Select
            value={String(draft.decideSeconds)}
            onValueChange={(v) => patch('decideSeconds', Number(v))}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">快节奏 5 秒</SelectItem>
              <SelectItem value="10">标准 10 秒</SelectItem>
              <SelectItem value="15">15 秒</SelectItem>
              <SelectItem value="30">默认 30 秒</SelectItem>
            </SelectContent>
          </Select>
        </Row>

        <Separator />

        <Row label="兵的升格 §7.3" hint="底兵等级视为 3，且可后退一格">
          <Switch checked={draft.promoteSoldier} onCheckedChange={(v) => patch('promoteSoldier', v)} />
        </Row>
        <Row label="白脸将兜底 §7.1" hint="结算后帅将照面 → 违规方判负">
          <Switch checked={draft.facingRule} onCheckedChange={(v) => patch('facingRule', v)} />
        </Row>
        {draft.mode === 'ai' && (
          <Row label="黑方视角旋转 §10" hint="让自己的棋子始终在下方">
            <Switch checked={draft.rotated} onCheckedChange={(v) => patch('rotated', v)} />
          </Row>
        )}
        <Row label="音效" hint="读秒提示 / 揭示 / 吃子">
          <Switch checked={draft.sound} onCheckedChange={(v) => patch('sound', v)} />
        </Row>

        <DialogFooter className="settings-footer">
          <Button variant="ghost" onClick={() => setDraft(defaultSettings)}>
            恢复默认
          </Button>
          <Button
            onClick={() => {
              onChange(draft)
              setOpen(false)
            }}
          >
            应用设置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
