'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DebugConnectionPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    try {
      const supabase = createClient()
      
      // Verificar usuário autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      setUser(user)
      
      console.log('👤 Usuário:', user?.email || 'Não autenticado')
      
      if (!user) {
        setData({ error: 'Usuário não autenticado' })
        setLoading(false)
        return
      }

      // Buscar clientes
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*')

      console.log('👥 Clientes:', clients?.length || 0)

      // Buscar conexões Meta
      const { data: connections, error: connectionsError } = await supabase
        .from('client_meta_connections')
        .select('*')

      console.log('🔗 Conexões:', connections?.length || 0)

      // Buscar campanhas
      const { data: campaigns, error: campaignsError } = await supabase
        .from('meta_campaigns')
        .select('*')

      console.log('📊 Campanhas:', campaigns?.length || 0)

      setData({
        user: {
          id: user.id,
          email: user.email
        },
        clients: clients || [],
        connections: connections || [],
        campaigns: campaigns || [],
        errors: {
          clients: clientsError?.message,
          connections: connectionsError?.message,
          campaigns: campaignsError?.message
        }
      })

    } catch (error) {
      console.error('Erro:', error)
      setData({ error: error instanceof Error ? error.message : 'Erro desconhecido' })
    } finally {
      setLoading(false)
    }
  }

  const syncCampaigns = async (clientId: string) => {
    try {
      setLoading(true)
      
      const response = await fetch('/api/meta/sync-campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clientId }),
      })
      
      const result = await response.json()
      console.log('Resultado da sincronização:', result)
      
      // Recarregar dados
      await checkConnection()
      
    } catch (error) {
      console.error('Erro na sincronização:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-8">Carregando...</div>
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug de Conexão - Sistema de Campanhas</h1>
      
      {!user ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">❌ Usuário não autenticado</h2>
          <p className="text-red-700">Você precisa estar logado para ver os dados.</p>
          <a href="/auth/login" className="text-blue-600 underline">Fazer login</a>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-green-800 mb-2">✅ Usuário autenticado</h2>
          <p className="text-green-700">Email: {user.email}</p>
          <p className="text-green-700">ID: {user.id}</p>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Clientes */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">
              👥 Clientes ({data.clients?.length || 0})
            </h2>
            {data.errors?.clients && (
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                <p className="text-red-700">Erro: {data.errors.clients}</p>
              </div>
            )}
            {data.clients?.length > 0 ? (
              <div className="space-y-2">
                {data.clients.map((client: any) => (
                  <div key={client.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-sm text-gray-600">ID: {client.id}</p>
                    </div>
                    <button
                      onClick={() => syncCampaigns(client.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      disabled={loading}
                    >
                      Sincronizar Campanhas
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">Nenhum cliente encontrado</p>
            )}
          </div>

          {/* Conexões Meta */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">
              🔗 Conexões Meta ({data.connections?.length || 0})
            </h2>
            {data.errors?.connections && (
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                <p className="text-red-700">Erro: {data.errors.connections}</p>
              </div>
            )}
            {data.connections?.length > 0 ? (
              <div className="space-y-2">
                {data.connections.map((conn: any) => (
                  <div key={conn.id} className="p-3 bg-gray-50 rounded">
                    <p className="font-medium">{conn.account_name}</p>
                    <p className="text-sm text-gray-600">Cliente ID: {conn.client_id}</p>
                    <p className="text-sm text-gray-600">Conta ID: {conn.ad_account_id}</p>
                    <p className="text-sm">
                      Status: <span className={conn.is_active ? 'text-green-600' : 'text-red-600'}>
                        {conn.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">Nenhuma conexão encontrada</p>
            )}
          </div>

          {/* Campanhas */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">
              📊 Campanhas ({data.campaigns?.length || 0})
            </h2>
            {data.errors?.campaigns && (
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                <p className="text-red-700">Erro: {data.errors.campaigns}</p>
              </div>
            )}
            {data.campaigns?.length > 0 ? (
              <div className="space-y-2">
                {data.campaigns.map((campaign: any) => (
                  <div key={campaign.id} className="p-3 bg-gray-50 rounded">
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-sm text-gray-600">Status: {campaign.status}</p>
                    <p className="text-sm text-gray-600">Objetivo: {campaign.objective}</p>
                    <p className="text-sm text-gray-600">Conexão ID: {campaign.connection_id}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">Nenhuma campanha encontrada</p>
            )}
          </div>

          {/* Dados brutos */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">🔍 Dados Brutos (JSON)</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        </div>
      )}

      <div className="mt-8">
        <button
          onClick={checkConnection}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          disabled={loading}
        >
          {loading ? 'Carregando...' : 'Recarregar Dados'}
        </button>
      </div>
    </div>
  )
}