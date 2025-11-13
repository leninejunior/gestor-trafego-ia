'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Wallet, 
  TrendingDown, 
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  CreditCard,
  Target,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react'

interface AccountBalance {
  id: string
  ad_account_id: string
  ad_account_name: string
  balance: number
  currency: string
  status: 'healthy' | 'warning' | 'critical'
  client_id: string
  spend_cap?: number
  amount_spent?: number
  funding_source_type?: number
  funding_source_display?: string
  daily_spend?: number
  projected_days?: number
  last_sync_at?: string
}

type SortField = 'name' | 'balance' | 'status' | 'projected_days' | 'spend_cap'
type SortOrder = 'asc' | 'desc'

export function BalanceAccountsTable() {
  const [accounts, setAccounts] = useState<AccountBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('status')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  useEffect(() => {
    loadAccounts()
  }, [])

  const loadAccounts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/balance/my-accounts')
      
      if (response.ok) {
        const data = await response.json()
        setAccounts(data.balances || [])
      }
    } catch (error) {
      console.error('Error loading accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number, currency: string = 'BRL') => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(value)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'critical':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3" />
            Crítico
          </Badge>
        )
      case 'warning':
        return (
          <Badge variant="outline" className="flex items-center gap-1 border-yellow-500 text-yellow-700 bg-yellow-50">
            <AlertTriangle className="h-3 w-3" />
            Aviso
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1 border-green-500 text-green-700 bg-green-50">
            <TrendingUp className="h-3 w-3" />
            Saudável
          </Badge>
        )
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'bg-red-50 border-l-4 border-l-red-500'
      case 'warning':
        return 'bg-yellow-50 border-l-4 border-l-yellow-500'
      default:
        return 'bg-green-50 border-l-4 border-l-green-500'
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 text-muted-foreground" />
    }
    return sortOrder === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />
  }

  const filteredAndSortedAccounts = useMemo(() => {
    let filtered = accounts

    // Filtro de busca
    if (searchTerm) {
      filtered = filtered.filter(account => 
        account.ad_account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.ad_account_id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filtro de status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(account => account.status === statusFilter)
    }

    // Ordenação
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'name':
          comparison = a.ad_account_name.localeCompare(b.ad_account_name)
          break
        case 'balance':
          comparison = a.balance - b.balance
          break
        case 'status':
          const statusOrder = { critical: 0, warning: 1, healthy: 2 }
          comparison = statusOrder[a.status] - statusOrder[b.status]
          break
        case 'projected_days':
          const aDays = a.projected_days || 999
          const bDays = b.projected_days || 999
          comparison = aDays - bDays
          break
        case 'spend_cap':
          const aCap = a.spend_cap || 0
          const bCap = b.spend_cap || 0
          comparison = aCap - bCap
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [accounts, searchTerm, statusFilter, sortField, sortOrder])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64 text-center">
          <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            Nenhuma conta conectada
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Conecte suas contas Meta Ads para monitorar o saldo
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Contas Conectadas ({filteredAndSortedAccounts.length})
          </CardTitle>
        </div>
        
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou ID da conta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="healthy">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Saudável
                </div>
              </SelectItem>
              <SelectItem value="warning">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  Aviso
                </div>
              </SelectItem>
              <SelectItem value="critical">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  Crítico
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead 
                  className="font-semibold cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status
                    {getSortIcon('status')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-semibold cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center">
                    Conta
                    {getSortIcon('name')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-semibold text-right cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => handleSort('balance')}
                >
                  <div className="flex items-center justify-end">
                    Saldo Atual
                    {getSortIcon('balance')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-semibold text-right cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => handleSort('spend_cap')}
                >
                  <div className="flex items-center justify-end">
                    Limite de Gastos
                    {getSortIcon('spend_cap')}
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-right">Total Gasto</TableHead>
                <TableHead className="font-semibold">Meio de Pagamento</TableHead>
                <TableHead 
                  className="font-semibold text-center cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => handleSort('projected_days')}
                >
                  <div className="flex items-center justify-center">
                    Projeção
                    {getSortIcon('projected_days')}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {searchTerm || statusFilter !== 'all' 
                      ? 'Nenhuma conta encontrada com os filtros aplicados'
                      : 'Nenhuma conta conectada'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedAccounts.map((account) => (
                <TableRow 
                  key={account.id}
                  className={`${getStatusColor(account.status)} hover:opacity-80 transition-opacity`}
                >
                  <TableCell>
                    {getStatusBadge(account.status)}
                  </TableCell>
                  
                  <TableCell>
                    <div>
                      <p className="font-medium">{account.ad_account_name}</p>
                      <p className="text-xs text-muted-foreground">{account.ad_account_id}</p>
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <div>
                      <p className="font-bold text-lg">
                        {formatCurrency(account.balance, account.currency)}
                      </p>
                      {account.spend_cap && account.spend_cap > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {((account.balance / account.spend_cap) * 100).toFixed(0)}% do limite
                        </p>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-right">
                    {account.spend_cap && account.spend_cap > 0 ? (
                      <div className="flex items-center justify-end gap-1">
                        <Target className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">
                          {formatCurrency(account.spend_cap, account.currency)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  
                  <TableCell className="text-right">
                    {account.amount_spent && account.amount_spent > 0 ? (
                      <span className="font-medium text-muted-foreground">
                        {formatCurrency(account.amount_spent, account.currency)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    {account.funding_source_display ? (
                      <div className="flex items-start gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span className="text-sm">
                          {account.funding_source_display}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  
                  <TableCell className="text-center">
                    {account.projected_days && account.projected_days > 0 && account.projected_days < 999 ? (
                      <div>
                        <p className="font-bold text-lg">
                          {account.projected_days}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {account.projected_days === 1 ? 'dia' : 'dias'}
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Resumo e Legenda */}
        {filteredAndSortedAccounts.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Mostrando {filteredAndSortedAccounts.length} de {accounts.length} contas
            </span>
            {(searchTerm || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('')
                  setStatusFilter('all')
                }}
                className="text-primary hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}

        <div className="mt-6 pt-4 border-t">
          <p className="text-sm font-medium text-muted-foreground mb-3">Legenda de Status:</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2 p-2 rounded bg-green-50 border border-green-200">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-green-700">
                <strong>Saudável:</strong> Saldo acima de 40% ou +7 dias
              </span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-yellow-50 border border-yellow-200">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span className="text-sm text-yellow-700">
                <strong>Aviso:</strong> Saldo entre 20-40% ou 3-7 dias
              </span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-red-50 border border-red-200">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-sm text-red-700">
                <strong>Crítico:</strong> Saldo abaixo de 20% ou -3 dias
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
