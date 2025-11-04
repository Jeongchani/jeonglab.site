'use client'

import React from 'react'
import Link from 'next/link'
import type { LaunchItem } from '@/app/data/links'

function pill(text: string, tone: 'ok' | 'warn' | 'neutral') {
  const map = {
    ok: 'border-green-500/30 bg-green-500/15 text-green-300',
    warn: 'border-yellow-500/30 bg-yellow-500/15 text-yellow-200',
    neutral: 'border-white/20 bg-white/10 text-white/80',
  } as const
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] border ${map[tone]}`}>
      {text}
    </span>
  )
}

export default function LaunchGrid({ items }: { items: LaunchItem[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((x) => {
        const isInternal = x.scope === 'Tailnet'
        const pillScope = pill(x.scope, isInternal ? 'warn' : 'ok')
        const pillKind = pill(x.kind, 'neutral')
        const external = x.href.startsWith('http')
        const common = 'rounded-2xl border border-white/10 p-4 hover:bg-white/5 transition'

        // 내부/외부 링크에 따라 Link vs <a>
        const content = (
          <div className={common}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xl">{x.icon ?? '🔗'}</div>
              <div className="flex gap-2">{pillScope}{pillKind}</div>
            </div>
            <div className="font-semibold">{x.label}</div>
            {x.description && <p className="opacity-70 text-sm mt-1">{x.description}</p>}
            <p className="opacity-60 text-xs mt-2 truncate">{x.href}</p>
          </div>
        )

        // 외부 URL은 <a>, 내부 경로는 <Link>
        if (external && !x.href.startsWith('/')) {
          return (
            <a key={x.id} href={x.href} target="_blank" rel="noreferrer" className="block">
              {content}
            </a>
          )
        } else {
          return (
            <Link key={x.id} href={x.href} className="block">
              {content}
            </Link>
          )
        }
      })}
    </div>
  )
}
