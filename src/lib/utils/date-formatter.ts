// Utilitários para formatação de datas
import { format, parseISO, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * Converte string ou Date para objeto Date válido
 */
export function toDate(date: string | Date | null | undefined): Date | null {
  if (!date) return null
  
  if (date instanceof Date) {
    return isValid(date) ? date : null
  }
  
  try {
    const parsed = parseISO(date)
    return isValid(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Formatadores de data padronizados
 */
export const formatters = {
  /**
   * Formato curto para tabelas: 20/01/2025
   */
  short: (date: string | Date | null | undefined): string => {
    const d = toDate(date)
    if (!d) return '-'
    return format(d, 'dd/MM/yyyy')
  },

  /**
   * Formato para gráficos semanais: 20 de Jan
   */
  week: (date: string | Date | null | undefined): string => {
    const d = toDate(date)
    if (!d) return '-'
    return format(d, "dd 'de' MMM", { locale: ptBR })
  },

  /**
   * Formato completo: 20 de Janeiro de 2025
   */
  full: (date: string | Date | null | undefined): string => {
    const d = toDate(date)
    if (!d) return '-'
    return format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  },

  /**
   * Formato para APIs (ISO): 2025-01-20
   */
  api: (date: string | Date | null | undefined): string => {
    const d = toDate(date)
    if (!d) return ''
    return format(d, 'yyyy-MM-dd')
  },

  /**
   * Formato com hora: 20/01/2025 às 14:30
   */
  timestamp: (date: string | Date | null | undefined): string => {
    const d = toDate(date)
    if (!d) return '-'
    return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  },

  /**
   * Formato relativo: Há 2 horas, Há 3 dias
   */
  relative: (date: string | Date | null | undefined): string => {
    const d = toDate(date)
    if (!d) return '-'
    
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'Agora'
    if (diffMins < 60) return `Há ${diffMins} min`
    if (diffHours < 24) return `Há ${diffHours}h`
    if (diffDays < 7) return `Há ${diffDays} dias`
    if (diffDays < 30) return `Há ${Math.floor(diffDays / 7)} semanas`
    if (diffDays < 365) return `Há ${Math.floor(diffDays / 30)} meses`
    return `Há ${Math.floor(diffDays / 365)} anos`
  },

  /**
   * Formato para gráficos mensais: Jan/25
   */
  month: (date: string | Date | null | undefined): string => {
    const d = toDate(date)
    if (!d) return '-'
    return format(d, 'MMM/yy', { locale: ptBR })
  },

  /**
   * Formato para tooltips: Segunda, 20 de Janeiro
   */
  tooltip: (date: string | Date | null | undefined): string => {
    const d = toDate(date)
    if (!d) return '-'
    return format(d, "EEEE, dd 'de' MMMM", { locale: ptBR })
  }
}

/**
 * Calcula range de datas baseado em preset
 */
export function calculateDateRange(preset: string): { since: string; until: string } {
  const endDate = new Date()
  const startDate = new Date()
  
  switch (preset) {
    case '0':
      // Hoje
      return {
        since: format(endDate, 'yyyy-MM-dd'),
        until: format(endDate, 'yyyy-MM-dd')
      }
    
    case 'this_week':
      // Segunda-feira desta semana
      const startOfWeek = new Date(endDate)
      startOfWeek.setDate(endDate.getDate() - endDate.getDay() + 1)
      return {
        since: format(startOfWeek, 'yyyy-MM-dd'),
        until: format(endDate, 'yyyy-MM-dd')
      }
    
    case 'last_week':
      // Semana passada (segunda a domingo)
      const lastWeekEnd = new Date(endDate)
      lastWeekEnd.setDate(endDate.getDate() - endDate.getDay())
      const lastWeekStart = new Date(lastWeekEnd)
      lastWeekStart.setDate(lastWeekEnd.getDate() - 6)
      return {
        since: format(lastWeekStart, 'yyyy-MM-dd'),
        until: format(lastWeekEnd, 'yyyy-MM-dd')
      }
    
    case 'this_month':
      // Primeiro dia do mês até hoje
      const startOfMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
      return {
        since: format(startOfMonth, 'yyyy-MM-dd'),
        until: format(endDate, 'yyyy-MM-dd')
      }
    
    case 'last_month':
      // Mês passado completo
      const lastMonthStart = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1)
      const lastMonthEnd = new Date(endDate.getFullYear(), endDate.getMonth(), 0)
      return {
        since: format(lastMonthStart, 'yyyy-MM-dd'),
        until: format(lastMonthEnd, 'yyyy-MM-dd')
      }
    
    default:
      // Número de dias (7, 14, 28, 30, 90, 180, 365)
      const days = parseInt(preset)
      if (!isNaN(days)) {
        startDate.setDate(endDate.getDate() - days)
        return {
          since: format(startDate, 'yyyy-MM-dd'),
          until: format(endDate, 'yyyy-MM-dd')
        }
      }
      
      // Fallback: últimos 30 dias
      startDate.setDate(endDate.getDate() - 30)
      return {
        since: format(startDate, 'yyyy-MM-dd'),
        until: format(endDate, 'yyyy-MM-dd')
      }
  }
}

/**
 * Valida se um range de datas é válido
 */
export function validateDateRange(startDate: Date, endDate: Date): {
  valid: boolean
  error?: string
} {
  if (!isValid(startDate) || !isValid(endDate)) {
    return { valid: false, error: 'Data inválida' }
  }
  
  if (startDate > endDate) {
    return { valid: false, error: 'Data inicial deve ser anterior à data final' }
  }
  
  const diffDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000)
  
  if (diffDays > 365) {
    return { valid: false, error: 'Período máximo de 1 ano' }
  }
  
  if (diffDays < 0) {
    return { valid: false, error: 'Período inválido' }
  }
  
  return { valid: true }
}

/**
 * Formata range de datas para exibição
 */
export function formatDateRange(startDate: string | Date, endDate: string | Date): string {
  const start = toDate(startDate)
  const end = toDate(endDate)
  
  if (!start || !end) return '-'
  
  // Se for o mesmo dia
  if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
    return formatters.short(start)
  }
  
  // Se for o mesmo mês
  if (format(start, 'yyyy-MM') === format(end, 'yyyy-MM')) {
    return `${format(start, 'dd')} a ${format(end, 'dd/MM/yyyy')}`
  }
  
  // Se for o mesmo ano
  if (format(start, 'yyyy') === format(end, 'yyyy')) {
    return `${format(start, 'dd/MM')} a ${format(end, 'dd/MM/yyyy')}`
  }
  
  // Anos diferentes
  return `${formatters.short(start)} a ${formatters.short(end)}`
}
