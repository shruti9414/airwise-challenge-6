import { useMemo } from 'react'
import { Bot } from 'lucide-react'
import type { Profile } from '../types'
import { buildAdvice, type Context } from '../lib/engine'
import { AdviceView, Empty } from './ui'
import AiPanel from './AiPanel'
import { ProfileForm } from './ProfileForm'

export default function Assistant({ ctx, onProfile }: { ctx: Context | null; onProfile: (p: Profile) => void }) {
  const advice = useMemo(() => (ctx ? buildAdvice(ctx) : null), [ctx])
  if (!ctx || !advice) return <Empty>Personalised guidance appears once air-quality data is available. Retry loading or switch to sample data.</Empty>
  return (
    <div className="assistant">
      <details className="panel" open>
        <summary>Your household</summary>
        <ProfileForm idPrefix="as" profile={ctx.profile} onChange={onProfile} />
      </details>
      <div className="advice-card">
        <p className="tag"><Bot size={16} aria-hidden="true" />Rule-based advice · generated on your device, no AI service called</p>
        <AdviceView advice={advice} />
      </div>
      <AiPanel ctx={ctx} />
    </div>
  )
}
