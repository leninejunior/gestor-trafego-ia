'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Search } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { translateMetaObjective, translateMetaStatus } from '@/lib/utils/meta-translations';

interface Campaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  roas: number;
  account_name: string;
  objective: string;
}

interface CampaignSearchProps {
  campaigns: Campaign[];
  selectedCampaign?: string;
  onCampaignSelect: (campaignId: string) => void;
  placeholder?: string;
  className?: string;
}

export function CampaignSearch({
  campaigns,
  selectedCampaign,
  onCampaignSelect,
  placeholder = 'Buscar campanha...',
  className
}: CampaignSearchProps) {
  const [searchValue, setSearchValue] = useState(selectedCampaign || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setSearchValue(selectedCampaign || '');
  }, [selectedCampaign]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'PAUSED': return 'bg-yellow-100 text-yellow-800';
      case 'ARCHIVED': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const selectedCampaignData = campaigns.find(c => c.id === searchValue);
  const selectedLabel = selectedCampaignData ? selectedCampaignData.name : 
                       (searchValue === '' ? 'Todas as campanhas' : placeholder);

  // Filtrar campanhas baseado na busca
  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.objective.toLowerCase().includes(searchTerm.toLowerCase()) ||
    translateMetaObjective(campaign.objective).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCampaignSelect = (campaignId: string) => {
    setSearchValue(campaignId);
    onCampaignSelect(campaignId);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={className}>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => setIsOpen(!isOpen)}
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{selectedLabel}</span>
            </div>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-full min-w-[400px] p-0" align="start">
          <div className="p-2">
            <Input
              placeholder="Digite para buscar campanhas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-2"
            />
          </div>
          
          <div className="max-h-64 overflow-auto">
            <DropdownMenuItem
              onClick={() => handleCampaignSelect('')}
              className="flex flex-col items-start p-3"
            >
              <div className="font-medium">Todas as campanhas</div>
              <div className="text-xs text-muted-foreground">
                {campaigns.length} campanhas disponíveis
              </div>
            </DropdownMenuItem>
            
            {filteredCampaigns.length === 0 ? (
              <div className="p-3 text-center text-muted-foreground">
                Nenhuma campanha encontrada
              </div>
            ) : (
              filteredCampaigns.map((campaign) => (
                <DropdownMenuItem
                  key={campaign.id}
                  onClick={() => handleCampaignSelect(campaign.id)}
                  className="flex flex-col items-start p-3"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="font-medium truncate">{campaign.name}</div>
                    <Badge className={getStatusColor(campaign.status)}>
                      {translateMetaStatus(campaign.status)}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {campaign.account_name} • {formatCurrency(campaign.spend)} • {formatNumber(campaign.impressions)} imp
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {searchValue && selectedCampaignData && (
        <div className="mt-2 p-3 bg-muted/50 rounded-lg">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{selectedCampaignData.name}</h4>
              <Badge className={getStatusColor(selectedCampaignData.status)}>
                {translateMetaStatus(selectedCampaignData.status)}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Gasto:</span>
                <div className="font-medium">{formatCurrency(selectedCampaignData.spend)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Impressões:</span>
                <div className="font-medium">{formatNumber(selectedCampaignData.impressions)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Cliques:</span>
                <div className="font-medium">{formatNumber(selectedCampaignData.clicks)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">CTR:</span>
                <div className="font-medium">{selectedCampaignData.ctr.toFixed(2)}%</div>
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground">
              Conta: {selectedCampaignData.account_name} • Objetivo: {translateMetaObjective(selectedCampaignData.objective)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}