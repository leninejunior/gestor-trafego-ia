'use client';

import { Suspense } from 'react';
import { RefreshCw } from "lucide-react";
import GooglePageContent from './page-content';

function LoadingFallback() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Carregando dashboard...
      </div>
    </div>
  );
}

export default function GooglePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>gle/connect-
      <GooglePageContent />
    </Suspense>
  );
}
