/**
 * Breadcrumb para páginas administrativas
 * Navegação contextual baseada na rota atual
 */

'use client'

import { usePathname } from 'next/navigation'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Home, Shield } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href?: string
  icon?: React.ComponentType<{ className?: string }>
}

export function AdminBreadcrumb() {
  const pathname = usePathname()

  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [
      { label: 'Dashboard', href: '/dashboard', icon: Home }
    ]

    if (pathname && pathname.startsWith('/admin')) {
      items.push({ label: 'Admin', href: '/admin', icon: Shield })

      if (pathname === '/admin/campaigns') {
        items.push({ label: 'Dashboard de Campanhas' })
      } else if (pathname === '/admin/balance') {
        items.push({ label: 'Verificação de Saldo' })
      } else if (pathname === '/admin/utm') {
        items.push({ label: 'UTM Manager' })
      } else if (pathname === '/admin/ai-agent') {
        items.push({ label: 'Agente de IA' })
      } else if (pathname === '/admin/llm-config') {
        items.push({ label: 'Configuração LLM' })
      } else if (pathname === '/admin/monitoring') {
        items.push({ label: 'Monitoramento' })
      } else if (pathname === '/admin/api-docs') {
        items.push({ label: 'API para IA' })
      } else if (pathname === '/admin/organizations') {
        items.push({ label: 'Organizações' })
      } else if (pathname.startsWith('/admin/organizations/')) {
        items.push({ label: 'Organizações', href: '/admin/organizations' })
        items.push({ label: 'Detalhes' })
      } else if (pathname === '/admin/users') {
        items.push({ label: 'Usuários' })
      } else if (pathname === '/admin/billing') {
        items.push({ label: 'Faturamento' })
      }
    }

    return items
  }

  const breadcrumbItems = getBreadcrumbItems()

  if (breadcrumbItems.length <= 1) {
    return null
  }

  return (
    <div className="mb-6">
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbItems.map((item, index) => {
            const isLast = index === breadcrumbItems.length - 1
            const Icon = item.icon

            return (
              <div key={index} className="flex items-center">
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="flex items-center space-x-1">
                      {Icon && <Icon className="w-4 h-4" />}
                      <span>{item.label}</span>
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink 
                      href={item.href!}
                      className="flex items-center space-x-1 text-muted-foreground hover:text-foreground"
                    >
                      {Icon && <Icon className="w-4 h-4" />}
                      <span>{item.label}</span>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </div>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}
