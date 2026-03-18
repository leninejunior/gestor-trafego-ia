/**
 * Export Notification Service
 * 
 * Handles notifications for export completion with download links
 * Requirements: 8.5
 */

import { createClient } from '@/lib/supabase/server';
import type { ExportJob } from './export-service';

export interface ExportNotificationData {
  exportJob: ExportJob;
  downloadUrl: string;
  user: {
    id: string;
    email: string;
    name?: string;
  };
  client: {
    id: string;
    name: string;
  };
}

export class ExportNotificationService {
  private readonly fromEmail: string;
  private readonly appUrl: string;

  constructor() {
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@adsmanager.com';
    this.appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }

  /**
   * Send export completion notification
   * Requirements: 8.5
   */
  async sendExportCompletionNotification(
    data: ExportNotificationData
  ): Promise<boolean> {
    try {
      const template = this.getExportCompletionTemplate(data);
      const success = await this.sendEmail(data.user.email, template);

      if (success) {
        await this.logNotification(
          data.exportJob.id,
          data.user.id,
          'export_completed',
          data.user.email
        );
      }

      return success;
    } catch (error) {
      console.error('Error sending export completion notification:', error);
      return false;
    }
  }

  /**
   * Send export failure notification
   */
  async sendExportFailureNotification(
    exportJob: ExportJob,
    user: { id: string; email: string; name?: string }
  ): Promise<boolean> {
    try {
      const template = this.getExportFailureTemplate(exportJob, user);
      const success = await this.sendEmail(user.email, template);

      if (success) {
        await this.logNotification(
          exportJob.id,
          user.id,
          'export_failed',
          user.email
        );
      }

      return success;
    } catch (error) {
      console.error('Error sending export failure notification:', error);
      return false;
    }
  }

