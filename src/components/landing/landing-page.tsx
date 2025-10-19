'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  BarChart3, 
  Target, 
  Users, 
  TrendingUp, 
  Shield, 
  Zap,
  CheckCircle2,
  ArrowRight,
  Facebook,
  Instagram,
  Smartphone,
  Globe,
  LineChart,
  Settings
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'

export function LandingPage() {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    lead_type: '',
    message: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/landing/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) throw new Error('Erro ao enviar formulário')

      toast({
        title: 'Mensagem enviada com sucesso!',
        description: 'Entraremos em contato em breve.',
      })

      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        lead_type: '',
        message: ''
      })
    } catch (error) {
      toast({
        title: 'Erro ao enviar',
        description: 'Tente novamente mais tarde.',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-slate-900">Ads Manager Pro</span>
          </div>
          <Link href="/dashboard">
            <Button variant="outline">Acessar Sistema</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <Badge className="mb-4" variant="secondary">
          Plataforma Completa de Gestão de Campanhas
        </Badge>
        <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
          Gerencie Múltiplos Clientes
          <br />
          <span className="text-blue-600">Em Uma Única Plataforma</span>
        </h1>
        <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
          Sistema profissional para agências e gestores de tráfego gerenciarem campanhas do Meta Ads, 
          Google Ads e WhatsApp Business com total isolamento de dados entre clientes.
        </p>
        <div className="flex gap-4 justify-center">
          <Button size="lg" className="gap-2" asChild>
            <a href="#contato">
              Falar com Especialista <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#recursos">Ver Recursos</a>
          </Button>
        </div>
      </section>

      {/* Features Grid */}
      <section id="recursos" className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Recursos Principais</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <Card>
            <CardContent className="pt-6">
              <Users className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Gestão Multi-Cliente</h3>
              <p className="text-slate-600">
                Gerencie múltiplos clientes com isolamento completo de dados. 
                Cada cliente tem seu próprio ambiente seguro.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Facebook className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Integração Meta Ads</h3>
              <p className="text-slate-600">
                Conexão direta com Facebook e Instagram Ads. 
                Sincronização automática de campanhas e métricas em tempo real.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <LineChart className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Analytics Avançado</h3>
              <p className="text-slate-600">
                Dashboards personalizáveis com métricas em tempo real, 
                relatórios executivos e insights preditivos.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Shield className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Segurança Avançada</h3>
              <p className="text-slate-600">
                Row Level Security (RLS) no banco de dados garante 
                isolamento total entre dados de diferentes clientes.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Zap className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Automações Inteligentes</h3>
              <p className="text-slate-600">
                Workflows automatizados, alertas personalizados e 
                sincronização automática de campanhas.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Target className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Objetivos Inteligentes</h3>
              <p className="text-slate-600">
                Defina metas por campanha e receba alertas automáticos 
                quando métricas saírem do esperado.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Integrations */}
      <section className="bg-slate-50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Integrações Disponíveis</h2>
          <div className="grid md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="bg-white rounded-lg p-6 shadow-sm mb-3">
                <Facebook className="h-12 w-12 text-blue-600 mx-auto" />
              </div>
              <p className="font-semibold">Facebook Ads</p>
            </div>
            <div className="text-center">
              <div className="bg-white rounded-lg p-6 shadow-sm mb-3">
                <Instagram className="h-12 w-12 text-pink-600 mx-auto" />
              </div>
              <p className="font-semibold">Instagram Ads</p>
            </div>
            <div className="text-center">
              <div className="bg-white rounded-lg p-6 shadow-sm mb-3">
                <Globe className="h-12 w-12 text-green-600 mx-auto" />
              </div>
              <p className="font-semibold">Google Ads</p>
            </div>
            <div className="text-center">
              <div className="bg-white rounded-lg p-6 shadow-sm mb-3">
                <Smartphone className="h-12 w-12 text-emerald-600 mx-auto" />
              </div>
              <p className="font-semibold">WhatsApp Business</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Por Que Escolher Nossa Plataforma?</h2>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {[
            'Isolamento completo de dados entre clientes',
            'Interface intuitiva e moderna',
            'Relatórios executivos automatizados',
            'Métricas personalizadas por cliente',
            'Sincronização em tempo real',
            'Suporte técnico especializado',
            'Dashboards personalizáveis',
            'Alertas e notificações inteligentes'
          ].map((benefit, i) => (
            <div key={i} className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-lg text-slate-700">{benefit}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Target Audience */}
      <section className="bg-blue-50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Ideal Para</h2>
          <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <Card>
              <CardContent className="pt-6 text-center">
                <Users className="h-10 w-10 text-blue-600 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Agências de Marketing</h3>
                <p className="text-sm text-slate-600">Gerencie múltiplos clientes com eficiência</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <TrendingUp className="h-10 w-10 text-blue-600 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Gestores de Tráfego</h3>
                <p className="text-sm text-slate-600">Otimize campanhas em uma única plataforma</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Settings className="h-10 w-10 text-blue-600 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Empresas</h3>
                <p className="text-sm text-slate-600">Gerencie campanhas de múltiplas marcas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Instagram className="h-10 w-10 text-blue-600 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Social Media</h3>
                <p className="text-sm text-slate-600">Acompanhe resultados de forma profissional</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section id="contato" className="container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">Entre em Contato</h2>
            <p className="text-slate-600">
              Preencha o formulário e nossa equipe entrará em contato para apresentar a plataforma
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Nome Completo *</label>
                  <Input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Seu nome"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Email *</label>
                  <Input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="seu@email.com"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Telefone</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Empresa</label>
                  <Input
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Nome da empresa"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Você é *</label>
                  <Select
                    required
                    value={formData.lead_type}
                    onValueChange={(value: string) => setFormData({ ...formData, lead_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma opção" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agency">Agência de Marketing</SelectItem>
                      <SelectItem value="company">Empresa</SelectItem>
                      <SelectItem value="traffic_manager">Gestor de Tráfego</SelectItem>
                      <SelectItem value="social_media">Social Media</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Mensagem</label>
                  <Textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Conte-nos mais sobre suas necessidades..."
                    rows={4}
                  />
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? 'Enviando...' : 'Enviar Mensagem'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <BarChart3 className="h-8 w-8" />
            <span className="text-2xl font-bold">Ads Manager Pro</span>
          </div>
          <p className="text-slate-400 mb-4">
            Plataforma profissional de gestão de campanhas para agências e gestores de tráfego
          </p>
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} Ads Manager Pro. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
