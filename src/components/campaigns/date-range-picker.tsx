'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CustomDateDialog } from './custom-date-dialog'
import { formatDateRange } from '@/lib/utils/date-formatter'
import { format } from 'date-fns'

interface DateRangePickerProps {
  value: string
  onChange: (value: string) => void
}

const presetOptions = [
  { label: 'Hoje', value: '0' },
  { label: 'Últimos 7 dias', value: '7' },
  { label: 'Últimos 14 dias', value: '14' },
  { label: 'Últimos 28 dias', value: '28' },
  { label: 'Últimos 30 dias', value: '30' },
  { label: 'Esta semana', value: 'this_week' },
  { label: 'Semana passada', value: 'last_week' },
  { label: 'Este mês', value: 'this_month' },
  { label: 'Mês passado', value: 'last_month' },
  { label: 'Últimos 90 dias', value: '90' },
  { label: 'Últimos 6 meses', value: '180' },
  { label: 'Máximo (1 ano)', value: '365' },
  { label: 'Personalizado...', value: 'custom' },
]

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
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

  const handleSelectChange = (newValue: string) => {
    if (newValue === 'custom') {
      setShowCustomDialog(true)
    } else {
      onChange(newValue)
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

  // Encontrar o label do preset ou usar o customizado
  const currentLabel = isCustomValue 
    ? displayLabel 
    : presetOptions.find(opt => opt.value === value)?.label || 'Selecionar período'

  return (
    <div className="w-full">
      <Select 
        value={isCustomValue ? 'custom' : value} 
        onValueChange={handleSelectChange}
      >
        <SelectTrigger className="w-full">
          <SelectValue>
            <span className="truncate block">{currentLabel}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {presetOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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