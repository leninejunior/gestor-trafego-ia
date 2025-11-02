/**
 * GET /api/exports/:id/download
 * 
 * Get download URL for completed export
 * Requirements: 8.1, 8.2, 8.4, 8.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ExportService } from '@/lib/services/export-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const exportId = params.id;

    // Get export job
    const exportService = new ExportService();
    const job = await exportService.getExportJob(exportId, user.id);

    if (!job) {
      return NextResponse.json(
        { error: 'Export not found' },
        { status: 404 }
      );
    }

    // Check job status
    if (job.status === 'pending' || job.status === 'processing') {
      return NextResponse.json(
        {
          status: job.status,
          message: 'Export is still processing',
        },
        { status: 202 }
      );
    }

    if (job.status === 'failed') {
      return NextResponse.json(
        {
          status: 'failed',
          error: job.error_message || 'Export failed',
        },
        { status: 500 }
      );
    }

    // Get download URL
    const downloadUrl = await exportService.getDownloadUrl(exportId, user.id);

    if (!downloadUrl) {
      return NextResponse.json(
        { error: 'Export has expired or download URL unavailable' },
        { status: 410 }
      );
    }

    return NextResponse.json({
      success: true,
      export: {
        id: job.id,
        format: job.format,
        status: job.status,
        fileSize: job.file_size,
        recordCount: job.record_count,
        downloadUrl,
        expiresAt: job.expires_at,
        createdAt: job.created_at,
        completedAt: job.completed_at,
      },
    });
  } catch (error) {
    console.error('Download URL error:', error);

    return NextResponse.json(
      { error: 'Failed to get download URL' },
      { status: 500 }
    );
  }
}
