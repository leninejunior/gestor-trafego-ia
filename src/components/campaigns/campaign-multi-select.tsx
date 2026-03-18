'use client'

import { useState, useMemo } from 'react'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface Campaign {
  id: string
  name: string
  status: string
  account_name?: string
}

interface CampaignMultiSelectProps {
  campaigns: Campaign[]
  selectedCampaigns: string[]
  onSelectionChange: (campaignIds: string[]) => void
  maxSelection?: number
  placeholder?: string
  className?: string
}

export function CampaignMultiSelect({
  campaigns,
  selectedCampaigns,
  onSelectionChange,
  maxSelection,
  placeholder = 'Selecionar campanhas...',
  className
}: CampaignMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Filtrar campanhas baseado na busca
  const filteredCampaigns = useMemo(() => {
    if (!searchTerm) return campaigns
    
    const term = searchTerm.toLowerCase()
    return campaigns.filter(campaign =>
      campaign.name.toLowerCase().includes(term) ||
      campaign.account_name?.toLowerCase().includes(term)
    )
  }, [campaigns, searchTerm])

  // Campanhas selecionadas
  const selectedCampaignsData = useMemo(() => {
    return campaigns.filter(c => selectedCampaigns.includes(c.id))
  }, [campaigns, selectedCampaigns])

  // Toggle seleção de campanha
  const toggleCampaign = (campaignId: string) => {
    const isSelected = selectedCampaigns.includes(campaignId)
    
    if (isSelected) {
      // Remover
      onSelectionChange(selectedCampaigns.filter(id => id !== campaignId))
    } else {
      // Adicionar (verificar limite)
      if (maxSelection && selectedCampaigns.length >= maxSelection) {
        return // Não adicionar se atingiu o limite
      }
      onSelectionChange([...selectedCampaigns, campaignId])
    }
  }

  // Selecionar todas
  const selectAll = () => {
    if (maxSelection) {
      onSelectionChange(filteredCampaigns.slice(0, maxSelection).map(c => c.id))
    } else {
      onSelectionChange(filteredCampaigns.map(c => c.id))
    }
  }

  // Limpar seleção
  const clearSelection = () => {
    onSelectionChange([])
  }

  // Remover campanha específica
  const removeCampaign = (campaignId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onSelectionChange(selectedCampaigns.filter(id => id !== campaignId))
  }

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <div className="flex items-center gap-2 flex-1 overflow-hidden">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              {selectedCampaigns.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                <span className="truncate">
                  {selectedCampaigns.length} campanha{selectedCampaigns.length > 1 ? 's' : ''} selecionada{selectedCampaigns.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full min-w-[400px] p-0" align="start">
          {/* Busca */}
          <div className="p-2 border-b">
            <Input
              placeholder="Buscar campanhas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9"
            />
          </div>

          {/* Ações */}
          <div className="flex items-center justify-between p-2 border-b bg-muted/50">
            <div className="text-xs text-muted-foreground">
              {selectedCampaigns.length} de {campaigns.length} selecionadas
              {maxSelection && ` (máx: ${maxSelection})`}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                disabled={filteredCampaigns.length === 0}
                className="h-7 text-xs"
              >
                Selecionar todas
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                disabled={selectedCampaigns.length === 0}
                className="h-7 text-xs"
              >
                Limpar
              </Button>
            </div>
          </div>

          {/* Lista de campanhas */}
          <div className="max-h-64 overflow-auto">
            {filteredCampaigns.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Nenhuma campanha encontrada
              </div>
            ) : (
              filteredCampaigns.map((campaign) => {
                const isSelected = selectedCampaigns.includes(campaign.id)
                const isDisabled = !isSelected && maxSelection && selectedCampaigns.length >= maxSelection

                return (
                  <button
                    key={campaign.id}
                    onClick={() => !isDisabled && toggleCampaign(campaign.id)}
                    disabled={isDisabled}
                    className={cn(
                      'w-full flex items-center gap-2 p-3 text-left hover:bg-muted/50 transition-colors',
                      isSelected && 'bg-muted',
                      isDisabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded border',
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-input'
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{campaign.name}</div>
                      {campaign.account_name && (
                        <div className="text-xs text-muted-foreground truncate">
                          {campaign.account_name}
                        </div>
                      )}
                    </div>
                    <Badge
                      variant={campaign.status === 'ACTIVE' ? 'default' : 'secondary'}
                      className="shrink-0"
                    >
                      {campaign.status}
                    </Badge>
                  </button>
                )
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Badges das campanhas selecionadas */}
      {selectedCampaignsData.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedCampaignsData.map((campaign) => (
            <Badge
              key={campaign.id}
              variant="secondary"
              className="pl-2 pr-1 py-1"
            >
              <span className="max-w-[200px] truncate">{campaign.name}</span>
              <button
                onClick={(e) => removeCampaign(campaign.id, e)}
                className="ml-1 rounded-full hover:bg-muted p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
