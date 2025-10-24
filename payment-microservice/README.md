# Payment Microservice

Microserviço de pagamentos com arquitetura hexagonal para gerenciar múltiplos provedores de pagamento (Stripe, Iugu, PagSeguro, Mercado Pago) com failover automático.

## Características

- **Arquitetura Hexagonal**: Separação clara entre domínio, aplicação e infraestrutura
- **Múltiplos Provedores**: Suporte para Stripe, Iugu, PagSeguro e Mercado Pago
- **Failover Automático**: Sistema de backup entre provedores
- **Monitoramento**: Métricas Prometheus e logs estruturados
- **Segurança**: Criptografia AES-256 e validação de webhooks
- **Docker**: Containerização completa com docker-compose

## Estrutura do Projeto

```
src/
├── domain/                 # Camada de domínio
│   ├── entities/          # Entidades de negócio
│   └── ports/             # Interfaces/contratos
├── application/           # Camada de aplicação
│   └── services/          # Serviços de aplicação
└── infrastructure/        # Camada de infraestrutura
    ├── config/            # Configurações
    ├── controllers/       # Controladores HTTP
    ├── logging/           # Sistema de logs
    └── web/               # Aplicação web
```

## Instalação

### Pré-requisitos

- Node.js 18+
- Docker e Docker Compose
- PostgreSQL 15+
- Redis 7+

### Configuração Local

1. Clone o repositório:
```bash
git clone <repository-url>
cd payment-microservice
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. Inicie os serviços com Docker:
```bash
npm run docker:up
```

5. Execute em modo desenvolvimento:
```bash
npm run dev
```

## Scripts Disponíveis

- `npm run build` - Compila o TypeScript
- `npm start` - Inicia a aplicação em produção
- `npm run dev` - Inicia em modo desenvolvimento
- `npm test` - Executa os testes
- `npm run lint` - Executa o linter
- `npm run docker:up` - Inicia os containers
- `npm run docker:down` - Para os containers

## Endpoints

### Health Check
- `GET /health` - Status da aplicação
- `GET /ready` - Verificação de prontidão
- `GET /metrics` - Métricas Prometheus

### API (em desenvolvimento)
- `POST /api/v1/payments` - Criar pagamento
- `GET /api/v1/payments/:id` - Buscar pagamento
- `POST /api/v1/webhooks/:provider` - Receber webhooks

## Configuração de Provedores

### Stripe
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Iugu
```env
IUGU_API_TOKEN=your_iugu_api_token
```

### PagSeguro
```env
PAGSEGURO_EMAIL=your_email
PAGSEGURO_TOKEN=your_token
```

### Mercado Pago
```env
MERCADOPAGO_ACCESS_TOKEN=your_access_token
```

## Monitoramento

O serviço expõe métricas Prometheus em `/metrics`:

- `payment_transactions_total` - Total de transações
- `payment_duration_seconds` - Duração do processamento
- `payment_provider_health` - Status dos provedores

## Desenvolvimento

### Adicionando Novos Provedores

1. Implemente a interface `IPaymentProvider`
2. Crie o provider na pasta `src/infrastructure/providers/`
3. Registre o provider no registry
4. Configure as variáveis de ambiente

### Testes

```bash
# Executar todos os testes
npm test

# Executar com coverage
npm run test:coverage

# Executar em modo watch
npm run test:watch
```

## Deployment

### Docker

```bash
# Build da imagem
docker build -t payment-microservice .

# Executar container
docker run -p 3000:3000 payment-microservice
```

### Docker Compose

```bash
# Produção
docker-compose up -d

# Com ferramentas de desenvolvimento
docker-compose --profile tools up -d
```

## Licença

MIT