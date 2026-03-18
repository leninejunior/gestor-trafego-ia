'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { 
  Crown, 
  Users, 
  UserCheck, 
  Plus, 
  Trash2, 
  Edit, 
  AlertTriangle, 
  UserPlus,
  Settings,
  Eye,
  Shield
} from 'lucide-react'

interface User {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  type: 'master' | 'client' | 'regular' | 'unassigned'
  client_access: Array<{
    client_id: string
    client_name: string
  }>
  organization_access: Array<{
    organization_id: string
    organization_name: string
    role: string
  }>
}

interface Client {
  id: string
  name: string
}

interface UserStats {
  total: number
  master_count: number
  client_count: number
  regular_count: number
  unassigned_count: number
}

export function MasterUserPanel() {
  const [users, setUsers] = useState<User[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  // Estados para criar usuário
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserType, setNewUserType] = useState<'master' | 'client' | 'regular'>('client')
  const [selectedClients, setSelectedClients] = useState<string[]>([])
  const [newUserNotes, setNewUserNotes] = useState('')
  const [creating, setCreating] = useState(false)

  // Estados para gerenciar acesso
  const [showAccessDialog, setShowAccessDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userClientAccess, setUserClientAccess] = useState<any[]>([])
  const [availableClients, setAvailableClients] = useState<Client[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Carregar usuários
      const usersResponse = await fetch('/api/admin/master-user-management')
      if (!usersResponse.ok) {
        const errorData = await usersResponse.json()
        throw new Error(errorData.error || 'Failed to load users')
      }

      const usersData = await usersResponse.json()
      setUsers(usersData.users || [])
      setStats({
        total: usersData.total || 0,
        master_count: usersData.master_count || 0,
        client_count: usersData.client_count || 0,
        regular_count: usersData.regular_count || 0,
        unassigned_count: usersData.unassigned_count || 0
      })

      // Carregar clientes
      const clientsResponse = await fetch('/api/clients')
      if (clientsResponse.ok) {
        const clientsData = await clientsResponse.json()
        setClients(clientsData.clients || [])
      }

    } catch (err: any) {
      console.error('Error loading data:', err)
      setError(err.message || 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const createUser = async () => {
    try {
      setCreating(true)

      const payload = {
        email: newUserEmail,
        password: newUserPassword,
        user_type: newUserType,
        client_ids: newUserType === 'client' ? selectedClients : undefined,
        notes: newUserNotes
      }

      const response = await fetch('/api/admin/master-user-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create user')
      }

      const result = await response.json()

      toast({
        title: 'Sucesso',
        description: result.message || 'Usuário criado com sucesso'
      })

      // Limpar formulário
      setNewUserEmail('')
      setNewUserPassword('')
      setNewUserType('client')
      setSelectedClients([])
      setNewUserNotes('')
      setShowCreateDialog(false)

      // Recarregar dados
      await loadData()

    } catch (err: any) {
      console.error('Error creating user:', err)
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao criar usuário',
        variant: 'destructive'
      })
    } finally {
      setCreating(false)
    }
  }

  const loadUserAccess = async (user: User) => {
    try {
      const response = await fetch(`/api/admin/user-client-access?userId=${user.id}`)
      if (!response.ok) {
        throw new Error('Failed to load user access')
      }

      const data = await response.json()
      setUserClientAccess(data.client_access || [])
      setAvailableClients(data.available_clients || [])
      setSelectedUser(user)
      setShowAccessDialog(true)

    } catch (err: any) {
      console.error('Error loading user access:', err)
      toast({
        title: 'Erro',
        description: 'Erro ao carregar acessos do usuário',
        variant: 'destructive'
      })
    }
  }

  const grantClientAccess = async (clientId: string) => {
    if (!selectedUser) return

    try {
      const response = await fetch('/api/admin/user-client-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUser.id,
          client_id: clientId,
          notes: `Acesso concedido via painel master`
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to grant access')
      }

      toast({
        title: 'Sucesso',
        description: 'Acesso concedido com sucesso'
      })

      // Recarregar acesso do usuário
      await loadUserAccess(selectedUser)

    } catch (err: any) {
      console.error('Error granting access:', err)
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao conceder acesso',
        variant: 'destructive'
      })
    }
  }

  const revokeClientAccess = async (clientId: string) => {
    if (!selectedUser) return

    try {
      const response = await fetch(
        `/api/admin/user-client-access?userId=${selectedUser.id}&clientId=${clientId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to revoke access')
      }

      toast({
        title: 'Sucesso',
        description: 'Acesso removido com sucesso'
      })

      // Recarregar acesso do usuário
      await loadUserAccess(selectedUser)

    } catch (err: any) {
      console.error('Error revoking access:', err)
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao remover acesso',
        variant: 'destructive'
      })
    }
  }

  const getUserTypeBadge = (type: string) => {
    switch (type) {
      case 'master':
        return <Badge variant="destructive" className="gap-1"><Crown className="w-3 h-3" />Master</Badge>
      case 'client':
        return <Badge variant="secondary" className="gap-1"><UserCheck className="w-3 h-3" />Cliente</Badge>
      case 'regular':
        return <Badge variant="outline" className="gap-1"><Users className="w-3 h-3" />Regular</Badge>
      default:
        return <Badge variant="outline" className="gap-1"><AlertTriangle className="w-3 h-3" />Não Atribuído</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando painel master...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Crown className="w-6 h-6 text-yellow-500" />
            Painel Master - Gestão de Usuários
          </h2>
          <p className="text-muted-foreground">
            Crie usuários sem limites e gerencie acesso específico a clientes
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="w-4 h-4" />
              Criar Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
              <DialogDescription>
                Crie um usuário sem limitações de plano
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="usuario@exemplo.com"
                />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Senha temporária"
                />
              </div>
              <div>
                <Label htmlFor="type">Tipo de Usuário</Label>
                <Select value={newUserType} onValueChange={(value: any) => setNewUserType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="master">Master (Acesso Total)</SelectItem>
                    <SelectItem value="client">Cliente (Acesso Restrito)</SelectItem>
                    <SelectItem value="regular">Regular (Sem Acesso Inicial)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newUserType === 'client' && (
                <div>
                  <Label>Clientes com Acesso</Label>
                  <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-2">
                    {clients.map((client) => (
                      <div key={client.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={client.id}
                          checked={selectedClients.includes(client.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedClients([...selectedClients, client.id])
                            } else {
                              setSelectedClients(selectedClients.filter(id => id !== client.id))
                            }
                          }}
                        />
                        <Label htmlFor={client.id} className="text-sm">
                          {client.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={newUserNotes}
                  onChange={(e) => setNewUserNotes(e.target.value)}
                  placeholder="Motivo da criação, contexto, etc..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={createUser} disabled={creating}>
                {creating ? 'Criando...' : 'Criar Usuário'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Master</CardTitle>
              <Crown className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.master_count}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cliente</CardTitle>
              <UserCheck className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.client_count}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Regular</CardTitle>
              <Users className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.regular_count}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Não Atribuído</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.unassigned_count}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela de Usuários */}
      <Card>
        <CardHeader>
          <CardTitle>Todos os Usuários do Sistema</CardTitle>
          <CardDescription>
            Gerencie todos os usuários sem limitações de plano
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Acesso a Clientes</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Último Login</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{getUserTypeBadge(user.type)}</TableCell>
                  <TableCell>
                    {user.client_access.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {user.client_access.slice(0, 2).map((access) => (
                          <Badge key={access.client_id} variant="outline" className="text-xs">
                            {access.client_name}
                          </Badge>
                        ))}
                        {user.client_access.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{user.client_access.length - 2}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Nenhum</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    {user.last_sign_in_at 
                      ? new Date(user.last_sign_in_at).toLocaleDateString('pt-BR')
                      : 'Nunca'
                    }
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadUserAccess(user)}
                      className="gap-1"
                    >
                      <Settings className="w-3 h-3" />
                      Gerenciar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de Gerenciamento de Acesso */}
      <Dialog open={showAccessDialog} onOpenChange={setShowAccessDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Acesso - {selectedUser?.email}</DialogTitle>
            <DialogDescription>
              Configure o acesso deste usuário aos clientes
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Clientes com Acesso</h4>
              {userClientAccess.length > 0 ? (
                <div className="space-y-2">
                  {userClientAccess.map((access) => (
                    <div key={access.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="font-medium">{access.clients.name}</span>
                        <p className="text-sm text-muted-foreground">
                          Desde {new Date(access.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => revokeClientAccess(access.client_id)}
                      >
                        Remover
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Nenhum acesso configurado</p>
              )}
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Conceder Novo Acesso</h4>
              <div className="space-y-2">
                {availableClients
                  .filter(client => !userClientAccess.some(access => access.client_id === client.id))
                  .map((client) => (
                    <div key={client.id} className="flex items-center justify-between p-2 border rounded">
                      <span>{client.name}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => grantClientAccess(client.id)}
                      >
                        Conceder Acesso
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccessDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}