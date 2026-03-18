# Provider Integration Guides

## Overview

This document provides detailed integration guides for each supported payment provider. Each guide includes setup instructions, configuration examples, and provider-specific considerations.

## Table of Contents

1. [Stripe Integration](#stripe-integration)
2. [Iugu Integration](#iugu-integration)
3. [PagSeguro Integration](#pagseguro-integration)
4. [Mercado Pago Integration](#mercado-pago-integration)
5. [General Integration Patterns](#general-integration-patterns)

---

## Stripe Integration

### Overview

Stripe is a global payment processor supporting credit cards, digital wallets, and local payment methods across 40+ countries.

### Prerequisites

1. **Stripe Account**: Create account at https://stripe.com
2. **API Keys**: Obtain publishable and secret keys
3. **Webhook Endpoint**: Configure webhook endpoint in Stripe Dashboard

### Configuration

#### Environment Variables

```bash
# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_mock_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_API_VERSION=2023-10-16
```

#### Provider Configuration

```json
{
  "name": "stripe",
  "displayName": "Stripe",
  "enabled": true,
  "priority": 1,
  "credentials": {
    "publishableKey": "pk_test_...",
    "secretKey": "sk_mock_...",
    "webhookSecret": "whsec_..."
  },
  "settings": {
    "apiVersion": "2023-10-16",
    "captureMethod": "automatic",
    "confirmationMethod": "automatic",
    "currency": "BRL",
    "statementDescriptor": "PAYMENT SERVICE"
  }
}
```

### Supported Payment Methods

| Method | Code | Description |
|--------|------|-------------|
| Credit Card | `credit_card` | Visa, Mastercard, Amex, etc. |
| Debit Card | `debit_card` | Debit cards with PIN |
| PIX | `pix` | Brazilian instant payment |
| Boleto | `boleto` | Brazilian bank slip |
| Apple Pay | `apple_pay` | Apple Pay digital wallet |
| Google Pay | `google_pay` | Google Pay digital wallet |

### Implementation Example

#### Basic Payment Flow

```javascript
// 1. Create Payment Intent
const paymentIntent = await stripe.paymentIntents.create({
  amount: 1000, // Amount in cents
  currency: 'brl',
  payment_method_types: ['card', 'pix'],
  metadata: {
    organizationId: 'org_123',
    orderId: 'order_456'
  }
});

// 2. Confirm Payment (client-side)
const {error, paymentIntent: confirmedPayment} = await stripe.confirmCardPayment(
  paymentIntent.client_secret,
  {
    payment_method: {
      card: cardElement,
      billing_details: {
        name: 'Customer Name',
        email: 'customer@example.com'
      }
    }
  }
);

// 3. Handle Result
if (error) {
  console.error('Payment failed:', error.message);
} else if (confirmedPayment.status === 'succeeded') {
  console.log('Payment succeeded!');
}
```

#### Subscription Flow

```javascript
// 1. Create Customer
const customer = await stripe.customers.create({
  email: 'customer@example.com',
  name: 'Customer Name',
  metadata: {
    organizationId: 'org_123'
  }
});

// 2. Create Subscription
const subscription = await stripe.subscriptions.create({
  customer: customer.id,
  items: [{
    price: 'price_monthly_premium'
  }],
  trial_period_days: 7,
  metadata: {
    organizationId: 'org_123'
  }
});
```

### Webhook Configuration

#### Stripe Dashboard Setup

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/v2/webhooks/stripe`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

#### Webhook Handler

```javascript
const handleStripeWebhook = (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      await updatePaymentStatus(paymentIntent.id, 'completed');
      break;
    
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      await updatePaymentStatus(failedPayment.id, 'failed');
      break;
    
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({received: true});
};
```

### Error Handling

#### Common Stripe Errors

```javascript
const handleStripeError = (error) => {
  switch (error.type) {
    case 'card_error':
      return {
        code: 'PAYMENT_DECLINED',
        message: error.message,
        declineCode: error.decline_code
      };
    
    case 'rate_limit_error':
      return {
        code: 'RATE_LIMITED',
        message: 'Too many requests made to the API too quickly'
      };
    
    case 'invalid_request_error':
      return {
        code: 'INVALID_REQUEST',
        message: error.message,
        param: error.param
      };
    
    case 'api_error':
      return {
        code: 'PROVIDER_ERROR',
        message: 'An error occurred with Stripe API'
      };
    
    default:
      return {
        code: 'UNKNOWN_ERROR',
        message: error.message
      };
  }
};
```

---

## Iugu Integration

### Overview

Iugu is a Brazilian payment processor specializing in local payment methods including PIX, Boleto, and credit cards.

### Prerequisites

1. **Iugu Account**: Create account at https://iugu.com
2. **API Token**: Obtain API token from Iugu dashboard
3. **Account ID**: Get your account ID for API calls

### Configuration

#### Environment Variables

```bash
# Iugu Configuration
IUGU_API_TOKEN=your_api_token_here
IUGU_ACCOUNT_ID=your_account_id
IUGU_WEBHOOK_SECRET=your_webhook_secret
IUGU_ENVIRONMENT=sandbox # or production
```

#### Provider Configuration

```json
{
  "name": "iugu",
  "displayName": "Iugu",
  "enabled": true,
  "priority": 2,
  "credentials": {
    "apiToken": "your_api_token_here",
    "accountId": "your_account_id"
  },
  "settings": {
    "environment": "sandbox",
    "defaultPaymentMethod": "credit_card",
    "boletoExpirationDays": 3,
    "pixExpirationMinutes": 30
  }
}
```

### Supported Payment Methods

| Method | Code | Description |
|--------|------|-------------|
| Credit Card | `credit_card` | Brazilian credit cards |
| PIX | `pix` | Brazilian instant payment |
| Boleto | `boleto` | Brazilian bank slip |
| Bank Transfer | `bank_transfer` | Direct bank transfer |

### Implementation Example

#### Credit Card Payment

```javascript
const iugu = require('iugu')('your_api_token');

// Create charge
const charge = await iugu.charge.create({
  token: 'card_token_from_frontend',
  email: 'customer@example.com',
  items: [
    {
      description: 'Product Name',
      quantity: 1,
      price_cents: 1000
    }
  ],
  payer: {
    cpf_cnpj: '12345678901',
    name: 'Customer Name',
    phone_prefix: '11',
    phone: '999999999',
    email: 'customer@example.com',
    address: {
      street: 'Rua Example',
      number: '123',
      district: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      zip_code: '01234567'
    }
  }
});
```

#### PIX Payment

```javascript
const pixCharge = await iugu.charge.create({
  method: 'pix',
  email: 'customer@example.com',
  items: [
    {
      description: 'Product Name',
      quantity: 1,
      price_cents: 1000
    }
  ],
  payer: {
    cpf_cnpj: '12345678901',
    name: 'Customer Name',
    email: 'customer@example.com'
  },
  pix: {
    expires_in: 30 // minutes
  }
});

// Response includes PIX QR code and copy-paste code
console.log('PIX QR Code:', pixCharge.pix.qr_code);
console.log('PIX Code:', pixCharge.pix.qr_code_text);
```

#### Boleto Payment

```javascript
const boletoCharge = await iugu.charge.create({
  method: 'bank_slip',
  email: 'customer@example.com',
  items: [
    {
      description: 'Product Name',
      quantity: 1,
      price_cents: 1000
    }
  ],
  payer: {
    cpf_cnpj: '12345678901',
    name: 'Customer Name',
    email: 'customer@example.com',
    address: {
      street: 'Rua Example',
      number: '123',
      district: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      zip_code: '01234567'
    }
  },
  bank_slip: {
    due_date: '2024-01-20' // YYYY-MM-DD
  }
});

// Response includes boleto URL and barcode
console.log('Boleto URL:', boletoCharge.pdf);
console.log('Barcode:', boletoCharge.bank_slip.digitable_line);
```

### Webhook Configuration

#### Webhook Events

Configure webhooks in Iugu dashboard for these events:
- `invoice.status_changed`
- `invoice.payment_failed`
- `invoice.refund`

#### Webhook Handler

```javascript
const crypto = require('crypto');

const handleIuguWebhook = (req, res) => {
  const signature = req.headers['x-iugu-signature'];
  const payload = JSON.stringify(req.body);
  
  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.IUGU_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    return res.status(400).send('Invalid signature');
  }

  const event = req.body;
  
  switch (event.event) {
    case 'invoice.status_changed':
      if (event.data.status === 'paid') {
        await updatePaymentStatus(event.data.id, 'completed');
      } else if (event.data.status === 'canceled') {
        await updatePaymentStatus(event.data.id, 'failed');
      }
      break;
    
    default:
      console.log(`Unhandled event: ${event.event}`);
  }

  res.json({received: true});
};
```

---

## PagSeguro Integration

### Overview

PagSeguro is a Brazilian payment processor owned by UOL, supporting various local payment methods.

### Prerequisites

1. **PagSeguro Account**: Create account at https://pagseguro.uol.com.br
2. **Credentials**: Obtain email and token from PagSeguro dashboard
3. **Application ID**: Register your application

### Configuration

#### Environment Variables

```bash
# PagSeguro Configuration
PAGSEGURO_EMAIL=your_email@example.com
PAGSEGURO_TOKEN=your_token_here
PAGSEGURO_APP_ID=your_app_id
PAGSEGURO_APP_KEY=your_app_key
PAGSEGURO_ENVIRONMENT=sandbox # or production
```

#### Provider Configuration

```json
{
  "name": "pagseguro",
  "displayName": "PagSeguro",
  "enabled": true,
  "priority": 3,
  "credentials": {
    "email": "your_email@example.com",
    "token": "your_token_here",
    "appId": "your_app_id",
    "appKey": "your_app_key"
  },
  "settings": {
    "environment": "sandbox",
    "currency": "BRL",
    "maxInstallments": 12,
    "redirectUrl": "https://yoursite.com/success",
    "notificationUrl": "https://yoursite.com/webhooks/pagseguro"
  }
}
```

### Supported Payment Methods

| Method | Code | Description |
|--------|------|-------------|
| Credit Card | `credit_card` | Brazilian credit cards |
| Debit Card | `debit_card` | Online debit |
| Boleto | `boleto` | Bank slip |
| PIX | `pix` | Instant payment |
| Digital Wallet | `digital_wallet` | PagSeguro wallet |

### Implementation Example

#### Direct Payment (Credit Card)

```javascript
const pagseguro = require('pagseguro');

const payment = {
  mode: 'default',
  method: 'creditCard',
  sender: {
    name: 'Customer Name',
    email: 'customer@example.com',
    phone: {
      areaCode: '11',
      number: '999999999'
    },
    documents: [{
      type: 'CPF',
      value: '12345678901'
    }]
  },
  currency: 'BRL',
  items: [{
    id: '001',
    description: 'Product Name',
    amount: '10.00',
    quantity: 1
  }],
  creditCard: {
    token: 'card_token_from_frontend',
    installment: {
      quantity: 1,
      value: '10.00'
    },
    holder: {
      name: 'CUSTOMER NAME',
      documents: [{
        type: 'CPF',
        value: '12345678901'
      }],
      birthDate: '01/01/1990',
      phone: {
        areaCode: '11',
        number: '999999999'
      }
    },
    billingAddress: {
      street: 'Rua Example',
      number: '123',
      complement: 'Apt 1',
      district: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      country: 'BRA',
      postalCode: '01234567'
    }
  }
};

const result = await pagseguro.payment.create(payment);
```

#### Checkout Transparente (Redirect)

```javascript
const checkout = {
  currency: 'BRL',
  items: [{
    id: '001',
    description: 'Product Name',
    amount: '10.00',
    quantity: 1
  }],
  sender: {
    email: 'customer@example.com'
  },
  redirectURL: 'https://yoursite.com/success',
  notificationURL: 'https://yoursite.com/webhooks/pagseguro'
};

const checkoutUrl = await pagseguro.checkout.create(checkout);
// Redirect user to checkoutUrl
```

### Notification Handling

#### IPN (Instant Payment Notification)

```javascript
const handlePagSeguroNotification = async (req, res) => {
  const notificationCode = req.body.notificationCode;
  const notificationType = req.body.notificationType;
  
  if (notificationType === 'transaction') {
    try {
      // Get transaction details
      const transaction = await pagseguro.notification.get(notificationCode);
      
      switch (transaction.status) {
        case '3': // Paid
          await updatePaymentStatus(transaction.reference, 'completed');
          break;
        case '7': // Canceled
          await updatePaymentStatus(transaction.reference, 'failed');
          break;
        default:
          console.log(`Transaction status: ${transaction.status}`);
      }
    } catch (error) {
      console.error('Error processing notification:', error);
      return res.status(500).send('Error');
    }
  }
  
  res.send('OK');
};
```

---

## Mercado Pago Integration

### Overview

Mercado Pago is Latin America's leading payment processor, supporting multiple countries and payment methods.

### Prerequisites

1. **Mercado Pago Account**: Create account at https://mercadopago.com
2. **Application**: Create application in Mercado Pago developers
3. **Credentials**: Obtain access token and public key

### Configuration

#### Environment Variables

```bash
# Mercado Pago Configuration
MERCADOPAGO_ACCESS_TOKEN=your_access_token
MERCADOPAGO_PUBLIC_KEY=your_public_key
MERCADOPAGO_CLIENT_ID=your_client_id
MERCADOPAGO_CLIENT_SECRET=your_client_secret
MERCADOPAGO_ENVIRONMENT=sandbox # or production
```

#### Provider Configuration

```json
{
  "name": "mercadopago",
  "displayName": "Mercado Pago",
  "enabled": true,
  "priority": 4,
  "credentials": {
    "accessToken": "your_access_token",
    "publicKey": "your_public_key",
    "clientId": "your_client_id",
    "clientSecret": "your_client_secret"
  },
  "settings": {
    "environment": "sandbox",
    "currency": "BRL",
    "country": "BR",
    "maxInstallments": 12,
    "binaryMode": false
  }
}
```

### Supported Payment Methods

| Method | Code | Description |
|--------|------|-------------|
| Credit Card | `credit_card` | Visa, Mastercard, etc. |
| Debit Card | `debit_card` | Debit cards |
| PIX | `pix` | Brazilian instant payment |
| Boleto | `boleto` | Bank slip |
| Account Money | `account_money` | Mercado Pago balance |

### Implementation Example

#### Credit Card Payment

```javascript
const mercadopago = require('mercadopago');

mercadopago.configure({
  access_token: process.env.MERCADOPAGO_ACCESS_TOKEN
});

const payment = {
  transaction_amount: 10.00,
  token: 'card_token_from_frontend',
  description: 'Product Name',
  installments: 1,
  payment_method_id: 'visa',
  issuer_id: 310,
  payer: {
    email: 'customer@example.com',
    identification: {
      type: 'CPF',
      number: '12345678901'
    }
  },
  external_reference: 'order_123',
  metadata: {
    organization_id: 'org_123'
  }
};

const result = await mercadopago.payment.save(payment);
```

#### PIX Payment

```javascript
const pixPayment = {
  transaction_amount: 10.00,
  description: 'Product Name',
  payment_method_id: 'pix',
  payer: {
    email: 'customer@example.com',
    first_name: 'Customer',
    last_name: 'Name',
    identification: {
      type: 'CPF',
      number: '12345678901'
    }
  },
  external_reference: 'order_123'
};

const result = await mercadopago.payment.save(pixPayment);

// Get PIX QR code
console.log('PIX QR Code:', result.body.point_of_interaction.transaction_data.qr_code);
console.log('PIX Code:', result.body.point_of_interaction.transaction_data.qr_code_base64);
```

#### Checkout Pro (Redirect)

```javascript
const preference = {
  items: [{
    title: 'Product Name',
    unit_price: 10.00,
    quantity: 1
  }],
  payer: {
    email: 'customer@example.com'
  },
  back_urls: {
    success: 'https://yoursite.com/success',
    failure: 'https://yoursite.com/failure',
    pending: 'https://yoursite.com/pending'
  },
  auto_return: 'approved',
  notification_url: 'https://yoursite.com/webhooks/mercadopago',
  external_reference: 'order_123'
};

const result = await mercadopago.preferences.create(preference);
// Redirect user to result.body.init_point
```

### Webhook Configuration

#### Webhook Handler

```javascript
const handleMercadoPagoWebhook = async (req, res) => {
  const { type, data } = req.body;
  
  if (type === 'payment') {
    try {
      const payment = await mercadopago.payment.findById(data.id);
      
      switch (payment.body.status) {
        case 'approved':
          await updatePaymentStatus(payment.body.external_reference, 'completed');
          break;
        case 'rejected':
          await updatePaymentStatus(payment.body.external_reference, 'failed');
          break;
        case 'cancelled':
          await updatePaymentStatus(payment.body.external_reference, 'canceled');
          break;
        default:
          console.log(`Payment status: ${payment.body.status}`);
      }
    } catch (error) {
      console.error('Error processing webhook:', error);
      return res.status(500).send('Error');
    }
  }
  
  res.status(200).send('OK');
};
```

---

## General Integration Patterns

### Provider Factory Pattern

```javascript
class ProviderFactory {
  static create(providerName, config) {
    switch (providerName) {
      case 'stripe':
        return new StripeProvider(config);
      case 'iugu':
        return new IuguProvider(config);
      case 'pagseguro':
        return new PagSeguroProvider(config);
      case 'mercadopago':
        return new MercadoPagoProvider(config);
      default:
        throw new Error(`Unknown provider: ${providerName}`);
    }
  }
}
```

### Unified Payment Interface

```javascript
class PaymentProvider {
  async createPayment(request) {
    throw new Error('Method must be implemented');
  }
  
  async capturePayment(paymentId) {
    throw new Error('Method must be implemented');
  }
  
  async refundPayment(paymentId, amount) {
    throw new Error('Method must be implemented');
  }
  
  async validateWebhook(payload, signature) {
    throw new Error('Method must be implemented');
  }
}
```

### Error Normalization

```javascript
class ErrorNormalizer {
  static normalize(error, providerName) {
    const normalizedError = {
      code: 'UNKNOWN_ERROR',
      message: error.message,
      provider: providerName,
      originalError: error
    };
    
    // Provider-specific error mapping
    switch (providerName) {
      case 'stripe':
        return this.normalizeStripeError(error);
      case 'iugu':
        return this.normalizeIuguError(error);
      // ... other providers
    }
    
    return normalizedError;
  }
}
```

### Retry Logic

```javascript
class RetryHandler {
  static async withRetry(operation, maxRetries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries || !this.isRetryable(error)) {
          throw error;
        }
        
        await this.delay(delay * Math.pow(2, attempt - 1)); // Exponential backoff
      }
    }
  }
  
  static isRetryable(error) {
    const retryableCodes = ['NETWORK_ERROR', 'TIMEOUT', 'RATE_LIMITED'];
    return retryableCodes.includes(error.code);
  }
  
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Health Check Implementation

```javascript
class HealthChecker {
  static async checkProvider(provider) {
    const startTime = Date.now();
    
    try {
      await provider.healthCheck();
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }
}
```

## Best Practices

### Security
1. **Never log sensitive data** (API keys, card numbers, etc.)
2. **Use HTTPS** for all API communications
3. **Validate webhook signatures** to prevent fraud
4. **Implement rate limiting** to prevent abuse
5. **Store credentials encrypted** in the database

### Performance
1. **Use connection pooling** for database connections
2. **Implement caching** for provider configurations
3. **Use async/await** for non-blocking operations
4. **Monitor response times** and set alerts
5. **Implement circuit breakers** for failing providers

### Reliability
1. **Implement proper error handling** for all operations
2. **Use retry logic** with exponential backoff
3. **Monitor provider health** continuously
4. **Implement failover mechanisms** between providers
5. **Log all transactions** for audit purposes

### Testing
1. **Use sandbox environments** for development
2. **Test all payment methods** supported by each provider
3. **Test webhook handling** thoroughly
4. **Implement integration tests** for critical flows
5. **Test failover scenarios** regularly