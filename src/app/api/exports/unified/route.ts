/**
 * POST /api/exports/unified
 * 
 * Export unified campaign data (Meta + Google Ads) to CSV or JSON format
 * Requirements: 12.1, 12.2, 12.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ExportService } from '@/lib/services/export-service';
import { z } from 'zod';

const unifiedExportRequestSchema = z.object({
  clientId: z.string().uuid(),
  format: z.enum(['csv', 'json']),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  platforms: z.array(z.enum(['meta', 'google'])).optional(),
  campaignIds: z.array(z.string()).optional(),
  metrics: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = unifiedExportRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { clientId, format, dateFrom, dateTo, platforms, campaignIds, metrics } =
      validationResult.data;

    // Verify user has access to client
    const { data: membership } = await supabase
      .from('clients')
      .select('id, organization_id')
      .eq('id', clientId)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Check if user is member of organization
    const { data: orgMembership } = await supabase
      .from('memberships')
      .select('id')
      .eq('organization_id', membership.organization_id)
      .eq('user_id', user.id)
      .single();

    if (!orgMembership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Check available connections
    const [metaConnection, googleConnection] = await Promise.all([
      supabase
        .from('client_meta_connections')
        .select('id')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .single(),
      supabase
        .from('google_ads_connections')
        .select('id')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .single(),
    ]);

    const hasMetaConnection = !!metaConnection.data;
    const hasGoogleConnection = !!googleConnection.data;

    // Check if at least one platform is connected
    if (!hasMetaConnection && !hasGoogleConnection) {
      return NextResponse.json(
        { error: 'No active platform connections found for this client' },
        { status: 400 }
      );
    }

    // Filter platforms based on what's actually connected
    const availablePlatforms = [];
    if (hasMetaConnection) availablePlatforms.push('meta');
    if (hasGoogleConnection) availablePlatforms.push('google');

    // If specific platforms were requested, validate they're available
    const requestedPlatforms = platforms || availablePlatforms;
    const invalidPlatforms = requestedPlatforms.filter(p => !availablePlatforms.includes(p));
    
    if (invalidPlatforms.length > 0) {
      return NextResponse.json(
        { 
          error: `Platform(s) not connected: ${invalidPlatforms.join(', ')}`,
          availablePlatforms,
        },
        { status: 400 }
      );
    }

    // Create export
    const exportService = new ExportService();
    
    let result;
    if (format === 'csv') {
      result = await exportService.exportUnifiedToCSV({
        userId: user.id,
        clientId,
        format: 'csv',
        dateFrom,
        dateTo,
        platform: 'unified',
        campaignIds,
        metrics,
      });
    } else {
      result = await exportService.exportUnifiedToJSON({
        userId: user.id,
        clientId,
        format: 'json',
        dateFrom,
        dateTo,
        platform: 'unified',
        campaignIds,
        metrics,
      });
    }

    return NextResponse.json({
      success: true,
      export: {
        id: result.id,
        format: result.format,
        fileName: result.fileName,
        fileSize: result.fileSize,
        recordCount: result.recordCount,
        downloadUrl: result.downloadUrl,
        expiresAt: result.expiresAt,
      },
      metadata: {
        availablePlatforms,
        exportedPlatforms: requestedPlatforms,
        hasMetaData: hasMetaConnection,
        hasGoogleData: hasGoogleConnection,
      },
    });
  } catch (error) {
    console.error('Unified export error:', error);

    if (error instanceof Error) {
      // Handle specific errors
      if (error.message.includes('not allowed')) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }

      if (error.message.includes('retention limit')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create unified export' },
      { status: 500 }
    );
  }
}