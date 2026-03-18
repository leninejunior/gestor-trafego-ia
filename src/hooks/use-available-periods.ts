import { useState, useEffect } from 'react'

interface UseAvailablePeriodsProps {
  clientId: string
  enabled?: boolean
}

/**
 * Hook para detectar quais períodos têm dados disponíveis
 * Verifica se há campanhas/métricas em cada período
 */
export function useAvailablePeriods({ clientId, enabled = true }: UseAvailablePeriodsProps) {
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!clientId || !enabled) {
      setAvailablePeriods([])
      return
    }

    const checkPeriods = async () => {
      setIsLoading(true)
      
      try {
        // Períodos para verificar
        const periodsToCheck = [
          '0',          // Hoje
          '7',          // 7 dias
          '14',         // 14 dias
          '28',         // 28 dias
          '30',         // 30 dias
          'this_week',  // Esta semana
          'last_week',  // Semana passada
          'this_month', // Este mês
          'last_month', // Mês passado
          '90',         // 90 dias
          '180',        // 6 meses
          '365',        // 1 ano
        ]

        // Verificar cada período em paralelo
        const results = await Promise.all(
          periodsToCheck.map(async (period) => {
            try {
              const params = new URLSearchParams({
                client_id: clientId,
                days: period
              })
              
              const response = await fetch(`/api/dashboard/campaigns?${params}`)
              const data = await response.json()
              
              // Verificar se há campanhas com dados
              const hasCampaigns = data.campaigns && data.campaigns.length > 0
              const hasMetrics = data.campaigns?.some((c: any) => 
                c.impressions > 0 || c.clicks > 0 || c.spend > 0
              )
              
              return {
                period,
                hasData: hasCampaigns && hasMetrics
              }
            } catch (error) {
              console.error(`Erro ao verificar período ${period}:`, error)
              return { period, hasData: false }
            }
          })
        )

        // Filtrar apenas períodos com dados
        const available = results
          .filter(r => r.hasData)
          .map(r => r.period)

        setAvailablePeriods(available)
      } catch (error) {
        console.error('Erro ao verificar períodos disponíveis:', error)
        setAvailablePeriods([])
      } finally {
        setIsLoading(false)
      }
    }

    checkPeriods()
  }, [clientId, enabled])

  return {
    availablePeriods,
    isLoading,
    hasAnyData: availablePeriods.length > 0
  }
}