  /**
   * Get export completion email template
   */
  private getExportCompletionTemplate(
    data: ExportNotificationData
  ): { subject: string; html: string; text: string } {
    const userName = data.user.name || 'there';
    const formatLabel = data.exportJob.format.toUpperCase();
    const expiresAt = data.exportJob.expires_at
      ? new Date(data.exportJob.expires_at).toLocaleString()
      : 'within 24 hours';

    const subject = `✅ Your ${formatLabel} export is ready for download`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #059669; margin: 0;">✅ Export Complete!</h1>
    </div>
    
    <div style="background: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <h2 style="color: #1e293b; margin-top: 0;">Hi ${userName},</h2>
        <p>Your campaign insights export is ready for download!</p>
    </div>

    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #166534; margin-top: 0;">📊 Export Details</h3>
        <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Client:</strong> ${data.client.name}</li>
            <li><strong>Format:</strong> ${formatLabel}</li>
            <li><strong>Records:</strong> ${data.exportJob.record_count || 0}</li>
            <li><strong>File Size:</strong> ${this.formatFileSize(data.exportJob.file_size || 0)}</li>
            <li><strong>Created:</strong> ${new Date(data.exportJob.created_at).toLocaleString()}</li>
        </ul>
    </div>

    <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #92400e; margin-top: 0;">⏰ Download Link Expires</h3>
        <p style="margin: 0;">Your download link will expire <strong>${expiresAt}</strong>. Make sure to download your file before then!</p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <a href="${data.downloadUrl}" style="background: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">
            📥 Download ${formatLabel} File
        </a>
    </div>

    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #1e40af; margin-top: 0;">💡 Tips</h3>
        <ul style="margin: 0; padding-left: 20px;">
            <li>The download link is valid for 24 hours</li>
            <li>You can access this export from your dashboard</li>
            <li>Need another export? You can create a new one anytime</li>
        </ul>
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">
            <a href="${this.appUrl}/dashboard" style="color: #2563eb;">Go to Dashboard</a> | 
            <a href="mailto:support@adsmanager.com" style="color: #2563eb;">Contact Support</a>
        </p>
    </div>

    <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center; color: #6b7280; font-size: 12px;">
        <p>© ${new Date().getFullYear()} Ads Manager. All rights reserved.</p>
    </div>
</body>
</html>`;

    const text = `
Export Complete! - Ads Manager

Hi ${userName},

Your campaign insights export is ready for download!

Export Details:
- Client: ${data.client.name}
- Format: ${formatLabel}
- Records: ${data.exportJob.record_count || 0}
- File Size: ${this.formatFileSize(data.exportJob.file_size || 0)}
- Created: ${new Date(data.exportJob.created_at).toLocaleString()}

⏰ IMPORTANT: Your download link expires ${expiresAt}

Download your file: ${data.downloadUrl}

Tips:
- The download link is valid for 24 hours
- You can access this export from your dashboard
- Need another export? You can create a new one anytime

Dashboard: ${this.appUrl}/dashboard
Support: support@adsmanager.com

© ${new Date().getFullYear()} Ads Manager. All rights reserved.
    `.trim();

    return { subject, html, text };
  }

  /**
   * Get export failure email template
   */
  private getExportFailureTemplate(
    exportJob: ExportJob,
    user: { id: string; email: string; name?: string }
  ): { subject: string; html: string; text: string } {
    const userName = user.name || 'there';
    const formatLabel = exportJob.format.toUpperCase();

    const subject = `❌ Export failed - ${formatLabel}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #dc2626; margin: 0;">❌ Export Failed</h1>
    </div>
    
    <div style="background: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <h2 style="color: #1e293b; margin-top: 0;">Hi ${userName},</h2>
        <p>Unfortunately, your ${formatLabel} export could not be completed.</p>
    </div>

    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #991b1b; margin-top: 0;">⚠️ Error Details</h3>
        <p style="margin: 0;"><strong>Error:</strong> ${exportJob.error_message || 'Unknown error occurred'}</p>
        <p style="margin: 8px 0 0 0;"><strong>Export ID:</strong> ${exportJob.id}</p>
    </div>

    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #1e40af; margin-top: 0;">🔄 What to Do Next</h3>
        <ul style="margin: 0; padding-left: 20px;">
            <li>Try creating the export again</li>
            <li>Check if your date range is within your plan's retention period</li>
            <li>Verify you have permission to export in this format</li>
            <li>If the problem persists, contact our support team</li>
        </ul>
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <a href="${this.appUrl}/dashboard" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500; margin-right: 10px;">
            Try Again
        </a>
        <a href="mailto:support@adsmanager.com?subject=Export Failed - ${exportJob.id}" style="background: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
            Contact Support
        </a>
    </div>

    <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center; color: #6b7280; font-size: 12px;">
        <p>© ${new Date().getFullYear()} Ads Manager. All rights reserved.</p>
    </div>
</body>
</html>`;

    const text = `
Export Failed - Ads Manager

Hi ${userName},

Unfortunately, your ${formatLabel} export could not be completed.

Error Details:
- Error: ${exportJob.error_message || 'Unknown error occurred'}
- Export ID: ${exportJob.id}

What to Do Next:
- Try creating the export again
- Check if your date range is within your plan's retention period
- Verify you have permission to export in this format
- If the problem persists, contact our support team

Try Again: ${this.appUrl}/dashboard
Contact Support: support@adsmanager.com

© ${new Date().getFullYear()} Ads Manager. All rights reserved.
    `.trim();

    return { subject, html, text };
  }

  /**
   * Send email (logs to console in development)
   */
  private async sendEmail(
    to: string,
    template: { subject: string; html: string; text: string }
  ): Promise<boolean> {
    try {
      // In development, log to console
      // In production, integrate with email service (Resend, SendGrid, etc.)
      console.log('='.repeat(80));
      console.log('EXPORT NOTIFICATION EMAIL (Development Mode)');
      console.log('='.repeat(80));
      console.log(`To: ${to}`);
      console.log(`From: ${this.fromEmail}`);
      console.log(`Subject: ${template.subject}`);
      console.log('-'.repeat(80));
      console.log('TEXT CONTENT:');
      console.log(template.text);
      console.log('='.repeat(80));

      return true;
    } catch (error) {
      console.error('Error sending export notification email:', error);
      return false;
    }
  }

  /**
   * Log notification to database
   */
  private async logNotification(
    exportJobId: string,
    userId: string,
    type: string,
    recipient: string
  ): Promise<void> {
    try {
      const supabase = await createClient();

      await supabase.from('export_notifications_log').insert({
        export_job_id: exportJobId,
        user_id: userId,
        type,
        recipient,
        sent_at: new Date().toISOString(),
        status: 'sent',
      });
    } catch (error) {
      console.error('Error logging export notification:', error);
      // Don't throw - logging is not critical
    }
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get user and client data for notification
   */
  async getUserAndClientData(
    userId: string,
    clientId: string
  ): Promise<{
    user: { id: string; email: string; name?: string };
    client: { id: string; name: string };
  } | null> {
    try {
      const supabase = await createClient();

      // Get user data
      const { data: userData } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('id', userId)
        .single();

      if (!userData) {
        // Fallback to auth.users
        const { data: authUser } = await supabase.auth.getUser();
        if (!authUser.user) return null;

        userData.id = authUser.user.id;
        userData.email = authUser.user.email || '';
        userData.full_name = authUser.user.user_metadata?.full_name;
      }

      // Get client data
      const { data: clientData } = await supabase
        .from('clients')
        .select('id, name')
        .eq('id', clientId)
        .single();

      if (!clientData) return null;

      return {
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.full_name,
        },
        client: {
          id: clientData.id,
          name: clientData.name,
        },
      };
    } catch (error) {
      console.error('Error getting user and client data:', error);
      return null;
    }
  }
}
