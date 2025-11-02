/**
 * POST /api/exports/google
 * 
 * Export Google Ads campaign data to CSV or JSON format
 * Requirements: 12.1, 12.2, 12.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ExportService } from '@/lib/services/export-service';
import { z } from 'zod';

const googleExportRequestSchema = z.object({
  clientId: z.string().uuid(),
  format: z.enum(['csv', 'json']),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
    const validationResult = googleExportRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { clientId, format, dateFrom, dateTo, campaignIds, metrics } =
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

    // Check if client has Google Ads connection
    const { data: googleConnection } = await supabase
      .from('google_ads_connections')
      .select('id')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .single();

    if (!googleConnection) {
      return NextResponse.json(
        { error: 'No active Google Ads connection found for this client' },
        { status: 400 }
      );
    }

    // Create export
    const exportService = new ExportService();
    
    let result;
    if (format === 'csv') {
      result = await exportService.exportGoogleAdsToCSV({
        userId: user.id,
        clientId,
        format: 'csv',
        dateFrom,
        dateTo,
        platform: 'google',
        campaignIds,
        metrics,
      });
    } else {
      result = await exportService.exportGoogleAdsToJSON({
        userId: user.id,
        clientId,
        format: 'json',
        dateFrom,
        dateTo,
        platform: 'google',
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
    });
  } catch (error) {
    console.error('Google Ads export error:', error);

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
      { error: 'Failed to create Google Ads export' },
      { status: 500 }
    );
  }
}