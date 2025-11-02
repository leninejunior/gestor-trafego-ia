# FAQ - Google Ads Integration

## Perguntas Frequentes sobre a Integração Google Ads

### 🔗 Conexão e Configuração

#### P: Como faço para conectar minha conta Google Ads?
**R:** Siga estes passos:
1. Acesse o menu "Google Ads" no sistema
2. Clique em "Conectar Google Ads"
3. Autorize o acesso na página do Google
4. Selecione as contas que deseja conectar
5. Aguarde a sincronização inicial

Para mais detalhes, consulte o [Guia de Conexão](GOOGLE_ADS_CONNECTION_GUIDE.md).

#### P: Posso conectar múltiplas contas Google Ads?
**R:** Sim! Você pode conectar várias contas Google Ads ao sistema. O número de contas permitidas depende do seu plano:
- **Básico**: Até 5 contas
- **Pro**: Até 20 contas  
- **Enterprise**: Ilimitado

#### P: Preciso de permissões especiais na conta Google Ads?
**R:** Sim, você precisa ter pelo menos permissões de **Administrador** ou **Editor** na conta Google Ads para conectá-la ao sistema. Usuários com permissão apenas de "Visualização" não conseguem autorizar a integração.

#### P: O que acontece se eu perder acesso à conta Google Ads?
**R:** Se você perder acesso à conta Google Ads:
- Os dados históricos permanecerão no sistema
- A sincronização será interrompida
- Você verá um indicador de "Conexão Perdida"
- Será necessário reconectar quando recuperar o acesso

### 📊 Dados e Sincronização

#### P: Com que frequência os dados são atualizados?
**R:** A sincronização automática ocorre:
- **A cada 6 horas** para contas ativas
- **Diariamente** para contas com baixo volume
- **Manualmente** quando você clica em "Sincronizar"

#### P: Por que meus dados estão diferentes do Google Ads?
**R:** Diferenças podem ocorrer por:
- **Fuso horário**: Verifique se ambos estão no mesmo fuso
- **Período de análise**: Confirme se está comparando os mesmos períodos
- **Filtros aplicados**: Verifique se há filtros ativos no sistema
- **Delay de sincronização**: Dados podem levar até 6 horas para atualizar

#### P: Quanto tempo de histórico fica disponível?
**R:** Depende do seu plano:
- **Básico**: 30 dias de histórico
- **Pro**: 90 dias de histórico
- **Enterprise**: 365 dias de histórico

#### P: Posso forçar uma sincronização imediata?
**R:** Sim! Clique no botão "Sincronizar" no dashboard Google Ads. O processo leva entre 1-5 minutos dependendo do número de campanhas.

### 🎯 Campanhas e Métricas

#### P: Por que algumas campanhas não aparecem na lista?
**R:** Campanhas podem não aparecer se:
- Foram criadas após a última sincronização
- Estão pausadas ou removidas (verifique filtros)
- Você não tem permissão para visualizá-las
- Há problemas na conexão com a conta

#### P: O que significam as métricas exibidas?
**R:** Principais métricas:
- **Impressões**: Quantas vezes seus anúncios foram exibidos
- **Cliques**: Número de cliques nos anúncios
- **CTR**: Taxa de cliques (Cliques ÷ Impressões × 100)
- **Conversões**: Ações desejadas completadas pelos usuários
- **CPA**: Custo por aquisição (Gasto ÷ Conversões)
- **ROAS**: Retorno sobre investimento (Receita ÷ Gasto)

#### P: Como interpretar o indicador de performance?
**R:** Os indicadores coloridos mostram:
- 🟢 **Verde**: Performance acima da média/meta
- 🟡 **Amarelo**: Performance dentro da normalidade
- 🔴 **Vermelho**: Performance abaixo do esperado

### 🔧 Problemas Técnicos

#### P: Recebo erro "Token expirado" - o que fazer?
**R:** Este erro indica que a autorização precisa ser renovada:
1. Clique em "Reconectar" no dashboard
2. Siga novamente o processo de autorização
3. Seus dados históricos serão preservados

#### P: O dashboard não carrega - como resolver?
**R:** Tente estas soluções em ordem:
1. Recarregue a página (F5)
2. Limpe o cache do navegador
3. Tente em uma aba anônima/privada
4. Use um navegador diferente
5. Verifique sua conexão com internet

