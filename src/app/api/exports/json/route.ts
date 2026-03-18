/**
 * POST /api/exports/json
 * 
 * Export campaign insights to JSON format
 * Requirements: 8.1, 8.2, 8.4, 8.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ExportService } from '@/lib/services/export-service';
import { z } from 'zod';

const exportRequestSchema = z.object({
  clientId: z.string().uuid(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  platform: z.enum(['meta', 'google', 'unified']).optional(),
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
    const validationResult = exportRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { clientId, dateFrom, dateTo, platform, campaignIds, metrics } =
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

    // Validate export limits based on plan
    const exportService = new ExportService();
    const hasPermission = await exportService.validatePermissions(user.id, 'json');
    
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'JSON export not available in your current plan' },
        { status: 403 }
      );
    }

    // Create export based on platform
    let result;
    if (platform === 'google') {
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
    } else if (platform === 'unified') {
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
    } else {
      // Default to original Meta export
      result = await exportService.exportToJSON({
        userId: user.id,
        clientId,
        format: 'json',
        dateFrom,
        dateTo,
        platform,
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
    console.error('JSON export error:', error);

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
      { error: 'Failed to create JSON export' },
      { status: 500 }
    );
  }
}
