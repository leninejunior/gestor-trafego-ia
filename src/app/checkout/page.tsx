'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Loader2, ArrowLeft } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'

interface Plan {
  id: string
  name: string
  description: string
  monthly_price: number
  annual_price: number
  features: any
  max_clients: number
  max_campaigns: number
}

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization_name: '',
    cpf_cnpj: '',
    phone: '',
  })

  const planId = searchParams.get('plan')

  useEffect(() => {
    if (planId) {
      loadPlan(planId)
    } else {
      router.push('/')
    }
  }, [planId])

  const loadPlan = async (id: string) => {
    try {
      const response = await fetch('/api/subscriptions/plans')
      const data = await response.json()
      
      // A API retorna { success: true, data: [...] }
      const plans = data.data || data.plans || []
      const selectedPlan = plans.find((p: Plan) => p.id === id)
      
      if (selectedPlan) {
        setPlan(selectedPlan)
      } else {
        toast({
          title: 'Plano não encontrado',
          description: 'Redirecionando...',
          variant: 'destructive'
        })
        router.push('/')
      }
    } catch (error) {
      toast({
        title: 'Erro ao carregar plano',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setProcessing(true)

    try {
      // Criar checkout no Iugu (sem criar conta ainda)
      const checkoutResponse = await fetch('/api/subscriptions/checkout-iugu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: planId,
          billing_cycle: billingCycle,
          user_email: formData.email,
          user_name: formData.name,
          organization_name: formData.organization_name,
          cpf_cnpj: formData.cpf_cnpj,
          phone: formData.phone,
        })
      })

      if (!checkoutResponse.ok) {
        const checkoutError = await checkoutResponse.json()
        console.error('Checkout error details:', checkoutError)
        throw new Error(checkoutError.details || checkoutError.error || 'Erro ao criar checkout')
      }

      const { data } = await checkoutResponse.json()

      // Redirecionar para página de pagamento do Iugu
      window.location.href = data.checkout_url

    } catch (error) {
      console.error('Checkout error:', error)
      toast({
        title: 'Erro no checkout',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive'
      })
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!plan) {
    return null
  }

  const price = billingCycle === 'annual' ? plan.annual_price : plan.monthly_price
  const features = plan.features || {}

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-8">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Formulário */}
          <div>
            <h1 className="text-3xl font-bold mb-2">Criar Conta</h1>
            <p className="text-slate-600 mb-6">
              Preencha seus dados para começar
            </p>

            <Card>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">
                      Nome Completo *
                    </label>
                    <Input
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Seu nome"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1.5 block">
                      Email *
                    </label>
                    <Input
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="seu@email.com"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1.5 block">
                      Nome da Empresa/Agência *
                    </label>
                    <Input
                      required
                      value={formData.organization_name}
                      onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                      placeholder="Nome da sua empresa"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1.5 block">
                      CPF/CNPJ
                    </label>
                    <Input
                      value={formData.cpf_cnpj}
                      onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                      placeholder="000.000.000-00"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1.5 block">
                      Telefone
                    </label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(00) 00000-0000"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    size="lg"
                    disabled={processing}
                  >
                    {processing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      'Continuar para Pagamento'
                    )}
                  </Button>

                  <p className="text-xs text-slate-500 text-center">
                    Ao continuar, você concorda com nossos Termos de Serviço e Política de Privacidade
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Resumo do Plano */}
          <div>
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle>Resumo do Pedido</CardTitle>
                <CardDescription>Plano selecionado</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold">{plan.name}</h3>
                      <p className="text-sm text-slate-600">{plan.description}</p>
                    </div>
                    {plan.name === 'Pro' && (
                      <Badge className="bg-blue-600">Popular</Badge>
                    )}
                  </div>

                  {/* Seletor de ciclo */}
                  <div className="flex gap-2 mb-4">
                    <Button
                      type="button"
                      variant={billingCycle === 'monthly' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setBillingCycle('monthly')}
                    >
                      Mensal
                    </Button>
                    <Button
                      type="button"
                      variant={billingCycle === 'annual' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setBillingCycle('annual')}
                    >
                      Anual
                      <Badge variant="secondary" className="ml-2">-17%</Badge>
                    </Button>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4 mb-4">
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-slate-600">Valor</span>
                      <div className="text-right">
                        <span className="text-2xl font-bold">R$ {price.toFixed(2)}</span>
                        <span className="text-slate-600">
                          /{billingCycle === 'monthly' ? 'mês' : 'ano'}
                        </span>
                      </div>
                    </div>
                    {billingCycle === 'annual' && (
                      <p className="text-sm text-green-600">
                        Economize R$ {(plan.monthly_price * 12 - plan.annual_price).toFixed(2)} por ano
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="font-semibold text-sm">Recursos inclusos:</p>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span>
                          {plan.max_clients === -1 ? 'Clientes ilimitados' : `Até ${plan.max_clients} clientes`}
                        </span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span>
                          {plan.max_campaigns === -1 ? 'Campanhas ilimitadas' : `Até ${plan.max_campaigns} campanhas`}
                        </span>
                      </li>
                      {features.advancedAnalytics && (
                        <li className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Analytics avançado</span>
                        </li>
                      )}
                      {features.customReports && (
                        <li className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Relatórios personalizados</span>
                        </li>
                      )}
                      {features.apiAccess && (
                        <li className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Acesso à API</span>
                        </li>
                      )}
                      {features.whiteLabel && (
                        <li className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>White label</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <p className="font-semibold text-blue-900 mb-1">
                      🚀 Comece Agora
                    </p>
                    <p className="text-sm text-blue-700">
                      Acesso imediato a todos os recursos do plano
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  )
}
