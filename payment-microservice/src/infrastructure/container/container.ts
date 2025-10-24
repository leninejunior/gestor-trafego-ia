/**
 * Simple dependency injection container
 * In a production environment, consider using a more robust DI container like inversify
 */

type Constructor<T = {}> = new (...args: any[]) => T;
type Factory<T = any> = () => T;

class Container {
  private services = new Map<string, any>();
  private factories = new Map<string, Factory>();

  /**
   * Register a service instance
   */
  register<T>(name: string, instance: T): void {
    this.services.set(name, instance);
  }

  /**
   * Register a factory function
   */
  registerFactory<T>(name: string, factory: Factory<T>): void {
    this.factories.set(name, factory);
  }

  /**
   * Get a service instance
   */
  get<T>(name: string): T {
    // Check if instance already exists
    if (this.services.has(name)) {
      return this.services.get(name) as T;
    }

    // Check if factory exists
    if (this.factories.has(name)) {
      const factory = this.factories.get(name)!;
      const instance = factory();
      this.services.set(name, instance);
      return instance as T;
    }

    throw new Error(`Service '${name}' not found in container`);
  }

  /**
   * Check if service is registered
   */
  has(name: string): boolean {
    return this.services.has(name) || this.factories.has(name);
  }

  /**
   * Clear all services (useful for testing)
   */
  clear(): void {
    this.services.clear();
    this.factories.clear();
  }

  /**
   * Get all registered service names
   */
  getRegisteredServices(): string[] {
    const serviceNames = Array.from(this.services.keys());
    const factoryNames = Array.from(this.factories.keys());
    return [...serviceNames, ...factoryNames];
  }
}

// Export singleton instance
export const container = new Container();