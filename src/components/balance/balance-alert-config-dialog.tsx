/**
 * Dialog para Configurar Alertas de Saldo
 */

'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Bell, Mail, MessageSquare, AlertTriangle } from 'lucide-react'

interface BalanceAlertConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: string
  accountName: string
  clientId: string
  currentThreshold?: number
  onSave: (config: AlertConfig) => Promise<void>
}

export interface AlertConfig {
  account_id: string
  client_id: string
  threshold_amount: number
  notification_email: boolean
  notification_push: boolean
  notification_whatsapp: boolean
}

export function BalanceAlertConfigDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
  clientId,
  currentThreshold = 100,
  onSave
}: BalanceAlertConfigDialogProps) {
  
  const [config, setConfig] = useState<AlertConfig>({
    account_id: accountId,
    client_id: clientId,
    threshold_amount: currentThreshold,
    notification_email: true,
    notification_push: true,
    notification_whatsapp: false
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      if (config.threshold_amount <= 0) {
        setError('O valor do limite deve ser maior que zero')
        return
      }

      if (!config.notification_email && !config.notification_push && !config.notification_whatsapp) {
        setError('Selecione pelo menos um tipo de notificação')
        return
      }

      await onSave(config)
      onOpenChange(false)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar configuração')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configurar Alertas de Saldo</DialogTitle>
          <DialogDescription>
            Configure quando receber notificações sobre saldo baixo para {accountName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Limite de Saldo */}
          <div className="space-y-2">
            <Label htmlFor="threshold">
              Limite de Saldo (R$)
            </Label>
            <Input
              id="threshold"
              type="number"
              min="0"
              step="10"
              value={config.threshold_amount}
              onChange={(e) => setConfig({
                ...config,
                threshold_amount: Number(e.target.value)
              })}
              placeholder="100.00"
            />
            <p className="text-xs text-muted-foreground">
              Você será notificado quando o saldo ficar abaixo de {formatCurrency(config.threshold_amount)}
            </p>
          </div>

          {/* Tipos de Notificação */}
          <div className="space-y-4">
            <Label>Tipos de Notificação</Label>

            <div className="space-y-3">
              {/* Email */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-xs text-muted-foreground">
                      Receber alertas por email
                    </p>
                  </div>
                </div>
                <Switch
                  checked={config.notification_email}
                  onCheckedChange={(checked) => setConfig({
                    ...config,
                    notification_email: checked
                  })}
                />
              </div>

              {/* Push Notification */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Push Notification</p>
                    <p className="text-xs text-muted-foreground">
                      Notificações no navegador
                    </p>
                  </div>
                </div>
                <Switch
                  checked={config.notification_push}
                  onCheckedChange={(checked) => setConfig({
                    ...config,
                    notification_push: checked
                  })}
                />
              </div>

              {/* WhatsApp */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">WhatsApp</p>
                    <p className="text-xs text-muted-foreground">
                      Alertas via WhatsApp (requer configuração)
                    </p>
                  </div>
                </div>
                <Switch
                  checked={config.notification_whatsapp}
                  onCheckedChange={(checked) => setConfig({
                    ...config,
                    notification_whatsapp: checked
                  })}
                />
              </div>
            </div>
          </div>

          {/* Alerta Automático de Saldo Zerado */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Alerta Automático:</strong> Você sempre receberá notificações críticas quando o saldo zerar, independente desta configuração.
            </AlertDescription>
          </Alert>

          {/* Erro */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Ações */}
        <div className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Salvar Configuração'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
