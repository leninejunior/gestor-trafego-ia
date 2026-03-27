'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

type CampaignSquadShellProps = {
  title: string
  description: string
  children: ReactNode
  actions?: ReactNode
}

const NAV_ITEMS = [
  { href: '/dashboard/campaign-squad', label: 'Visao Geral' },
  { href: '/dashboard/campaign-squad/runs', label: 'Runs e Aprovacao' },
  { href: '/dashboard/campaign-squad/history', label: 'Historico de Runs' },
  { href: '/dashboard/campaign-squad/schedules', label: 'Agendamentos' },
  { href: '/dashboard/campaign-squad/context', label: 'Contexto Cliente' },
  { href: '/dashboard/campaign-squad/llm', label: 'Configuracao LLM' }
]

export function CampaignSquadShell({ title, description, children, actions }: CampaignSquadShellProps) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Campaign Squad</p>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href
            return (
              <Button key={item.href} asChild variant={active ? 'default' : 'outline'} size="sm">
                <Link href={item.href}>{item.label}</Link>
              </Button>
            )
          })}
        </div>
      </div>
      {children}
    </div>
  )
}
