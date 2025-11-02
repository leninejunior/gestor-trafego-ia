'use client'

import { useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Calendar as CalendarIcon } from 'lucide-react'
import { validateDateRange, formatDateRange } from '@/lib/utils/date-formatter'
import { ptBR } from 'date-fns/locale'

interface CustomDateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (startDate: Date, endDate: Date) => void
  initialStartDate?: Date
  initialEndDate?: Date
  minDate?: Date
}

export function CustomDateDialog({
  open,
  onOpenChange,
  onConfirm,
  initialStartDate,
  initialEndDate,
  minDate
}: CustomDateDialogProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(initialStartDate)
  const [endDate, setEndDate] = useState<Date | undefined>(initialEndDate)
  const [error, setError] = useState<string>('')

  const handleConfirm = () => {
    if (!startDate || !endDate) {
      setError('Selecione as duas datas')
      return
    }

    const validation = validateDateRange(startDate, endDate)
    if (!validation.valid) {
      setError(validation.error || 'Período inválido')
      return
    }

    onConfirm(startDate, endDate)
    onOpenChange(false)
    setError('')
  }

  const handleCancel = () => {
    setStartDate(initialStartDate)
    setEndDate(initialEndDate)
    setError('')
    onOpenChange(false)
  }

  const handleStartDateSelect = (date: Date | undefined) => {
    setStartDate(date)
    setError('')
    
    // Se já tem data final e a nova data inicial é depois, limpar data final
    if (date && endDate && date > endDate) {
      setEndDate(undefined)
    }
  }

  const handleEndDateSelect = (date: Date | undefined) => {
    setEndDate(date)
    setError('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Selecionar Período Personalizado</DialogTitle>
          <DialogDescription>
            Escolha a data inicial e final para análise. Período máximo de 1 ano.
            {minDate && (
              <span className="block mt-1 text-orange-600">
                ⚠️ Seu plano permite dados a partir de {formatDateRange(minDate, minDate)}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          {/* Data Inicial */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CalendarIcon className="h-4 w-4" />
              Data Inicial
            </div>
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={handleStartDateSelect}
              locale={ptBR}
              disabled={(date) => {
                if (date > new Date()) return true
                if (minDate && date < minDate) return true
                return false
              }}
              className="rounded-md border"
            />
            {startDate && (
              <div className="text-sm text-muted-foreground text-center">
                {formatDateRange(startDate, startDate)}
              </div>
            )}
          </div>

          {/* Data Final */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CalendarIcon className="h-4 w-4" />
              Data Final
            </div>
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={handleEndDateSelect}
              locale={ptBR}
              disabled={(date) => {
                // Não pode ser depois de hoje
                if (date > new Date()) return true
                // Não pode ser antes do minDate
                if (minDate && date < minDate) return true
                // Não pode ser antes da data inicial
                if (startDate && date < startDate) return true
                // Não pode ser mais de 1 ano depois da data inicial
                if (startDate) {
                  const oneYearLater = new Date(startDate)
                  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
                  if (date > oneYearLater) return true
                }
                return false
              }}
              className="rounded-md border"
            />
            {endDate && (
              <div className="text-sm text-muted-foreground text-center">
                {formatDateRange(endDate, endDate)}
              </div>
            )}
          </div>
        </div>

        {/* Resumo do período selecionado */}
        {startDate && endDate && !error && (
          <Alert>
            <CalendarIcon className="h-4 w-4" />
            <AlertDescription>
              <strong>Período selecionado:</strong> {formatDateRange(startDate, endDate)}
              <br />
              <span className="text-xs text-muted-foreground">
                {Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} dias
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Erro */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!startDate || !endDate}>
            Aplicar Período
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
