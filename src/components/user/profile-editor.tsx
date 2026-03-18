'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { User, Mail, Save, AlertTriangle } from 'lucide-react'

interface UserProfile {
  user_id: string
  email: string
  first_name: string
  last_name: string
  created_at: string
  updated_at: string
}

interface AuthUser {
  email: string
  created_at: string
}

export function ProfileEditor() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  // Estados do formulário
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/user/profile')
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData?.error || 'Failed to load profile')
      }

      const data = await response.json()
      setProfile(data.profile)
      setAuthUser(data.auth_user)

      // Preencher formulário
      setFirstName(data.profile?.first_name || '')
      setLastName(data.profile?.last_name || '')
      setEmail(data.profile?.email || data.auth_user?.email || '')

    } catch (err: any) {
      console.error('Error loading profile:', err)
      setError(err.message || 'Erro ao carregar perfil')
    } finally {
      setLoading(false)
    }
  }

  const saveProfile = async () => {
    try {
      setSaving(true)
      setError(null)

      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: email
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData?.error || 'Failed to update profile')
      }

      const result = await response.json()

      toast({
        title: 'Sucesso',
        description: result.message || 'Perfil atualizado com sucesso'
      })

      if (result.warning) {
        toast({
          title: 'Atenção',
          description: result.warning,
          variant: 'default'
        })
      }

      // Recarregar perfil
      await loadProfile()

    } catch (err: any) {
      console.error('Error saving profile:', err)
      setError(err.message || 'Erro ao salvar perfil')
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao salvar perfil',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = () => {
    if (!profile && !authUser) return false
    
    const originalFirstName = profile?.first_name || ''
    const originalLastName = profile?.last_name || ''
    const originalEmail = profile?.email || authUser?.email || ''

    return (
      firstName !== originalFirstName ||
      lastName !== originalLastName ||
      email !== originalEmail
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
            <span>Carregando perfil...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Editar Perfil
        </CardTitle>
        <CardDescription>
          Atualize suas informações pessoais
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="firstName">Nome</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Seu nome"
            />
          </div>
          <div>
            <Label htmlFor="lastName">Sobrenome</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Seu sobrenome"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
          />
          <p className="text-sm text-muted-foreground mt-1">
            Alterar o email requer confirmação por email
          </p>
        </div>

        {profile && (
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-2">Informações da Conta</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div>
                <span className="font-medium">Conta criada em:</span>
                <br />
                {authUser?.created_at 
                  ? new Date(authUser.created_at).toLocaleDateString('pt-BR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  : 'N/A'
                }
              </div>
              <div>
                <span className="font-medium">Perfil atualizado em:</span>
                <br />
                {profile.updated_at 
                  ? new Date(profile.updated_at).toLocaleDateString('pt-BR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  : 'Nunca'
                }
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <Button 
            onClick={saveProfile} 
            disabled={saving || !hasChanges()}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}