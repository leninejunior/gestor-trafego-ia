import { Suspense } from 'react';
import SubscriptionManualManagement from '@/components/admin/subscription-manual-management';

export const dynamic = 'force-dynamic';

export default function AdminSubscriptionManagementPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Gerenciamento de Assinaturas
              </h1>
              <p className="text-gray-600 mt-1">
                Gerencie planos e assinaturas de clientes manualmente
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<SubscriptionManagementSkeleton />}>
          <SubscriptionManualManagement />
        </Suspense>
      </div>
    </div>
  );
}

function SubscriptionManagementSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center">
        <div>
          <div className="h-8 bg-gray-200 rounded w-64 animate-pulse mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-96 animate-pulse"></div>
        </div>
        <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
      </div>

      {/* Tabs Skeleton */}
      <div className="space-y-4">
        <div className="flex space-x-4">
          <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
          <div className="h-10 bg-gray-200 rounded w-40 animate-pulse"></div>
        </div>

        {/* Search Skeleton */}
        <div className="h-10 bg-gray-200 rounded w-80 animate-pulse"></div>

        {/* Cards Skeleton */}
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
                    <div className="h-6 bg-gray-200 rounded w-20 animate-pulse"></div>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    {[...Array(4)].map((_, j) => (
                      <div key={j} className="space-y-1">
                        <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                        <div className="h-5 bg-gray-200 rounded w-24 animate-pulse"></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="h-9 bg-gray-200 rounded w-24 animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}