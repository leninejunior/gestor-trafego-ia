import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidade | Ads Manager',
  description: 'Política de privacidade do sistema de gerenciamento de campanhas publicitárias',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Política de Privacidade
          </h1>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-600 mb-6">
              <strong>Última atualização:</strong> {new Date().toLocaleDateString('pt-BR')}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                1. Informações Gerais
              </h2>
              <p className="text-gray-700 mb-4">
                Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos 
                suas informações pessoais quando você utiliza nosso sistema de gerenciamento de campanhas 
                publicitárias ("Ads Manager").
              </p>
              <p className="text-gray-700">
                Ao utilizar nossos serviços, você concorda com as práticas descritas nesta política.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                2. Informações que Coletamos
              </h2>
              
              <h3 className="text-xl font-medium text-gray-800 mb-3">
                2.1 Informações de Conta
              </h3>
              <ul className="list-disc pl-6 text-gray-700 mb-4">
                <li>Nome completo e informações de contato</li>
                <li>Endereço de e-mail</li>
                <li>Informações de autenticação (senhas criptografadas)</li>
                <li>Preferências de conta e configurações</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 mb-3">
                2.2 Dados de Integração com Plataformas
              </h3>
              <ul className="list-disc pl-6 text-gray-700 mb-4">
                <li><strong>Google Ads:</strong> Tokens de acesso, IDs de contas publicitárias, dados de campanhas</li>
                <li><strong>Meta Ads (Facebook):</strong> Tokens de acesso, IDs de contas comerciais, métricas de anúncios</li>
                <li>Dados de performance e métricas das campanhas</li>
                <li>Configurações de contas publicitárias</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 mb-3">
                2.3 Dados de Uso
              </h3>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Logs de acesso e atividade no sistema</li>
                <li>Informações sobre como você usa nossos recursos</li>
                <li>Dados de performance do sistema</li>
                <li>Endereços IP e informações do dispositivo</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                3. Como Usamos suas Informações
              </h2>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Fornecer e manter nossos serviços de gerenciamento de campanhas</li>
                <li>Sincronizar dados entre plataformas publicitárias (Google Ads, Meta Ads)</li>
                <li>Gerar relatórios e análises de performance</li>
                <li>Melhorar nossos serviços e desenvolver novos recursos</li>
                <li>Comunicar sobre atualizações do sistema e suporte técnico</li>
                <li>Garantir a segurança e prevenir fraudes</li>
                <li>Cumprir obrigações legais e regulamentares</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                4. Integração com Plataformas de Terceiros
              </h2>
              
              <h3 className="text-xl font-medium text-gray-800 mb-3">
                4.1 Google Ads
              </h3>
              <p className="text-gray-700 mb-4">
                Nossa integração com o Google Ads utiliza OAuth 2.0 para acessar suas contas publicitárias. 
                Coletamos apenas os dados necessários para:
              </p>
              <ul className="list-disc pl-6 text-gray-700 mb-4">
                <li>Visualizar e gerenciar campanhas</li>
                <li>Obter métricas de performance</li>
                <li>Sincronizar dados de contas (incluindo contas MCC)</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 mb-3">
                4.2 Meta Ads (Facebook)
              </h3>
              <p className="text-gray-700 mb-4">
                Nossa integração com Meta Ads acessa suas contas comerciais para:
              </p>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Gerenciar campanhas publicitárias</li>
                <li>Coletar dados de performance</li>
                <li>Sincronizar informações de contas de anúncios</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                5. Compartilhamento de Informações
              </h2>
              <p className="text-gray-700 mb-4">
                Não vendemos, alugamos ou compartilhamos suas informações pessoais com terceiros, 
                exceto nas seguintes situações:
              </p>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Com seu consentimento explícito</li>
                <li>Para cumprir obrigações legais</li>
                <li>Para proteger nossos direitos e segurança</li>
                <li>Com provedores de serviços que nos auxiliam (sob acordos de confidencialidade)</li>
                <li>Em caso de fusão, aquisição ou venda de ativos</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                6. Segurança dos Dados
              </h2>
              <p className="text-gray-700 mb-4">
                Implementamos medidas de segurança técnicas e organizacionais para proteger suas informações:
              </p>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Criptografia de dados em trânsito e em repouso</li>
                <li>Controles de acesso baseados em funções (RBAC)</li>
                <li>Monitoramento contínuo de segurança</li>
                <li>Backups regulares e seguros</li>
                <li>Auditorias de segurança periódicas</li>
                <li>Tokens de acesso com escopo limitado</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                7. Retenção de Dados
              </h2>
              <p className="text-gray-700 mb-4">
                Mantemos suas informações pelo tempo necessário para:
              </p>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Fornecer nossos serviços</li>
                <li>Cumprir obrigações legais</li>
                <li>Resolver disputas</li>
                <li>Fazer cumprir nossos acordos</li>
              </ul>
              <p className="text-gray-700">
                Você pode solicitar a exclusão de seus dados a qualquer momento, sujeito às obrigações legais.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                8. Seus Direitos
              </h2>
              <p className="text-gray-700 mb-4">
                Você tem os seguintes direitos em relação aos seus dados pessoais:
              </p>
              <ul className="list-disc pl-6 text-gray-700">
                <li><strong>Acesso:</strong> Solicitar cópias de seus dados pessoais</li>
                <li><strong>Retificação:</strong> Corrigir dados imprecisos ou incompletos</li>
                <li><strong>Exclusão:</strong> Solicitar a remoção de seus dados</li>
                <li><strong>Portabilidade:</strong> Receber seus dados em formato estruturado</li>
                <li><strong>Oposição:</strong> Opor-se ao processamento de seus dados</li>
                <li><strong>Limitação:</strong> Restringir o processamento de seus dados</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                9. Cookies e Tecnologias Similares
              </h2>
              <p className="text-gray-700 mb-4">
                Utilizamos cookies e tecnologias similares para:
              </p>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Manter você conectado ao sistema</li>
                <li>Lembrar suas preferências</li>
                <li>Analisar o uso do sistema</li>
                <li>Melhorar a experiência do usuário</li>
              </ul>
              <p className="text-gray-700">
                Você pode gerenciar suas preferências de cookies nas configurações do seu navegador.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                10. Transferências Internacionais
              </h2>
              <p className="text-gray-700">
                Seus dados podem ser processados em servidores localizados fora do seu país de residência. 
                Garantimos que todas as transferências sejam realizadas com salvaguardas adequadas para 
                proteger seus dados pessoais.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                11. Menores de Idade
              </h2>
              <p className="text-gray-700">
                Nossos serviços não são direcionados a menores de 18 anos. Não coletamos intencionalmente 
                informações pessoais de menores de idade.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                12. Alterações nesta Política
              </h2>
              <p className="text-gray-700">
                Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos sobre 
                mudanças significativas por e-mail ou através de aviso em nosso sistema. 
                O uso continuado dos serviços após as alterações constitui aceitação da nova política.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                13. Contato
              </h2>
              <p className="text-gray-700 mb-4">
                Para questões sobre esta Política de Privacidade ou seus dados pessoais, entre em contato:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700">
                  <strong>E-mail:</strong> privacy@adsmanager.com<br />
                  <strong>Endereço:</strong> [Seu endereço comercial]<br />
                  <strong>Telefone:</strong> [Seu telefone de contato]
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                14. Conformidade Legal
              </h2>
              <p className="text-gray-700">
                Esta política está em conformidade com:
              </p>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Lei Geral de Proteção de Dados (LGPD) - Brasil</li>
                <li>Regulamento Geral sobre a Proteção de Dados (GDPR) - União Europeia</li>
                <li>California Consumer Privacy Act (CCPA) - Estados Unidos</li>
                <li>Outras leis de proteção de dados aplicáveis</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}