#### P: Erro "Permissão negada" - o que significa?
**R:** Este erro indica problemas de autorização:
- Verifique se ainda tem acesso à conta Google Ads
- Confirme se a conta não foi suspensa
- Reconecte a conta seguindo o processo de autorização

#### P: A sincronização está muito lenta - é normal?
**R:** Tempos normais de sincronização:
- **Contas pequenas** (até 10 campanhas): 1-2 minutos
- **Contas médias** (10-50 campanhas): 2-5 minutos
- **Contas grandes** (50+ campanhas): 5-15 minutos

Se demorar mais que isso, entre em contato com o suporte.

### 📈 Dashboard e Relatórios

#### P: Como alterar o período de análise?
**R:** Use o seletor de período no topo do dashboard:
1. Clique no campo de data
2. Escolha um período pré-definido ou personalizado
3. Clique em "Aplicar"

#### P: Posso comparar diferentes períodos?
**R:** Sim! Marque a opção "Comparar com período anterior" no seletor de período. Os dados serão exibidos lado a lado com indicadores de variação.

#### P: Como exportar os dados?
**R:** Para exportar:
1. Clique no botão "Exportar" no dashboard
2. Escolha o formato (CSV, Excel, PDF)
3. Configure as opções desejadas
4. Clique em "Gerar Relatório"

#### P: Posso personalizar as colunas da tabela?
**R:** Sim! Clique no ícone de configurações (⚙️) na tabela de campanhas para:
- Mostrar/ocultar colunas
- Reordenar colunas
- Definir colunas padrão

### 🔐 Segurança e Privacidade

#### P: Meus dados estão seguros?
**R:** Sim! Implementamos várias camadas de segurança:
- Criptografia de todos os tokens de acesso
- Isolamento completo entre diferentes clientes
- Logs de auditoria de todas as operações
- Acesso limitado apenas aos dados necessários

#### P: Vocês armazenam minhas senhas?
**R:** Não! Nunca armazenamos senhas. Usamos o sistema OAuth 2.0 do Google, que é o padrão de segurança da indústria. Apenas tokens de acesso criptografados são armazenados.

#### P: Como revogar o acesso se necessário?
**R:** Você pode revogar o acesso de duas formas:
1. **Pelo sistema**: Configurações > Integrações > Desconectar
2. **Pelo Google**: myaccount.google.com > Segurança > Aplicativos conectados

#### P: Outros usuários podem ver meus dados?
**R:** Não! Cada cliente tem isolamento completo de dados. Apenas usuários autorizados da sua organização podem acessar seus dados Google Ads.

### 💰 Planos e Limites

#### P: Quais são os limites do meu plano?
**R:** Limites por plano:

| Recurso | Básico | Pro | Enterprise |
|---------|--------|-----|------------|
| Contas Google Ads | 5 | 20 | Ilimitado |
| Histórico | 30 dias | 90 dias | 365 dias |
| Sincronização | 12h | 6h | 2h |
| Exportações/hora | 2 | 10 | Ilimitado |
| Suporte | Email | Chat + Email | Dedicado |

#### P: Posso fazer upgrade do meu plano?
**R:** Sim! Acesse Configurações > Plano para ver opções de upgrade. O upgrade é imediato e você mantém todos os dados existentes.

#### P: O que acontece se eu exceder os limites?
**R:** Se você exceder os limites:
- **Contas**: Não será possível conectar novas contas
- **Histórico**: Dados mais antigos serão removidos automaticamente
- **Exportações**: Você receberá uma mensagem de limite atingido

### 🔄 Integração com Meta Ads

#### P: Posso usar Google Ads e Meta Ads juntos?
**R:** Sim! O sistema foi projetado para trabalhar com ambas as plataformas simultaneamente. Você terá:
- Dashboard unificado com dados consolidados
- Comparação entre plataformas
- Relatórios combinados

#### P: Os dados das duas plataformas são misturados?
**R:** Não! Os dados são mantidos separados, mas você pode visualizá-los:
- **Separadamente**: Dashboards específicos para cada plataforma
- **Consolidados**: Dashboard principal com visão unificada
- **Comparativos**: Análises lado a lado

