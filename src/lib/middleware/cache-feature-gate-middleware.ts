import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CacheFeatureGate } from '@/lib/services/cache-feature-gate';

export interface CacheFeatureGateOptions {
  checkDataRetention?: number; // Número de dias solicitados
  checkClientLimit?: boolean;
  checkCampaignLimit?: boolean; // Requer clientId no contexto
  checkExportPermission?: 'csv' | 'json';
  errorMessage?: string;
}

/**
 * Cache Feature Gate Middleware
 * 
 * Middleware para proteger rotas de API baseado em limites de cache e retenção de dados.
 * Implementa requisitos 2.1, 2.2, 3.1, 3.2
 */
export function withCacheFeatureGate(options: CacheFeatureGateOptions) {
  return function middleware(handler: Function) {
    return async function (request: NextRequest, context?: any) {
      try {
        const supabase = await createClient();
        const cacheGate = new CacheFeatureGate();

        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          );
        }

        // Check data retention if specified
        if (options.checkDataRetention !== undefined) {
          const retentionCheck = await cacheGate.checkDataRetention(
            user.id,
            options.checkDataRetention
          );

          if (!retentionCheck.allowed) {
            return NextResponse.json(
              {
                error: options.errorMessage || retentionCheck.reason,
                requestedDays: retentionCheck.requestedDays,
                allowedDays: retentionCheck.allowedDays,
                upgradeRequired: true,
              },
              { status: 403 }
            );
          }
        }

        // Check client limit if specified
        if (options.checkClientLimit) {
          const clientCheck = await cacheGate.checkClientLimit(user.id);

          if (!clientCheck.allowed) {
            return NextResponse.json(
              {
                error: options.errorMessage || clientCheck.reason,
                current: clientCheck.current,
                limit: clientCheck.limit,
                upgradeRequired: true,
              },
              { status: 403 }
            );
          }
        }

        // Check campaign limit if specified
        if (options.checkCampaignLimit) {
          // Extract clientId from request (query params, body, or context)
          const url = new URL(request.url);
          const clientId = 
            url.searchParams.get('clientId') ||
            context?.params?.clientId ||
            context?.clientId;

          if (!clientId) {
            return NextResponse.json(
              { error: 'Client ID required for campaign limit check' },
              { status: 400 }
            );
          }

          const campaignCheck = await cacheGate.checkCampaignLimit(clientId);

          if (!campaignCheck.allowed) {
            return NextResponse.json(
              {
                error: options.errorMessage || campaignCheck.reason,
                current: campaignCheck.current,
                limit: campaignCheck.limit,
                upgradeRequired: true,
              },
              { status: 403 }
            );
          }
        }

        // Check export permission if specified
        if (options.checkExportPermission) {
          const exportCheck = await cacheGate.checkExportPermission(
            user.id,
            options.checkExportPermission
          );

          if (!exportCheck.allowed) {
            return NextResponse.json(
              {
                error: options.errorMessage || exportCheck.reason,
                format: exportCheck.format,
                upgradeRequired: true,
              },
              { status: 403 }
            );
          }
        }

        // Add user to context for handler
        const enhancedContext = {
          ...context,
          user,
        };

        // Call the original handler
        return await handler(request, enhancedContext);

      } catch (error) {
        console.error('Cache feature gate middleware error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    };
  };
}

/**
 * Helper functions to create cache feature gate middleware for specific checks
 */
export const createCacheFeatureGate = {
  /**
   * Require data retention validation for a specific number of days
   */
  dataRetention: (days: number, errorMessage?: string) =>
    withCacheFeatureGate({
      checkDataRetention: days,
      errorMessage: errorMessage || `Data retention limit exceeded. Your plan allows access to historical data for a limited period.`,
    }),

  /**
   * Require client limit validation
   */
  clientLimit: (errorMessage?: string) =>
    withCacheFeatureGate({
      checkClientLimit: true,
      errorMessage: errorMessage || 'Client limit reached. Upgrade your plan to add more clients.',
    }),

  /**
   * Require campaign limit validation
   */
  campaignLimit: (errorMessage?: string) =>
    withCacheFeatureGate({
      checkCampaignLimit: true,
      errorMessage: errorMessage || 'Campaign limit reached. Upgrade your plan to add more campaigns.',
    }),

  /**
   * Require CSV export permission
   */
  csvExport: (errorMessage?: string) =>
    withCacheFeatureGate({
      checkExportPermission: 'csv',
      errorMessage: errorMessage || 'CSV export is not available in your current plan.',
    }),

  /**
   * Require JSON export permission
   */
  jsonExport: (errorMessage?: string) =>
    withCacheFeatureGate({
      checkExportPermission: 'json',
      errorMessage: errorMessage || 'JSON export is not available in your current plan.',
    }),

  /**
   * Validate multiple cache features at once
   */
  multiple: (options: CacheFeatureGateOptions) =>
    withCacheFeatureGate(options),
};

/**
 * Utility function to extract user from request context
 */
export function getUserFromCacheContext(context: any): any | null {
  return context?.user || null;
}
