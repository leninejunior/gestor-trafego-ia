/**
 * GET /api/cron/export-cleanup
 * 
 * Cron job to clean up expired export files
 * Should be called daily via Vercel Cron or similar
 */

import { NextRequest, NextResponse } from 'next/server';
import { ExportService } from '@/lib/services/export-service';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const exportService = new ExportService();
    const deletedCount = await exportService.cleanupExpiredExports();

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedCount} expired exports`,
      deletedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Export cleanup error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Cleanup failed',
      },
      { status: 500 }
    );
  }
}
