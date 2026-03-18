'use client';

/**
 * Export Notifications Wrapper
 * 
 * Provides global export notifications across the dashboard
 * Requirements: 12.1, 12.2, 12.3
 */

import { useExportManager } from '@/hooks/use-export-manager';
import { ExportProgressNotification } from './export-progress-notification';

export function ExportNotificationsWrapper() {
  const { jobs, downloadExport, dismissJob } = useExportManager();

  // Only show active and recently completed jobs
  const visibleJobs = jobs.filter(job => 
    job.status === 'processing' || 
    job.status === 'pending' || 
    (job.status === 'completed' && !job.downloadUrl) ||
    job.status === 'failed'
  );

  if (visibleJobs.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <ExportProgressNotification
        jobs={visibleJobs}
        onDownload={downloadExport}
        onDismiss={dismissJob}
      />
    </div>
  );
}