import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Termos de Uso | Ads Manager',
  description: 'Termos de uso do sistema de gerenciamento de campanhas publicitárias',
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Termos de Uso
          </h1>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-600 mb-6">
              <strong>Última atualização:</strong> {new Date().toLocaleDateString('pt-BR')}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                1. Aceitação dos Termos
              </h2>
              <p className="text-gray-700">
                Ao acessar e usar o Ads Manager, você concorda em cumprir estes Termos de Uso. 
                Se você não concorda com qualquer parte destes termos, não deve usar nossos serviços.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                2. Descrição do Serviço
              </h2>
              <p className="text-gray-700 mb-4">
                O Ads Manager é uma plataforma SaaS que oferece:
              </p>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Gerenciamento de campanhas publicitárias</li>
                <li>Integração com Google Ads e Meta Ads (Facebook)</li>
                <li>Análises e relatórios de performance</li>
                <li>Gestão multi-cliente para agências</li>
                <li>Ferramentas de otimização de campanhas</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                3. Conta de Usuário
              </h2>
              <p className="text-gray-700 mb-4">
                Para usar nossos serviços, você deve:
              </p>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Criar uma conta com informações precisas e atualizadas</li>
                <li>Manter a confidencialidade de suas credenciais</li>
                <li>Ser responsável por todas as atividades em sua conta</li>
                <li>Notificar-nos imediatamente sobre uso não autorizado</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                4. Uso Aceitável
              </h2>
              <p className="text-gray-700 mb-4">
                Você concorda em NÃO:
              </p>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Usar o serviço para atividades ilegais ou não autorizadas</li>
                <li>Tentar acessar contas ou dados de outros usuários</li>
                <li>Interferir no funcionamento do sistema</li>
                <li>Fazer engenharia reversa do software</li>
                <li>Usar o serviço para spam ou atividades maliciosas</li>
                <li>Violar direitos de propriedade intelectual</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                5. Integrações com Terceiros
              </h2>
              
              <h3 className="text-xl font-medium text-gray-800 mb-3">
                5.1 Google Ads
              </h3>
              <p className="text-gray-700 mb-4">
                Ao conectar sua conta Google Ads, você autoriza nosso sistema a:
              </p>
              <ul className="list-disc pl-6 text-gray-700 mb-4">
                <li>Acessar dados de suas campanhas publicitárias</li>
                <li>Gerenciar campanhas em seu nome</li>
                <li>Coletar métricas de performance</li>
                <li>Sincronizar dados entre contas (incluindo MCC)</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 mb-3">
                5.2 Meta Ads (Facebook)
              </h3>
              <p className="text-gray-700 mb-4">
                Ao conectar sua conta Meta Ads, você autoriza nosso sistema a:
              </p>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Acessar suas contas comerciais do Facebook</li>
                <li>Gerenciar campanhas publicitárias</li>
                <li>Coletar dados de performance dos anúncios</li>
                <li>Sincronizar informações entre contas</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                6. Planos e Pagamentos
              </h2>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Os planos de assinatura são cobrados antecipadamente</li>
                <li>Cancelamentos podem ser feitos a qualquer momento</li>
                <li>Reembolsos seguem nossa política específica</li>
                <li>Preços podem ser alterados com aviso prévio de 30 dias</li>
                <li>Uso excessivo pode resultar em cobrança adicional</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                7. Propriedade Intelectual
              </h2>
              <p className="text-gray-700">
                O Ads Manager e todo seu conteúdo são protegidos por direitos autorais e outras 
                leis de propriedade intelectual. Você recebe uma licença limitada para usar 
                o serviço conforme estes termos.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                8. Limitação de Responsabilidade
              </h2>
              <p className="text-gray-700">
                O serviço é fornecido "como está". Não garantimos que será ininterrupto ou livre de erros. 
                Nossa responsabilidade é limitada ao valor pago pelos serviços nos últimos 12 meses.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                9. Suspensão e Encerramento
              </h2>
              <p className="text-gray-700 mb-4">
                Podemos suspender ou encerrar sua conta se:
              </p>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Você violar estes termos</li>
                <li>Houver atividade suspeita ou fraudulenta</li>
                <li>Não pagar as taxas devidas</li>
                <li>Por razões legais ou regulamentares</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                10. Alterações nos Termos
              </h2>
              <p className="text-gray-700">
                Reservamos o direito de modificar estes termos a qualquer momento. 
                Alterações significativas serão comunicadas com 30 dias de antecedência. 
                O uso continuado após as alterações constitui aceitação dos novos termos.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                11. Lei Aplicável
              </h2>
              <p className="text-gray-700">
                Estes termos são regidos pelas leis brasileiras. Disputas serão resolvidas 
                nos tribunais competentes do Brasil.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                12. Contato
              </h2>
              <p className="text-gray-700 mb-4">
                Para questões sobre estes Termos de Uso, entre em contato:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700">
                  <strong>E-mail:</strong> legal@adsmanager.com<br />
                  <strong>Endereço:</strong> [Seu endereço comercial]<br />
                  <strong>Telefone:</strong> [Seu telefone de contato]
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}