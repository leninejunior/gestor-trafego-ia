/**
 * Página de Gerenciamento de UTM - Admin
 * - Criação e edição de parâmetros UTM
 * - Templates de UTM
 * - Análise de performance por UTM
 * - Gerador de URLs
 * - Relatórios de tracking
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Link, 
  Copy, 
  Plus, 
  Edit, 
  Trash2, 
  BarChart3,
  ExternalLink,
  Tag,
  Target,
  Globe,
  RefreshCw,
  Download,
  Upload,
  Settings
} from 'lucide-react'

interface UTMTemplate {
  id: string
  name: string
  description: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_term?: string
  utm_content?: string
  base_url: string
  created_at: string
  usage_count: number
  is_active: boolean
}

interface UTMAnalytics {
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_term?: string
  utm_content?: string
  clicks: number
  conversions: number
  spend: number
  revenue: number
  ctr: number
  conversion_rate: number
  roas: number
}

interface URLGenerator {
  base_url: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_term: string
  utm_content: string
}

export default function UTMPage() {
  const [templates, setTemplates] = useState<UTMTemplate[]>([])
  const [analytics, setAnalytics] = useState<UTMAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<UTMTemplate | null>(null)
  
  // Gerador de URL
  const [urlGenerator, setUrlGenerator] = useState<URLGenerator>({
    base_url: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_term: '',
    utm_content: ''
  })

  // Novo template
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_term: '',
    utm_content: '',
    base_url: ''
  })

  // Filtros para analytics
  const [analyticsFilter, setAnalyticsFilter] = useState({
    date_range: '30',
    utm_source: 'all',
    utm_medium: 'all'
  })

  useEffect(() => {
    loadUTMData()
  }, [analyticsFilter])

  const loadUTMData = async () => {
    try {
      setLoading(true)
      
      // Carregar templates
      const templatesResponse = await fetch('/api/admin/utm/templates')
      if (templatesResponse.ok) {
        const templatesData = await templatesResponse.json()
        setTemplates(templatesData.templates || [])
      }

      // Carregar analytics
      const analyticsResponse = await fetch(`/api/admin/utm/analytics?days=${analyticsFilter.date_range}&source=${analyticsFilter.utm_source}&medium=${analyticsFilter.utm_medium}`)
      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json()
        setAnalytics(analyticsData.analytics || [])
      }

    } catch (error) {
      console.error('Error loading UTM data:', error)
    } finally {
      setLoading(false)
    }
  }

  const createTemplate = async () => {
    try {
      const response = await fetch('/api/admin/utm/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate)
      })

      if (response.ok) {
        await loadUTMData()
        setShowCreateTemplate(false)
        setNewTemplate({
          name: '',
          description: '',
          utm_source: '',
          utm_medium: '',
          utm_campaign: '',
          utm_term: '',
          utm_content: '',
          base_url: ''
        })
      }
    } catch (error) {
      console.error('Error creating template:', error)
    }
  }

  const updateTemplate = async () => {
    if (!editingTemplate) return

    try {
      const response = await fetch(`/api/admin/utm/templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTemplate)
      })

      if (response.ok) {
        await loadUTMData()
        setEditingTemplate(null)
      }
    } catch (error) {
      console.error('Error updating template:', error)
    }
  }

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) return

    try {
      const response = await fetch(`/api/admin/utm/templates/${templateId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await loadUTMData()
      }
    } catch (error) {
      console.error('Error deleting template:', error)
    }
  }

  const generateURL = () => {
    const params = new URLSearchParams()
    if (urlGenerator.utm_source) params.append('utm_source', urlGenerator.utm_source)
    if (urlGenerator.utm_medium) params.append('utm_medium', urlGenerator.utm_medium)
    if (urlGenerator.utm_campaign) params.append('utm_campaign', urlGenerator.utm_campaign)
    if (urlGenerator.utm_term) params.append('utm_term', urlGenerator.utm_term)
    if (urlGenerator.utm_content) params.append('utm_content', urlGenerator.utm_content)

    const baseUrl = urlGenerator.base_url.includes('?') 
      ? urlGenerator.base_url + '&' 
      : urlGenerator.base_url + '?'
    
    return baseUrl + params.toString()
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // Aqui você poderia adicionar um toast de sucesso
  }

  const loadTemplateToGenerator = (template: UTMTemplate) => {
    setUrlGenerator({
      base_url: template.base_url,
      utm_source: template.utm_source,
      utm_medium: template.utm_medium,
      utm_campaign: template.utm_campaign,
      utm_term: template.utm_term || '',
      utm_content: template.utm_content || ''
    })
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value)
  }

  // Calcular totais dos analytics
  const totalClicks = analytics.reduce((sum, item) => sum + item.clicks, 0)
  const totalConversions = analytics.reduce((sum, item) => sum + item.conversions, 0)
  const totalSpend = analytics.reduce((sum, item) => sum + item.spend, 0)
  const totalRevenue = analytics.reduce((sum, item) => sum + item.revenue, 0)
  const avgCTR = analytics.length > 0 ? analytics.reduce((sum, item) => sum + item.ctr, 0) / analytics.length : 0
  const avgROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0

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
          <h1 className="text-3xl font-bold">Gerenciamento de UTM</h1>
          <p className="text-muted-foreground">
            Crie, gerencie e analise parâmetros UTM para tracking de campanhas
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => setShowCreateTemplate(true)} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Novo Template
          </Button>
          <Button onClick={loadUTMData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="generator" className="space-y-4">
        <TabsList>
          <TabsTrigger value="generator">Gerador de URL</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="generator" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Link className="h-5 w-5 mr-2" />
                Gerador de URL com UTM
              </CardTitle>
              <CardDescription>
                Crie URLs com parâmetros UTM para tracking de campanhas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="base_url">URL Base *</Label>
                  <Input
                    id="base_url"
                    placeholder="https://exemplo.com/pagina"
                    value={urlGenerator.base_url}
                    onChange={(e) => setUrlGenerator({
                      ...urlGenerator,
                      base_url: e.target.value
                    })}
                  />
                </div>

                <div>
                  <Label htmlFor="utm_source">UTM Source *</Label>
                  <Input
                    id="utm_source"
                    placeholder="google, facebook, newsletter"
                    value={urlGenerator.utm_source}
                    onChange={(e) => setUrlGenerator({
                      ...urlGenerator,
                      utm_source: e.target.value
                    })}
                  />
                </div>

                <div>
                  <Label htmlFor="utm_medium">UTM Medium *</Label>
                  <Input
                    id="utm_medium"
                    placeholder="cpc, email, social"
                    value={urlGenerator.utm_medium}
                    onChange={(e) => setUrlGenerator({
                      ...urlGenerator,
                      utm_medium: e.target.value
                    })}
                  />
                </div>

                <div>
                  <Label htmlFor="utm_campaign">UTM Campaign *</Label>
                  <Input
                    id="utm_campaign"
                    placeholder="black_friday_2024"
                    value={urlGenerator.utm_campaign}
                    onChange={(e) => setUrlGenerator({
                      ...urlGenerator,
                      utm_campaign: e.target.value
                    })}
                  />
                </div>

                <div>
                  <Label htmlFor="utm_term">UTM Term</Label>
                  <Input
                    id="utm_term"
                    placeholder="palavra-chave"
                    value={urlGenerator.utm_term}
                    onChange={(e) => setUrlGenerator({
                      ...urlGenerator,
                      utm_term: e.target.value
                    })}
                  />
                </div>

                <div>
                  <Label htmlFor="utm_content">UTM Content</Label>
                  <Input
                    id="utm_content"
                    placeholder="banner_topo, link_texto"
                    value={urlGenerator.utm_content}
                    onChange={(e) => setUrlGenerator({
                      ...urlGenerator,
                      utm_content: e.target.value
                    })}
                  />
                </div>
              </div>

              {/* URL Gerada */}
              {urlGenerator.base_url && urlGenerator.utm_source && urlGenerator.utm_medium && urlGenerator.utm_campaign && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <Label className="text-sm font-medium">URL Gerada:</Label>
                  <div className="flex items-center space-x-2 mt-2">
                    <Input
                      value={generateURL()}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      onClick={() => copyToClipboard(generateURL())}
                      variant="outline"
                      size="sm"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => window.open(generateURL(), '_blank')}
                      variant="outline"
                      size="sm"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Templates de UTM</CardTitle>
              <CardDescription>
                Templates salvos para reutilização rápida
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {templates.map((template) => (
                  <div key={template.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">{template.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {template.description}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">
                          {template.usage_count} usos
                        </Badge>
                        <Button
                          onClick={() => loadTemplateToGenerator(template)}
                          variant="outline"
                          size="sm"
                        >
                          <Link className="h-4 w-4 mr-1" />
                          Usar
                        </Button>
                        <Button
                          onClick={() => setEditingTemplate(template)}
                          variant="outline"
                          size="sm"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => deleteTemplate(template.id)}
                          variant="outline"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Source:</span>
                        <div className="font-medium">{template.utm_source}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Medium:</span>
                        <div className="font-medium">{template.utm_medium}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Campaign:</span>
                        <div className="font-medium">{template.utm_campaign}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Term:</span>
                        <div className="font-medium">{template.utm_term || '-'}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Content:</span>
                        <div className="font-medium">{template.utm_content || '-'}</div>
                      </div>
                    </div>

                    <div className="mt-3 p-2 bg-gray-50 rounded text-sm font-mono">
                      {template.base_url}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {/* Filtros de Analytics */}
          <Card>
            <CardHeader>
              <CardTitle>Filtros de Análise</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Período</Label>
                  <Select 
                    value={analyticsFilter.date_range} 
                    onValueChange={(value) => setAnalyticsFilter({
                      ...analyticsFilter,
                      date_range: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 dias</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                      <SelectItem value="90">90 dias</SelectItem>
                      <SelectItem value="365">1 ano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>UTM Source</Label>
                  <Select 
                    value={analyticsFilter.utm_source} 
                    onValueChange={(value) => setAnalyticsFilter({
                      ...analyticsFilter,
                      utm_source: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>UTM Medium</Label>
                  <Select 
                    value={analyticsFilter.utm_medium} 
                    onValueChange={(value) => setAnalyticsFilter({
                      ...analyticsFilter,
                      utm_medium: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="cpc">CPC</SelectItem>
                      <SelectItem value="social">Social</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="organic">Organic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPIs de UTM */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cliques</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(totalClicks)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversões</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(totalConversions)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gasto</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalSpend)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Receita</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CTR Médio</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgCTR.toFixed(2)}%</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ROAS</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgROAS.toFixed(2)}x</div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Analytics */}
          <Card>
            <CardHeader>
              <CardTitle>Performance por UTM</CardTitle>
              <CardDescription>
                Análise detalhada de performance por parâmetros UTM
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.map((item, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Source:</span>
                        <div className="font-medium">{item.utm_source}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Medium:</span>
                        <div className="font-medium">{item.utm_medium}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Campaign:</span>
                        <div className="font-medium">{item.utm_campaign}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Term:</span>
                        <div className="font-medium">{item.utm_term || '-'}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Content:</span>
                        <div className="font-medium">{item.utm_content || '-'}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Cliques</span>
                        <div className="font-semibold">{formatNumber(item.clicks)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Conversões</span>
                        <div className="font-semibold">{formatNumber(item.conversions)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Gasto</span>
                        <div className="font-semibold">{formatCurrency(item.spend)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Receita</span>
                        <div className="font-semibold">{formatCurrency(item.revenue)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">CTR</span>
                        <div className="font-semibold">{item.ctr.toFixed(2)}%</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Conv. Rate</span>
                        <div className="font-semibold">{item.conversion_rate.toFixed(2)}%</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">ROAS</span>
                        <div className="font-semibold">{item.roas.toFixed(2)}x</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Criar Template */}
      {showCreateTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Criar Template UTM</CardTitle>
              <CardDescription>
                Salve configurações UTM para reutilização
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="template_name">Nome do Template *</Label>
                  <Input
                    id="template_name"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({
                      ...newTemplate,
                      name: e.target.value
                    })}
                  />
                </div>

                <div>
                  <Label htmlFor="template_base_url">URL Base *</Label>
                  <Input
                    id="template_base_url"
                    value={newTemplate.base_url}
                    onChange={(e) => setNewTemplate({
                      ...newTemplate,
                      base_url: e.target.value
                    })}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="template_description">Descrição</Label>
                  <Textarea
                    id="template_description"
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate({
                      ...newTemplate,
                      description: e.target.value
                    })}
                  />
                </div>

                <div>
                  <Label htmlFor="template_source">UTM Source *</Label>
                  <Input
                    id="template_source"
                    value={newTemplate.utm_source}
                    onChange={(e) => setNewTemplate({
                      ...newTemplate,
                      utm_source: e.target.value
                    })}
                  />
                </div>

                <div>
                  <Label htmlFor="template_medium">UTM Medium *</Label>
                  <Input
                    id="template_medium"
                    value={newTemplate.utm_medium}
                    onChange={(e) => setNewTemplate({
                      ...newTemplate,
                      utm_medium: e.target.value
                    })}
                  />
                </div>

                <div>
                  <Label htmlFor="template_campaign">UTM Campaign *</Label>
                  <Input
                    id="template_campaign"
                    value={newTemplate.utm_campaign}
                    onChange={(e) => setNewTemplate({
                      ...newTemplate,
                      utm_campaign: e.target.value
                    })}
                  />
                </div>

                <div>
                  <Label htmlFor="template_term">UTM Term</Label>
                  <Input
                    id="template_term"
                    value={newTemplate.utm_term}
                    onChange={(e) => setNewTemplate({
                      ...newTemplate,
                      utm_term: e.target.value
                    })}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="template_content">UTM Content</Label>
                  <Input
                    id="template_content"
                    value={newTemplate.utm_content}
                    onChange={(e) => setNewTemplate({
                      ...newTemplate,
                      utm_content: e.target.value
                    })}
                  />
                </div>
              </div>

              <div className="flex space-x-2">
                <Button onClick={createTemplate} className="flex-1">
                  Criar Template
                </Button>
                <Button 
                  onClick={() => setShowCreateTemplate(false)} 
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

      {/* Modal de Editar Template */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Editar Template UTM</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nome do Template</Label>
                  <Input
                    value={editingTemplate.name}
                    onChange={(e) => setEditingTemplate({
                      ...editingTemplate,
                      name: e.target.value
                    })}
                  />
                </div>

                <div>
                  <Label>URL Base</Label>
                  <Input
                    value={editingTemplate.base_url}
                    onChange={(e) => setEditingTemplate({
                      ...editingTemplate,
                      base_url: e.target.value
                    })}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={editingTemplate.description}
                    onChange={(e) => setEditingTemplate({
                      ...editingTemplate,
                      description: e.target.value
                    })}
                  />
                </div>

                <div>
                  <Label>UTM Source</Label>
                  <Input
                    value={editingTemplate.utm_source}
                    onChange={(e) => setEditingTemplate({
                      ...editingTemplate,
                      utm_source: e.target.value
                    })}
                  />
                </div>

                <div>
                  <Label>UTM Medium</Label>
                  <Input
                    value={editingTemplate.utm_medium}
                    onChange={(e) => setEditingTemplate({
                      ...editingTemplate,
                      utm_medium: e.target.value
                    })}
                  />
                </div>

                <div>
                  <Label>UTM Campaign</Label>
                  <Input
                    value={editingTemplate.utm_campaign}
                    onChange={(e) => setEditingTemplate({
                      ...editingTemplate,
                      utm_campaign: e.target.value
                    })}
                  />
                </div>

                <div>
                  <Label>UTM Term</Label>
                  <Input
                    value={editingTemplate.utm_term || ''}
                    onChange={(e) => setEditingTemplate({
                      ...editingTemplate,
                      utm_term: e.target.value
                    })}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label>UTM Content</Label>
                  <Input
                    value={editingTemplate.utm_content || ''}
                    onChange={(e) => setEditingTemplate({
                      ...editingTemplate,
                      utm_content: e.target.value
                    })}
                  />
                </div>
              </div>

              <div className="flex space-x-2">
                <Button onClick={updateTemplate} className="flex-1">
                  Salvar Alterações
                </Button>
                <Button 
                  onClick={() => setEditingTemplate(null)} 
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