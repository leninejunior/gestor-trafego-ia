/**
 * Iugu Client
 * Cliente básico para interação com a API do Iugu
 */

export interface IuguClient {
  createCustomer: (data: any) => Promise<any>;
  createPaymentToken: (data: any) => Promise<any>;
  createSubscription: (data: any) => Promise<any>;
  getCustomer: (id: string) => Promise<any>;
  getSubscription: (id: string) => Promise<any>;
  updateSubscription: (id: string, data: any) => Promise<any>;
  cancelSubscription: (id: string) => Promise<any>;
  createInvoice: (data: any) => Promise<any>;
  getInvoice: (id: string) => Promise<any>;
}

export class IuguClientImpl implements IuguClient {
  private apiToken: string;
  private baseUrl = 'https://api.iugu.com/v1';

  constructor(apiToken?: string) {
    this.apiToken = apiToken || process.env.IUGU_API_TOKEN || '';
    
    if (!this.apiToken) {
      throw new Error('IUGU_API_TOKEN não configurado');
    }
  }

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const auth = Buffer.from(`${this.apiToken}:`).toString('base64');

    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Iugu API Error: ${JSON.stringify(error)}`);
    }

    return response.json() as Promise<T>;
  }

  async createCustomer(data: any) {
    return this.request('/customers', 'POST', data);
  }

  async createPaymentToken(data: any) {
    return this.request('/payment_token', 'POST', data);
  }

  async createSubscription(data: any) {
    return this.request('/subscriptions', 'POST', data);
  }

  async getCustomer(id: string) {
    return this.request(`/customers/${id}`);
  }

  async getSubscription(id: string) {
    return this.request(`/subscriptions/${id}`);
  }

  async updateSubscription(id: string, data: any) {
    return this.request(`/subscriptions/${id}`, 'PUT', data);
  }

  async cancelSubscription(id: string) {
    return this.request(`/subscriptions/${id}`, 'DELETE');
  }

  async createInvoice(data: any) {
    return this.request('/invoices', 'POST', data);
  }

  async getInvoice(id: string) {
    return this.request(`/invoices/${id}`);
  }
}

export default IuguClientImpl;