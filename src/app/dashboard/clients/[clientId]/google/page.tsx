'use client';

import { useParams } from 'next/navigation';
import { GoogleCampaignsList } from '@/components/google/google-campaigns-list';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function GoogleAdsPage() {
  const params = useParams();
  const clientId = params.clientId as string;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/dashboard/clients/${clientId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mt-2">Campanhas Google Ads</h1>
          <p className="text-gray-600 mt-1">
            Visualize e gerencie suas campanhas sincronizadas do Google Ads
          </p>
        </div>
      </div>

      <GoogleCampaignsList clientId={clientId} />
    </div>
  );
}
