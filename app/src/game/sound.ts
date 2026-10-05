type SoundName =
  | 'select'
  | 'submit'
  | 'tick'
  | 'warn'
  | 'reveal'
  | 'capture'
  | 'win'
  | 'lose'
  | 'draw'

let ctx: AudioContext | null = null

interface AudioWindow {
  AudioContext?: typeof AudioContext
  webkitAudioContext?: typeof AudioContext
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as AudioWindow
  const Ctor = w.AudioContext ?? w.webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function blip(freq: number, start: number, dur: number, gain: number, type: OscillatorType): void {
  const ac = audio()
  if (!ac) return
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, ac.currentTime + start)
  amp.gain.setValueAtTime(0.0001, ac.currentTime + start)
  amp.gain.exponentialRampToValueAtTime(gain, ac.currentTime + start + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur)
  osc.connect(amp).connect(ac.destination)
  osc.start(ac.currentTime + start)
  osc.stop(ac.currentTime + start + dur + 0.02)
}

/** 极简程序化音效，不依赖任何外部音频文件 */
export function playSound(name: SoundName, enabled: boolean): void {
  if (!enabled) return
  switch (name) {
    case 'select':
      blip(880, 0, 0.06, 0.04, 'triangle')
      break
    case 'submit':
      blip(520, 0, 0.08, 0.05, 'square')
      blip(760, 0.06, 0.1, 0.045, 'square')
      break
    case 'tick':
      blip(1180, 0, 0.045, 0.05, 'sine')
      break
    case 'warn':
      blip(1500, 0, 0.07, 0.08, 'sawtooth')
      break
    case 'reveal':
      blip(392, 0, 0.12, 0.06, 'triangle')
      blip(587, 0.1, 0.16, 0.055, 'triangle')
      break
    case 'capture':
      blip(220, 0, 0.1, 0.09, 'sawtooth')
      blip(140, 0.07, 0.16, 0.08, 'sawtooth')
      break
    case 'win':
      blip(523, 0, 0.14, 0.07, 'triangle')
      blip(659, 0.12, 0.14, 0.07, 'triangle')
      blip(784, 0.24, 0.3, 0.07, 'triangle')
      break
    case 'lose':
      blip(392, 0, 0.16, 0.06, 'sine')
      blip(294, 0.14, 0.2, 0.06, 'sine')
      blip(196, 0.3, 0.4, 0.06, 'sine')
      break
    case 'draw':
      blip(440, 0, 0.2, 0.05, 'sine')
      blip(440, 0.22, 0.24, 0.05, 'sine')
      break
  }
}
