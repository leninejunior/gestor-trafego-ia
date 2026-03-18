import { SubscriptionAnalyticsService } from '@/lib/services/subscription-analytics';

// Simple test to verify the analytics service can be instantiated
describe('SubscriptionAnalyticsService', () => {
  it('should create an instance', () => {
    const service = new SubscriptionAnalyticsService();
    expect(service).toBeInstanceOf(SubscriptionAnalyticsService);
  });

  it('should have all required methods', () => {
    const service = new SubscriptionAnalyticsService();
    
    expect(typeof service.calculateMRR).toBe('function');
    expect(typeof service.calculateARR).toBe('function');
    expect(typeof service.calculateChurnRate).toBe('function');
    expect(typeof service.calculateConversionRate).toBe('function');
    expect(typeof service.calculateCustomerLifetimeValue).toBe('function');
    expect(typeof service.getSubscriptionMetrics).toBe('function');
    expect(typeof service.getRevenueMetrics).toBe('function');
    expect(typeof service.getCustomerMetrics).toBe('function');
    expect(typeof service.getConversionMetrics).toBe('function');
    expect(typeof service.getMRRTrend).toBe('function');
    expect(typeof service.getSubscriptionDistribution).toBe('function');
  });
});