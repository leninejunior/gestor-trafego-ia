'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CustomDateDialog } from './custom-date-dialog'
import { formatDateRange } from '@/lib/utils/date-formatter'
import { format } from 'date-fns'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DateRangeButtonsProps {
  value: string
  onChange: (value: string) => void
  availablePeriods?: string[] // Períodos que têm dados
}

const presetOptions = [
  { label: 'Hoje', value: '0' },
  { label: '7 dias', value: '7' },
  { label: '14 dias', value: '14' },
  { label: '28 dias', value: '28' },
  { label: '30 dias', value: '30' },
  { label: 'Esta semana', value: 'this_week' },
  { label: 'Semana passada', value: 'last_week' },
  { label: 'Este mês', value: 'this_month' },
  { label: 'Mês passado', value: 'last_month' },
  { label: '90 dias', value: '90' },
  { label: '6 meses', value: '180' },
  { label: '1 ano', value: '365' },
]

export function DateRangeButtons({ value, onChange, availablePeriods }: DateRangeButtonsProps) {
  const [showCustomDialog, setShowCustomDialog] = useState(false)
  const [customStartDate, setCustomStartDate] = useState<Date>()
  const [customEndDate, setCustomEndDate] = useState<Date>()

  // Verificar se é um valor customizado
  const isCustomValue = value.startsWith('custom:')
  
  // Extrair datas do valor customizado e criar label
  let displayLabel = ''
  if (isCustomValue) {
    const [, startStr, endStr] = value.split(':')
    if (startStr && endStr) {
      const start = new Date(startStr)
      const end = new Date(endStr)
      displayLabel = formatDateRange(start, end)
      
      // Atualizar estados se ainda não foram definidos
      if (!customStartDate) setCustomStartDate(start)
      if (!customEndDate) setCustomEndDate(end)
    }
  }

  const handleButtonClick = (buttonValue: string) => {
    if (buttonValue === 'custom') {
      setShowCustomDialog(true)
    } else {
      onChange(buttonValue)
      // Limpar datas customizadas ao selecionar preset
      setCustomStartDate(undefined)
      setCustomEndDate(undefined)
    }
  }

  const handleCustomDateConfirm = (startDate: Date, endDate: Date) => {
    setCustomStartDate(startDate)
    setCustomEndDate(endDate)
    
    // Formato: custom:2025-01-01:2025-01-31
    const customValue = `custom:${format(startDate, 'yyyy-MM-dd')}:${format(endDate, 'yyyy-MM-dd')}`
    onChange(customValue)
  }

  // Filtrar opções disponíveis se fornecido
  const visibleOptions = availablePeriods 
    ? presetOptions.filter(opt => availablePeriods.includes(opt.value))
    : presetOptions

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {visibleOptions.map((option) => {
          const isSelected = value === option.value
          
          return (
            <Button
              key={option.value}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => handleButtonClick(option.value)}
              className={cn(
                "transition-all",
                isSelected && "shadow-md"
              )}
            >
              {option.label}
            </Button>
          )
        })}
        
        {/* Botão customizado sempre visível */}
        <Button
          variant={isCustomValue ? "default" : "outline"}
          size="sm"
          onClick={() => setShowCustomDialog(true)}
          className={cn(
            "transition-all",
            isCustomValue && "shadow-md"
          )}
        >
          <Calendar className="w-3.5 h-3.5 mr-1.5" />
          {isCustomValue ? displayLabel : 'Personalizado'}
        </Button>
      </div>

      <CustomDateDialog
        open={showCustomDialog}
        onOpenChange={setShowCustomDialog}
        onConfirm={handleCustomDateConfirm}
        initialStartDate={customStartDate}
        initialEndDate={customEndDate}
      />
    </div>
  )
}
