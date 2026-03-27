'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { Building2, Plus, Edit, Trash2, Users } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser } from '@/hooks/use-user'
import { createClient } from '@/lib/supabase/client'

interface Organization {
  id: string
  name: string
  created_at: string
  stats?: {
    activeMembers?: number
  }
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [formData, setFormData] = useState({ name: '' })
  const { toast } = useToast()
  const { user } = useUser()
  const supabase = createClient()

  useEffect(() => {
    if (user) {
      void loadOrganizations()
    }
  }, [user])

  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
        ...options.headers,
      },
    })
  }

  const loadOrganizations = async () => {
    try {
      setLoading(true)
      const response = await authenticatedFetch('/api/admin/organizations?include_stats=true')
      if (response.ok) {
        const data = await response.json()
        setOrganizations(data.organizations || [])
      } else {
        const data = await response.json()
        throw new Error(data.error || 'Falha ao carregar organizacoes')
      }
    } catch (error) {
      console.error('Error loading organizations:', error)
      toast({
        title: 'Erro',
        description: 'Falha ao carregar organizações',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      const response = await authenticatedFetch('/api/admin/organizations', {
        method: 'POST',
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: 'Organização criada com sucesso'
        })
        setIsCreateDialogOpen(false)
        setFormData({ name: '' })
        loadOrganizations()
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao criar organização',
        variant: 'destructive'
      })
    }
  }

  const handleEdit = async () => {
    if (!selectedOrg) return

    try {
      const response = await authenticatedFetch(`/api/admin/organizations/${selectedOrg.id}`, {
        method: 'PATCH',
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: 'Organização atualizada com sucesso'
        })
        setIsEditDialogOpen(false)
        setSelectedOrg(null)
        setFormData({ name: '' })
        loadOrganizations()
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao atualizar organização',
        variant: 'destructive'
      })
    }
  }

  const handleDelete = async () => {
    if (!selectedOrg) return

    try {
      const response = await authenticatedFetch(`/api/admin/organizations/${selectedOrg.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: 'Organização deletada com sucesso'
        })
        setIsDeleteDialogOpen(false)
        setSelectedOrg(null)
        loadOrganizations()
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao deletar organização',
        variant: 'destructive'
      })
    }
  }

  const openEditDialog = (org: Organization) => {
    setSelectedOrg(org)
    setFormData({ 
      name: org.name || ''
    })
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (org: Organization) => {
    setSelectedOrg(org)
    setIsDeleteDialogOpen(true)
  }

  const getMembersCount = (org: Organization) => {
    return org.stats?.activeMembers || 0
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Organizações</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as organizações do sistema
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Organização
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Organizações</CardTitle>
          <CardDescription>
            {organizations.length} organização(ões) cadastrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : organizations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma organização encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>

                  <TableHead>Membros</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{org.name}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>{getMembersCount(org)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(org.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(org)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDeleteDialog(org)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Criar */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Organização</DialogTitle>
            <DialogDescription>
              Crie uma nova organização no sistema
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome da organização"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Digite o nome da organização
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Organização</DialogTitle>
            <DialogDescription>
              Atualize as informações da organização
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome da organização"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Atualize o nome da organização
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Deletar */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar a organização &quot;{selectedOrg?.name}&quot;?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

