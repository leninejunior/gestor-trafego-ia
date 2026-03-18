/**
 * Configuração de LLM - Admin
 * - Configuração de credenciais de IA
 * - Teste de conexão com APIs
 * - Configuração de modelos
 * - Monitoramento de uso
 * - Configuração de prompts
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Brain, 
  Key, 
  Settings, 
  TestTube, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  RefreshCw,
  Save,
  Eye,
  EyeOff,
  BarChart3,
  Zap,
  MessageSquare,
  Cpu,
  DollarSign
} from 'lucide-react'

interface LLMProvider {
  id: string
  name: string
  description: string
  is_active: boolean
  api_key: string
  base_url?: string
  model: string
  max_tokens: number
  temperature: number
  cost_per_1k_tokens: number
  status: 'connected' | 'disconnected' | 'error'
  last_tested: string
  usage_count: number
  total_cost: number
}

interface PromptTemplate {
  id: string
  name: string
  description: string
  category: 'analysis' | 'optimization' | 'reporting' | 'chat'
  template: string
  variables: string[]
  is_active: boolean
  usage_count: number
}

interface UsageStats {
  total_requests: number
  total_tokens: number
  total_cost: number
  avg_response_time: number
  success_rate: number
  top_models: Array<{
    model: string
    requests: number
    cost: number
  }>
}

export default function LLMConfigPage() {
  const [providers, setProviders] = useState<LLMProvider[]>([])
  const [prompts, setPrompts] = useState<PromptTemplate[]>([])
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [testingProvider, setTestingProvider] = useState<string | null>(null)
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({})
  
  // Novo provider
  const [showAddProvider, setShowAddProvider] = useState(false)
  const [newProvider, setNewProvider] = useState({
    name: '',
    description: '',
    api_key: '',
    base_url: '',
    model: 'gpt-3.5-turbo',
    max_tokens: 4000,
    temperature: 0.7,
    cost_per_1k_tokens: 0.002
  })

  // Novo prompt
  const [showAddPrompt, setShowAddPrompt] = useState(false)
  const [newPrompt, setNewPrompt] = useState({
    name: '',
    description: '',
    category: 'analysis' as const,
    template: '',
    variables: [] as string[]
  })

  useEffect(() => {
    loadLLMData()
  }, [])

  const loadLLMData = async () => {
    try {
      setLoading(true)
      
      // Carregar providers
      const providersResponse = await fetch('/api/admin/llm-config/providers')
      if (providersResponse.ok) {
        const providersData = await providersResponse.json()
        setProviders(providersData.providers || [])
      }

      // Carregar prompts
      const promptsResponse = await fetch('/api/admin/llm-config/prompts')
      if (promptsResponse.ok) {
        const promptsData = await promptsResponse.json()
        setPrompts(promptsData.prompts || [])
      }

      // Carregar estatísticas de uso
      const statsResponse = await fetch('/api/admin/llm-config/usage-stats')
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setUsageStats(statsData.stats)
      }

    } catch (error) {
      console.error('Error loading LLM data:', error)
    } finally {
      setLoading(false)
    }
  }

  const testProvider = async (providerId: string) => {
    setTestingProvider(providerId)
    
    try {
      const response = await fetch(`/api/admin/llm-config/providers/${providerId}/test`, {
        method: 'POST'
      })

      const result = await response.json()
      
      // Atualizar status do provider
      setProviders(prev => prev.map(p => 
        p.id === providerId 
          ? { ...p, status: result.success ? 'connected' : 'error', last_tested: new Date().toISOString() }
          : p
      ))

    } catch (error) {
      console.error('Error testing provider:', error)
    } finally {
      setTestingProvider(null)
    }
  }

  const saveProvider = async (provider: LLMProvider) => {
    try {
      const response = await fetch(`/api/admin/llm-config/providers/${provider.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(provider)
      })

      if (response.ok) {
        await loadLLMData()
      }
    } catch (error) {
      console.error('Error saving provider:', error)
    }
  }

  const addProvider = async () => {
    try {
      const response = await fetch('/api/admin/llm-config/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProvider)
      })

      if (response.ok) {
        await loadLLMData()
        setShowAddProvider(false)
        setNewProvider({
          name: '',
          description: '',
          api_key: '',
          base_url: '',
          model: 'gpt-3.5-turbo',
          max_tokens: 4000,
          temperature: 0.7,
          cost_per_1k_tokens: 0.002
        })
      }
    } catch (error) {
      console.error('Error adding provider:', error)
    }
  }

  const addPrompt = async () => {
    try {
      const response = await fetch('/api/admin/llm-config/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPrompt)
      })

      if (response.ok) {
        await loadLLMData()
        setShowAddPrompt(false)
        setNewPrompt({
          name: '',
          description: '',
          category: 'analysis',
          template: '',
          variables: []
        })
      }
    } catch (error) {
      console.error('Error adding prompt:', error)
    }
  }

  const toggleApiKeyVisibility = (providerId: string) => {
    setShowApiKeys(prev => ({
      ...prev,
      [providerId]: !prev[providerId]
    }))
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'error': return <XCircle className="h-4 w-4 text-red-600" />
      default: return <AlertTriangle className="h-4 w-4 text-yellow-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-100 text-green-800'
      case 'error': return 'bg-red-100 text-red-800'
      default: return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'analysis': return 'bg-blue-100 text-blue-800'
      case 'optimization': return 'bg-green-100 text-green-800'
      case 'reporting': return 'bg-purple-100 text-purple-800'
      case 'chat': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <Brain className="h-8 w-8 mr-3 text-purple-600" />
            Configuração de LLM
          </h1>
          <p className="text-muted-foreground">
            Configure provedores de IA e gerencie prompts para o agente inteligente
          </p>
        </div>
        <Button onClick={loadLLMData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Estatísticas de Uso */}
      {usageStats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(usageStats.total_requests)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(usageStats.total_tokens)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(usageStats.total_cost)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usageStats.avg_response_time.toFixed(0)}ms</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(usageStats.success_rate * 100).toFixed(1)}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="providers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="providers">Provedores</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="usage">Uso</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Provedores de LLM</h2>
            <Button onClick={() => setShowAddProvider(true)}>
              <Brain className="h-4 w-4 mr-2" />
              Adicionar Provider
            </Button>
          </div>

          <div className="space-y-4">
            {providers.map((provider) => (
              <Card key={provider.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(provider.status)}
                      <div>
                        <CardTitle>{provider.name}</CardTitle>
                        <CardDescription>{provider.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(provider.status)}>
                        {provider.status}
                      </Badge>
                      <Switch
                        checked={provider.is_active}
                        onCheckedChange={(checked) => {
                          const updatedProvider = { ...provider, is_active: checked }
                          saveProvider(updatedProvider)
                        }}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <Label>API Key</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type={showApiKeys[provider.id] ? 'text' : 'password'}
                          value={provider.api_key}
                          onChange={(e) => {
                            const updatedProvider = { ...provider, api_key: e.target.value }
                            setProviders(prev => prev.map(p => p.id === provider.id ? updatedProvider : p))
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleApiKeyVisibility(provider.id)}
                        >
                          {showApiKeys[provider.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label>Modelo</Label>
                      <Select
                        value={provider.model}
                        onValueChange={(value) => {
                          const updatedProvider = { ...provider, model: value }
                          setProviders(prev => prev.map(p => p.id === provider.id ? updatedProvider : p))
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                          <SelectItem value="gpt-4">GPT-4</SelectItem>
                          <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                          <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                          <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Max Tokens</Label>
                      <Input
                        type="number"
                        value={provider.max_tokens}
                        onChange={(e) => {
                          const updatedProvider = { ...provider, max_tokens: Number(e.target.value) }
                          setProviders(prev => prev.map(p => p.id === provider.id ? updatedProvider : p))
                        }}
                      />
                    </div>

                    <div>
                      <Label>Temperature</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        value={provider.temperature}
                        onChange={(e) => {
                          const updatedProvider = { ...provider, temperature: Number(e.target.value) }
                          setProviders(prev => prev.map(p => p.id === provider.id ? updatedProvider : p))
                        }}
                      />
                    </div>

                    <div>
                      <Label>Custo por 1K Tokens ($)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={provider.cost_per_1k_tokens}
                        onChange={(e) => {
                          const updatedProvider = { ...provider, cost_per_1k_tokens: Number(e.target.value) }
                          setProviders(prev => prev.map(p => p.id === provider.id ? updatedProvider : p))
                        }}
                      />
                    </div>

                    <div>
                      <Label>Base URL (opcional)</Label>
                      <Input
                        value={provider.base_url || ''}
                        onChange={(e) => {
                          const updatedProvider = { ...provider, base_url: e.target.value }
                          setProviders(prev => prev.map(p => p.id === provider.id ? updatedProvider : p))
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      <span>Uso: {formatNumber(provider.usage_count)} requests</span>
                      <span className="mx-2">•</span>
                      <span>Custo: {formatCurrency(provider.total_cost)}</span>
                      <span className="mx-2">•</span>
                      <span>Último teste: {provider.last_tested ? new Date(provider.last_tested).toLocaleString() : 'Nunca'}</span>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testProvider(provider.id)}
                        disabled={testingProvider === provider.id}
                      >
                        {testingProvider === provider.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <TestTube className="h-4 w-4 mr-1" />
                        )}
                        Testar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => saveProvider(provider)}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Salvar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="prompts" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Templates de Prompt</h2>
            <Button onClick={() => setShowAddPrompt(true)}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Adicionar Prompt
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {prompts.map((prompt) => (
              <Card key={prompt.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{prompt.name}</CardTitle>
                      <CardDescription>{prompt.description}</CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getCategoryColor(prompt.category)}>
                        {prompt.category}
                      </Badge>
                      <Switch checked={prompt.is_active} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium">Template:</Label>
                      <Textarea
                        value={prompt.template}
                        readOnly
                        className="mt-1 text-sm font-mono"
                        rows={4}
                      />
                    </div>
                    
                    {prompt.variables.length > 0 && (
                      <div>
                        <Label className="text-sm font-medium">Variáveis:</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {prompt.variables.map((variable) => (
                            <Badge key={variable} variant="outline" className="text-xs">
                              {variable}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-sm text-muted-foreground">
                      Usado {formatNumber(prompt.usage_count)} vezes
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas de Uso</CardTitle>
              <CardDescription>
                Monitoramento detalhado do uso dos provedores de LLM
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usageStats && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-3">Modelos Mais Usados</h3>
                    <div className="space-y-2">
                      {usageStats.top_models.map((model, index) => (
                        <div key={model.model} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Badge variant="outline">#{index + 1}</Badge>
                            <span className="font-medium">{model.model}</span>
                          </div>
                          <div className="flex items-center space-x-4 text-sm">
                            <span>{formatNumber(model.requests)} requests</span>
                            <span>{formatCurrency(model.cost)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Adicionar Provider */}
      {showAddProvider && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Adicionar Provedor LLM</CardTitle>
              <CardDescription>
                Configure um novo provedor de inteligência artificial
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={newProvider.name}
                    onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Modelo</Label>
                  <Select
                    value={newProvider.model}
                    onValueChange={(value) => setNewProvider({ ...newProvider, model: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                      <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                      <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={newProvider.description}
                    onChange={(e) => setNewProvider({ ...newProvider, description: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={newProvider.api_key}
                    onChange={(e) => setNewProvider({ ...newProvider, api_key: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Max Tokens</Label>
                  <Input
                    type="number"
                    value={newProvider.max_tokens}
                    onChange={(e) => setNewProvider({ ...newProvider, max_tokens: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <Label>Temperature</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={newProvider.temperature}
                    onChange={(e) => setNewProvider({ ...newProvider, temperature: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <Label>Custo por 1K Tokens ($)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={newProvider.cost_per_1k_tokens}
                    onChange={(e) => setNewProvider({ ...newProvider, cost_per_1k_tokens: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <Label>Base URL (opcional)</Label>
                  <Input
                    value={newProvider.base_url}
                    onChange={(e) => setNewProvider({ ...newProvider, base_url: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex space-x-2">
                <Button onClick={addProvider} className="flex-1">
                  Adicionar Provider
                </Button>
                <Button 
                  onClick={() => setShowAddProvider(false)} 
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Adicionar Prompt */}
      {showAddPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Adicionar Template de Prompt</CardTitle>
              <CardDescription>
                Crie um novo template de prompt para o agente de IA
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={newPrompt.name}
                    onChange={(e) => setNewPrompt({ ...newPrompt, name: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={newPrompt.category}
                    onValueChange={(value: any) => setNewPrompt({ ...newPrompt, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="analysis">Análise</SelectItem>
                      <SelectItem value="optimization">Otimização</SelectItem>
                      <SelectItem value="reporting">Relatórios</SelectItem>
                      <SelectItem value="chat">Chat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={newPrompt.description}
                    onChange={(e) => setNewPrompt({ ...newPrompt, description: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label>Template</Label>
                  <Textarea
                    value={newPrompt.template}
                    onChange={(e) => setNewPrompt({ ...newPrompt, template: e.target.value })}
                    rows={6}
                    placeholder="Digite o template do prompt. Use {{variavel}} para variáveis."
                  />
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Use {{variavel}} para criar variáveis no template. 
                  Exemplo: "Analise a campanha {{campaign_name}} com orçamento de {{budget}}."
                </AlertDescription>
              </Alert>

              <div className="flex space-x-2">
                <Button onClick={addPrompt} className="flex-1">
                  Adicionar Prompt
                </Button>
                <Button 
                  onClick={() => setShowAddPrompt(false)} 
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}