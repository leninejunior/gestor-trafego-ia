/**
 * Google Ads Monitoring Dashboard Page
 * 
 * Displays comprehensive monitoring and health information
 * Requirements: 10.3, 10.5
 */

import { GoogleAdsMonitoringDashboard } from '@/components/google/monitoring-dashboard';

export default function GoogleAdsMonitoringPage() {
  return (
    <div className="container mx-auto py-6">
      <GoogleAdsMonitoringDashboard />
    </div>
  );
}

export const metadata = {
  title: 'Google Ads Monitoring',
  description: 'Monitor Google Ads integration health and performance'
};