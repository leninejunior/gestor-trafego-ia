/**
 * Agente de IA para Análise de Campanhas - Admin
 * - Análise inteligente de performance
 * - Recomendações automáticas
 * - Insights preditivos
 * - Chat com IA especializada
 * - Relatórios automatizados
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  Bot, 
  Brain, 
  MessageSquare, 
  Send, 
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Download,
  Settings,
  Zap,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react'

interface ChatMessage {
  id: string
  type: 'user' | 'ai'
  content: string
  timestamp: Date
  metadata?: {
    campaign_id?: string
    analysis_type?: string
    confidence?: number
  }
}

interface AIInsight {
  id: string
  type: 'optimization' | 'warning' | 'opportunity' | 'prediction'
  title: string
  description: string
  impact: 'low' | 'medium' | 'high'
  confidence: number
  campaign_id?: string
  campaign_name?: string
  recommendation: string
  expected_improvement: string
  created_at: string
}

interface AnalysisReport {
  id: string
  title: string
  summary: string
  insights_count: number
  campaigns_analyzed: number
  status: 'generating' | 'completed' | 'failed'
  created_at: string
  completed_at?: string
}

export default function AIAgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [reports, setReports] = useState<AnalysisReport[]>([])
  const [loading, setLoading] = useState(true)
  const [chatLoading, setChatLoading] = useState(false)
  const [currentMessage, setCurrentMessage] = useState('')
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all')
  const [analysisType, setAnalysisType] = useState<string>('general')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadAIData()
    
    // Scroll para o final das mensagens
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadAIData = async () => {
    try {
      setLoading(true)
      
      // Carregar insights da IA
      const insightsResponse = await fetch('/api/admin/ai-agent/insights')
      if (insightsResponse.ok) {
        const insightsData = await insightsResponse.json()
        setInsights(insightsData.insights || [])
      }

      // Carregar relatórios
      const reportsResponse = await fetch('/api/admin/ai-agent/reports')
      if (reportsResponse.ok) {
        const reportsData = await reportsResponse.json()
        setReports(reportsData.reports || [])
      }

      // Carregar histórico de chat
      const chatResponse = await fetch('/api/admin/ai-agent/chat/history')
      if (chatResponse.ok) {
        const chatData = await chatResponse.json()
        setMessages(chatData.messages || [])
      }

    } catch (error) {
      console.error('Error loading AI data:', error)
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!currentMessage.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: currentMessage,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setCurrentMessage('')
    setChatLoading(true)

    try {
      const response = await fetch('/api/admin/ai-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentMessage,
          campaign_id: selectedCampaign !== 'all' ? selectedCampaign : null,
          analysis_type: analysisType,
          context: messages.slice(-5) // Últimas 5 mensagens para contexto
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: data.response,
          timestamp: new Date(),
          metadata: {
            confidence: data.confidence,
            analysis_type: data.analysis_type
          }
        }

        setMessages(prev => [...prev, aiMessage])
      }
    } catch (error) {
      console.error('Error sending message:', error)
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setChatLoading(false)
    }
  }

  const generateReport = async () => {
    try {
      const response = await fetch('/api/admin/ai-agent/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'comprehensive',
          campaign_id: selectedCampaign !== 'all' ? selectedCampaign : null
        })
      })

      if (response.ok) {
        await loadAIData()
      }
    } catch (error) {
      console.error('Error generating report:', error)
    }
  }

  const runAnalysis = async (type: string) => {
    try {
      const response = await fetch('/api/admin/ai-agent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_type: type,
          campaign_id: selectedCampaign !== 'all' ? selectedCampaign : null
        })
      })

      if (response.ok) {
        await loadAIData()
      }
    } catch (error) {
      console.error('Error running analysis:', error)
    }
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'optimization': return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'opportunity': return <Lightbulb className="h-4 w-4 text-blue-600" />
      case 'prediction': return <Brain className="h-4 w-4 text-purple-600" />
      default: return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'optimization': return 'bg-green-100 text-green-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'opportunity': return 'bg-blue-100 text-blue-800'
      case 'prediction': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-600'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-green-600'
      default: return 'text-gray-600'
    }
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
            <Bot className="h-8 w-8 mr-3 text-blue-600" />
            Agente de IA
          </h1>
          <p className="text-muted-foreground">
            Análise inteligente de campanhas com insights automatizados
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={generateReport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Gerar Relatório
          </Button>
          <Button onClick={loadAIData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Controles de Análise */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Configurações de Análise
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Campanha</label>
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as campanhas</SelectItem>
                  <SelectItem value="camp_1">Campanha Black Friday</SelectItem>
                  <SelectItem value="camp_2">Campanha Verão 2024</SelectItem>
                  <SelectItem value="camp_3">Campanha Produtos Novos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Tipo de Análise</label>
              <Select value={analysisType} onValueChange={setAnalysisType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">Análise Geral</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                  <SelectItem value="optimization">Otimização</SelectItem>
                  <SelectItem value="audience">Audiência</SelectItem>
                  <SelectItem value="budget">Orçamento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={() => runAnalysis(analysisType)} className="w-full">
                <Zap className="h-4 w-4 mr-2" />
                Executar Análise
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="chat" className="space-y-4">
        <TabsList>
          <TabsTrigger value="chat">Chat com IA</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="space-y-4">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquare className="h-5 w-5 mr-2" />
                Chat com Especialista em Campanhas
              </CardTitle>
              <CardDescription>
                Faça perguntas sobre suas campanhas e receba insights personalizados
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {/* Área de mensagens */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-4 bg-gray-50 rounded-lg">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <Bot className="h-12 w-12 mx-auto mb-4 text-blue-600" />
                    <p className="text-lg font-medium">Olá! Sou seu assistente de campanhas.</p>
                    <p>Posso ajudar você a analisar performance, otimizar campanhas e identificar oportunidades.</p>
                    <div className="mt-4 space-y-2 text-sm">
                      <p>Exemplos de perguntas:</p>
                      <ul className="space-y-1">
                        <li>• "Como está a performance das minhas campanhas?"</li>
                        <li>• "Quais campanhas devo otimizar?"</li>
                        <li>• "Há oportunidades de melhoria no meu ROAS?"</li>
                      </ul>
                    </div>
                  </div>
                )}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.type === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border shadow-sm'
                      }`}
                    >
                      {message.type === 'ai' && (
                        <div className="flex items-center mb-2">
                          <Bot className="h-4 w-4 mr-2 text-blue-600" />
                          <span className="text-sm font-medium text-blue-600">AI Assistant</span>
                          {message.metadata?.confidence && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {(message.metadata.confidence * 100).toFixed(0)}% confiança
                            </Badge>
                          )}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <div className="text-xs opacity-70 mt-2">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}

                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border shadow-sm p-3 rounded-lg">
                      <div className="flex items-center">
                        <Bot className="h-4 w-4 mr-2 text-blue-600" />
                        <span className="text-sm font-medium text-blue-600">AI Assistant</span>
                      </div>
                      <div className="flex items-center mt-2">
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        <span>Analisando...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input de mensagem */}
              <div className="flex space-x-2">
                <Input
                  placeholder="Digite sua pergunta sobre campanhas..."
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  disabled={chatLoading}
                />
                <Button onClick={sendMessage} disabled={chatLoading || !currentMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Lightbulb className="h-5 w-5 mr-2" />
                Insights Automatizados
              </CardTitle>
              <CardDescription>
                Descobertas e recomendações geradas pela IA
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {insights.map((insight) => (
                  <div key={insight.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        {getInsightIcon(insight.type)}
                        <div>
                          <h3 className="font-semibold">{insight.title}</h3>
                          {insight.campaign_name && (
                            <p className="text-sm text-muted-foreground">
                              Campanha: {insight.campaign_name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getInsightColor(insight.type)}>
                          {insight.type}
                        </Badge>
                        <Badge variant="outline" className={getImpactColor(insight.impact)}>
                          {insight.impact} impact
                        </Badge>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground mb-3">
                      {insight.description}
                    </p>

                    <div className="bg-blue-50 p-3 rounded-lg mb-3">
                      <h4 className="font-medium text-blue-900 mb-1">Recomendação:</h4>
                      <p className="text-sm text-blue-800">{insight.recommendation}</p>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-4">
                        <span className="text-muted-foreground">
                          Confiança: {(insight.confidence * 100).toFixed(0)}%
                        </span>
                        <Progress value={insight.confidence * 100} className="w-20" />
                      </div>
                      <div className="text-green-600 font-medium">
                        {insight.expected_improvement}
                      </div>
                      <div className="text-muted-foreground">
                        {new Date(insight.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}

                {insights.length === 0 && (
                  <div className="text-center py-8">
                    <Brain className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium text-muted-foreground">
                      Nenhum insight disponível
                    </p>
                    <p className="text-muted-foreground">
                      Execute uma análise para gerar insights automatizados
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Relatórios de IA
              </CardTitle>
              <CardDescription>
                Relatórios automatizados com análises detalhadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reports.map((report) => (
                  <div key={report.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">{report.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {report.summary}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          className={
                            report.status === 'completed' ? 'bg-green-100 text-green-800' :
                            report.status === 'generating' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }
                        >
                          {report.status}
                        </Badge>
                        {report.status === 'completed' && (
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Insights:</span>
                        <div className="font-semibold">{report.insights_count}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Campanhas:</span>
                        <div className="font-semibold">{report.campaigns_analyzed}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Criado:</span>
                        <div className="font-semibold">
                          {new Date(report.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Concluído:</span>
                        <div className="font-semibold">
                          {report.completed_at 
                            ? new Date(report.completed_at).toLocaleDateString()
                            : '-'
                          }
                        </div>
                      </div>
                    </div>

                    {report.status === 'generating' && (
                      <div className="mt-3">
                        <Progress value={65} className="w-full" />
                        <p className="text-xs text-muted-foreground mt-1">
                          Gerando relatório... 65% concluído
                        </p>
                      </div>
                    )}
                  </div>
                ))}

                {reports.length === 0 && (
                  <div className="text-center py-8">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium text-muted-foreground">
                      Nenhum relatório disponível
                    </p>
                    <p className="text-muted-foreground">
                      Gere um relatório para ver análises detalhadas
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}