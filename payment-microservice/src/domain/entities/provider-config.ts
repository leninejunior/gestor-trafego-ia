export interface ProviderConfig {
  id: string;
  name: string;
  isActive: boolean;
  priority: number;
  credentials: Record<string, string>;
  settings: Record<string, any>;
  healthCheckUrl?: string;
  webhookUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ProviderConfigEntity implements ProviderConfig {
  constructor(
    public id: string,
    public name: string,
    public isActive: boolean,
    public priority: number,
    public credentials: Record<string, string>,
    public settings: Record<string, any> = {},
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public healthCheckUrl?: string,
    public webhookUrl?: string
  ) {}

  activate(): void {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  updatePriority(priority: number): void {
    this.priority = priority;
    this.updatedAt = new Date();
  }

  updateCredentials(credentials: Record<string, string>): void {
    this.credentials = { ...this.credentials, ...credentials };
    this.updatedAt = new Date();
  }

  updateSettings(settings: Record<string, any>): void {
    this.settings = { ...this.settings, ...settings };
    this.updatedAt = new Date();
  }
}