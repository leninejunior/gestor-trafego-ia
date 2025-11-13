'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export function SyncBalanceButton() {
  const [syncing, setSyncing] = useState(false)
  const { toast } = useToast()

  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/balance/sync', {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Erro ao sincronizar')
      }

      const data = await response.json()
      
      toast({
        title: 'Sincronização concluída!',
        description: `${data.synced} conta(s) atualizada(s) com saldo real do Meta`,
      })

      // Recarregar a página para mostrar os novos dados
      setTimeout(() => window.location.reload(), 1000)
    } catch (error) {
      toast({
        title: 'Erro na sincronização',
        description: 'Não foi possível buscar os saldos do Meta',
        variant: 'destructive'
      })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Button
      onClick={handleSync}
      disabled={syncing}
      variant="default"
      className="flex items-center space-x-2"
    >
      <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
      <span>{syncing ? 'Sincronizando...' : 'Sincronizar Saldo Real'}</span>
    </Button>
  )
}
