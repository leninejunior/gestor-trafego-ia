import { ReactNode } from 'react';
import { DashboardSidebar } from '@/components/dashboard/sidebar';
import { DashboardHeader } from '@/components/dashboard/header';
import { ExportNotificationsWrapper } from '@/components/exports/export-notifications-wrapper';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dashboard-layout flex h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
          {children}
        </main>
      </div>
      <ExportNotificationsWrapper />
    </div>
  );
}