### 🆘 Suporte e Ajuda

#### P: Como entrar em contato com o suporte?
**R:** Várias opções de suporte:
- **Chat online**: Disponível 24/7 (planos Pro e Enterprise)
- **Email**: suporte@seudominio.com
- **Telefone**: (11) 1234-5678 (horário comercial)
- **Central de ajuda**: Acesse pelo menu "?" no sistema

#### P: Que informações devo fornecer ao suporte?
**R:** Para agilizar o atendimento, tenha em mãos:
- ID do seu cliente no sistema
- Descrição detalhada do problema
- Screenshots se aplicável
- Horário quando o problema ocorreu
- Navegador e versão utilizados

#### P: Vocês oferecem treinamento?
**R:** Sim! Oferecemos:
- **Documentação completa**: Guias detalhados
- **Vídeos tutoriais**: Passo a passo visual
- **Webinars**: Sessões ao vivo mensais
- **Treinamento personalizado**: Para planos Enterprise

### 🚀 Funcionalidades Futuras

#### P: Que novidades estão planejadas?
**R:** Próximas funcionalidades incluem:
- Automação de campanhas baseada em IA
- Relatórios preditivos
- Integração com mais plataformas (LinkedIn, TikTok)
- API pública para integrações customizadas

#### P: Como fico sabendo das atualizações?
**R:** Mantenha-se informado através de:
- **Notificações no sistema**: Avisos sobre novas funcionalidades
- **Newsletter mensal**: Atualizações e dicas por email
- **Blog**: Artigos sobre melhores práticas
- **Changelog**: Histórico detalhado de atualizações

### 📱 Acesso Mobile

#### P: Posso acessar pelo celular?
**R:** Sim! O sistema é totalmente responsivo e funciona perfeitamente em:
- Smartphones (iOS e Android)
- Tablets
- Navegadores mobile

#### P: Existe um aplicativo móvel?
**R:** Atualmente não temos um app nativo, mas estamos desenvolvendo um. O acesso via navegador mobile oferece todas as funcionalidades da versão desktop.

### 🔍 Troubleshooting Rápido

#### P: Checklist rápido para problemas comuns?
**R:** Antes de entrar em contato com suporte, verifique:

✅ **Conexão com internet** está funcionando  
✅ **Navegador está atualizado** (Chrome, Firefox, Safari, Edge)  
✅ **Cache foi limpo** recentemente  
✅ **Pop-ups não estão bloqueados** para o site  
✅ **JavaScript está habilitado** no navegador  
✅ **Cookies estão permitidos** para o domínio  
✅ **Extensões do navegador** não estão interferindo  

#### P: Códigos de erro mais comuns?
**R:** Principais códigos e soluções:

| Código | Significado | Solução |
|--------|-------------|---------|
| AUTH_001 | Token expirado | Reconectar conta |
| SYNC_002 | Falha na sincronização | Tentar novamente em 5 min |
| PERM_003 | Sem permissão | Verificar acesso à conta Google Ads |
| RATE_004 | Muitas requisições | Aguardar alguns minutos |
| CONN_005 | Problema de conexão | Verificar internet |

---

## 📞 Ainda Precisa de Ajuda?

Se sua pergunta não foi respondida aqui:

1. **Consulte a documentação completa**:
   - [Guia do Usuário](GOOGLE_ADS_USER_GUIDE.md)
   - [Guia de Conexão](GOOGLE_ADS_CONNECTION_GUIDE.md)
   - [Guia do Dashboard](GOOGLE_ADS_DASHBOARD_GUIDE.md)

2. **Entre em contato conosco**:
   - 💬 Chat online (disponível no sistema)
   - 📧 Email: suporte@seudominio.com
   - 📞 Telefone: (11) 1234-5678

3. **Recursos adicionais**:
   - 🎥 Vídeos tutoriais na central de ajuda
   - 📚 Base de conhecimento completa
   - 🌐 Comunidade de usuários

**Horário de Atendimento:**
- Chat: 24/7 (Pro e Enterprise) | 8h-18h (Básico)
- Email: Resposta em até 24h
- Telefone: Segunda a Sexta, 9h às 18h

---

*Esta FAQ é atualizada regularmente. Última atualização: [Data Atual]*