'use client'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { BarChart3, Layers, Image } from 'lucide-react'

export type AnalysisLevel = 'campaign' | 'adset' | 'ad'

interface LevelSelectorProps {
  value: AnalysisLevel
  onChange: (level: AnalysisLevel) => void
  className?: string
}

const levels = [
  {
    value: 'campaign' as AnalysisLevel,
    label: 'Campanhas',
    description: 'Compare performance entre campanhas',
    icon: BarChart3,
    color: 'text-blue-600'
  },
  {
    value: 'adset' as AnalysisLevel,
    label: 'Conjuntos de Anúncios',
    description: 'Compare conjuntos dentro de uma campanha',
    icon: Layers,
    color: 'text-purple-600'
  },
  {
    value: 'ad' as AnalysisLevel,
    label: 'Anúncios',
    description: 'Compare anúncios individuais com criativos',
    icon: Image,
    color: 'text-green-600'
  }
]

export function LevelSelector({ value, onChange, className }: LevelSelectorProps) {
  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">
            Escolha o nível de análise:
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {levels.map((level) => {
              const Icon = level.icon
              const isSelected = value === level.value
              
              return (
                <button
                  key={level.value}
                  onClick={() => onChange(level.value)}
                  className={cn(
                    'relative flex flex-col items-start p-4 rounded-lg border-2 transition-all',
                    'hover:border-primary/50 hover:bg-muted/50',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-background'
                  )}
                >
                  {/* Indicador de seleção */}
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    </div>
                  )}
                  
                  {/* Ícone */}
                  <div className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-lg mb-3',
                    isSelected ? 'bg-primary/10' : 'bg-muted'
                  )}>
                    <Icon className={cn(
                      'h-5 w-5',
                      isSelected ? level.color : 'text-muted-foreground'
                    )} />
                  </div>
                  
                  {/* Texto */}
                  <div className="text-left">
                    <div className={cn(
                      'font-medium mb-1',
                      isSelected ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {level.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {level.description}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
