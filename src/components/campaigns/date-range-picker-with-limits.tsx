'use client'

import { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CustomDateDialog } from './custom-date-dialog'
import { formatDateRange } from '@/lib/utils/date-formatter'
import { format, subDays } from 'date-fns'
import { AlertCircle, Crown, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface DateRangePickerWithLimitsProps {
  value: string
  onChange: (value: string) => void
  showLimits?: boolean
}

interface PlanLimits {
  data_retention_days: number
}

const allPresetOptions = [
  { label: 'Hoje', value: '0', days: 0 },
  { label: 'Últimos 7 dias', value: '7', days: 7 },
  { label: 'Últimos 14 dias', value: '14', days: 14 },
  { label: 'Últimos 28 dias', value: '28', days: 28 },
  { label: 'Últimos 30 dias', value: '30', days: 30 },
  { label: 'Esta semana', value: 'this_week', days: 7 },
  { label: 'Semana passada', value: 'last_week', days: 14 },
  { label: 'Este mês', value: 'this_month', days: 30 },
  { label: 'Mês passado', value: 'last_month', days: 60 },
  { label: 'Últimos 90 dias', value: '90', days: 90 },
  { label: 'Últimos 6 meses', value: '180', days: 180 },
  { label: 'Máximo (1 ano)', value: '365', days: 365 },
  { label: 'Personalizado...', value: 'custom', days: 0 },
]

export function DateRangePickerWithLimits({ 
  value, 
  onChange,
  showLimits = true 
}: DateRangePickerWithLimitsProps) {
  const [showCustomDialog, setShowCustomDialog] = useState(false)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [customStartDate, setCustomStartDate] = useState<Date>()
  const [customEndDate, setCustomEndDate] = useState<Date>()
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (showLimits) {
      fetchPlanLimits()
    } else {
      setLoading(false)
    }
  }, [showLimits])

  const fetchPlanLimits = async () => {
    try {
      const response = await fetch('/api/feature-gate/data-retention')
      if (response.ok) {
        const data = await response.json()
        setPlanLimits({ data_retention_days: data.retention_days })
      }
    } catch (error) {
      console.error('Error fetching plan limits:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const isOptionAllowed = (days: number): boolean => {
    if (!showLimits || !planLimits) return true
    if (days === 0) return true // "custom" option
    return days <= planLimits.data_retention_days
  }

  const getMaxAllowedDate = (): Date => {
    if (!planLimits) return subDays(new Date(), 365)
    return subDays(new Date(), planLimits.data_retention_days)
  }

  const handleSelectChange = (newValue: string) => {
    const option = allPresetOptions.find(opt => opt.value === newValue)
    
    if (newValue === 'custom') {
      setShowCustomDialog(true)
      return
    }

    if (option && !isOptionAllowed(option.days)) {
      setShowUpgradeDialog(true)
      return
    }

    onChange(newValue)
    // Limpar datas customizadas ao selecionar preset
    setCustomStartDate(undefined)
    setCustomEndDate(undefined)
  }

  const handleCustomDateConfirm = (startDate: Date, endDate: Date) => {
    // Validate custom date range against plan limits
    if (showLimits && planLimits) {
      const maxDate = getMaxAllowedDate()
      if (startDate < maxDate) {
        setShowUpgradeDialog(true)
        return
      }
    }

    setCustomStartDate(startDate)
    setCustomEndDate(endDate)
    
    // Formato: custom:2025-01-01:2025-01-31
    const customValue = `custom:${format(startDate, 'yyyy-MM-dd')}:${format(endDate, 'yyyy-MM-dd')}`
    onChange(customValue)
  }

  // Filtrar opções baseado nos limites do plano
  const availableOptions = showLimits && planLimits
    ? allPresetOptions.map(opt => ({
        ...opt,
        disabled: opt.value !== 'custom' && !isOptionAllowed(opt.days)
      }))
    : allPresetOptions.map(opt => ({ ...opt, disabled: false }))

  // Encontrar o label do preset ou usar o customizado
  const currentLabel = isCustomValue 
    ? displayLabel 
    : allPresetOptions.find(opt => opt.value === value)?.label || 'Selecionar período'

  if (loading) {
    return (
      <div className="w-full">
        <Select disabled>
          <SelectTrigger className="w-full">
            <SelectValue>Carregando...</SelectValue>
          </SelectTrigger>
        </Select>
      </div>
    )
  }

  return (
    <div className="w-full space-y-2">
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
          {availableOptions.map((option) => (
            <SelectItem 
              key={option.value} 
              value={option.value}
              disabled={option.disabled}
            >
              <div className="flex items-center justify-between w-full">
                <span>{option.label}</span>
                {option.disabled && (
                  <Lock className="w-3 h-3 ml-2 text-muted-foreground" />
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Show retention info */}
      {showLimits && planLimits && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="w-3 h-3" />
          <span>
            Dados disponíveis: últimos {planLimits.data_retention_days} dias
          </span>
        </div>
      )}

      <CustomDateDialog
        open={showCustomDialog}
        onOpenChange={setShowCustomDialog}
        onConfirm={handleCustomDateConfirm}
        initialStartDate={customStartDate}
        initialEndDate={customEndDate}
        minDate={showLimits && planLimits ? getMaxAllowedDate() : undefined}
      />

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-orange-600" />
              Período Não Disponível
            </DialogTitle>
            <DialogDescription>
              O período selecionado excede o limite de retenção de dados do seu plano atual.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Retenção Atual</span>
                <span className="text-lg font-bold text-blue-600">
                  {planLimits?.data_retention_days || 0} dias
                </span>
              </div>
              <div className="text-xs text-gray-600">
                Seu plano permite acesso a dados dos últimos {planLimits?.data_retention_days || 0} dias.
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-600">
              <p>Com um plano superior você terá:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Até 3650 dias (10 anos) de retenção</li>
                <li>Acesso a dados históricos completos</li>
                <li>Análises de tendências de longo prazo</li>
                <li>Relatórios anuais e comparativos</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowUpgradeDialog(false)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              asChild
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Link href="/dashboard/billing">
                <Crown className="w-4 h-4 mr-2" />
                Ver Planos
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
