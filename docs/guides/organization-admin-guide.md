# Guia do Admin de Organização

## Introdução

Como Admin de Organização, você tem permissões para gerenciar usuários e clientes dentro da sua organização, respeitando os limites do plano contratado.

## Suas Permissões

### ✅ O que você PODE fazer:

- **Gerenciar Usuários**:
  - Criar novos usuários na sua organização
  - Editar informações de usuários existentes
  - Excluir usuários (com limpeza automática de acessos)
  - Definir roles (admin ou member)

- **Gerenciar Acesso a Clientes**:
  - Conceder acesso de usuários a clientes específicos
  - Revogar acessos existentes
  - Visualizar todos os acessos dos usuários
  - Atribuir múltiplos clientes por usuário

- **Criar Recursos**:
  - Criar novos clientes (dentro do limite do plano)
  - Criar conexões com Meta Ads e Google Ads
  - Gerenciar campanhas dos clientes autorizados

### ❌ O que você NÃO PODE fazer:

- Gerenciar usuários de outras organizações
- Exceder os limites do seu plano de assinatura
- Acessar dados de clientes de outras organizações
- Modificar configurações de super admin

## Como Usar o Sistema

### 1. Gerenciamento de Usuários

#### Criar Novo Usuário

1. Acesse o painel de **Gerenciamento de Usuários**
2. Clique em **"Adicionar Usuário"**
3. Preencha as informações:
   - **Email**: Email do novo usuário
   - **Nome**: Nome completo
   - **Role**: Escolha entre:
     - `admin`: Pode gerenciar outros usuários
     - `member`: Usuário comum com acesso limitado
4. Clique em **"Criar Usuário"**

> **Nota**: O usuário receberá um convite por email para ativar a conta.

#### Editar Usuário Existente

1. Na lista de usuários, clique no ícone de **edição**
2. Modifique as informações necessárias
3. Clique em **"Salvar Alterações"**

#### Excluir Usuário

1. Na lista de usuários, clique no ícone de **exclusão**
2. **Confirme a exclusão** (ação irreversível)
3. O sistema automaticamente:
   - Remove o usuário da organização
   - Revoga todos os acessos a clientes
   - Limpa registros relacionados

### 2. Gerenciamento de Acesso a Clientes

#### Conceder Acesso a Cliente

1. Acesse **"Gerenciar Acessos"**
2. Selecione o **usuário** que receberá acesso
3. Escolha o **cliente** da lista
4. Configure as **permissões**:
   - `read`: Visualizar dados (sempre ativo)
   - `write`: Editar campanhas (opcional)
5. Clique em **"Conceder Acesso"**

#### Revogar Acesso

1. Na lista de acessos do usuário
2. Clique em **"Revogar"** ao lado do cliente
3. Confirme a revogação
4. O acesso é removido **imediatamente**

#### Visualizar Acessos de um Usuário

1. Selecione o usuário na lista
2. Clique em **"Ver Acessos"**
3. Visualize todos os clientes autorizados
4. Veja quando cada acesso foi concedido e por quem

### 3. Limites do Plano

#### Verificar Uso Atual

No dashboard, você verá:

```
Plano Atual: Professional
├── Usuários: 8/15 (53% usado)
├── Clientes: 12/25 (48% usado)
├── Conexões: 5/10 (50% usado)
└── Status: ✅ Dentro do limite
```

#### Quando Atingir o Limite

Se tentar criar recursos além do limite:

- **Mensagem de erro** explicativa
- **Sugestão de upgrade** do plano
- **Contato** para suporte comercial

#### Planos Disponíveis

| Recurso | Básico | Professional | Enterprise |
|---------|--------|--------------|------------|
| Usuários | 5 | 15 | Ilimitado |
| Clientes | 10 | 25 | Ilimitado |
| Conexões | 3 | 10 | Ilimitado |

## Boas Práticas

### Segurança

1. **Princípio do Menor Privilégio**:
   - Conceda acesso apenas aos clientes necessários
   - Use role `member` por padrão
   - Promova a `admin` apenas quando necessário

2. **Revisão Regular**:
   - Revise acessos mensalmente
   - Remova usuários inativos
   - Revogue acessos desnecessários

3. **Documentação**:
   - Mantenha registro de quem tem acesso a quê
   - Documente mudanças importantes
   - Use o campo "notas" para contexto

### Organização

1. **Nomenclatura Consistente**:
   - Use padrões claros para nomes de usuários
   - Organize clientes por categoria/região
   - Mantenha informações atualizadas

2. **Estrutura de Equipe**:
   - Defina responsáveis por cada cliente
   - Crie grupos lógicos de acesso
   - Estabeleça hierarquia clara

## Resolução de Problemas

### Usuário não consegue acessar cliente

**Possíveis causas**:
1. Acesso não foi concedido
2. Acesso foi revogado
3. Cliente foi desativado
4. Problema de cache

**Soluções**:
1. Verifique se o acesso existe em "Gerenciar Acessos"
2. Conceda o acesso novamente se necessário
3. Aguarde até 2 minutos para atualização do cache
4. Peça para o usuário fazer logout/login

### Erro ao criar usuário

**Possíveis causas**:
1. Limite de usuários atingido
2. Email já existe no sistema
3. Organização inativa

**Soluções**:
1. Verifique o uso atual do plano
2. Use email diferente ou remova usuário duplicado
3. Entre em contato com suporte

### Não consigo criar cliente

**Possíveis causas**:
1. Limite de clientes atingido
2. Nome duplicado
3. Assinatura expirada

**Soluções**:
1. Verifique limites do plano
2. Use nome único para o cliente
3. Renove a assinatura

## Contato e Suporte

### Suporte Técnico
- **Email**: suporte@adsmanager.com
- **Chat**: Disponível no dashboard
- **Horário**: Segunda a Sexta, 9h às 18h

### Suporte Comercial
- **Email**: vendas@adsmanager.com
- **Telefone**: (11) 1234-5678
- **Upgrades**: Disponível 24/7 online

### Recursos Adicionais
- **Base de Conhecimento**: help.adsmanager.com
- **Vídeos Tutoriais**: youtube.com/adsmanager
- **Comunidade**: community.adsmanager.com

---

**Dica**: Mantenha este guia como referência e consulte regularmente para otimizar o uso do sistema!