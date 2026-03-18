'use client';

/**
 * Export Button Component
 * 
 * Provides export functionality for campaign data with platform selection
 * Requirements: 12.1, 12.2, 12.3
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExportConfigDialog } from './export-config-dialog';
import { ChevronDown, FileText, Database } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Download } from 'lucide-react';

export interface ExportButtonProps {
  clientId: string;
  platform?: 'meta' | 'google' | 'unified';
  campaignIds?: string[];
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function ExportButton({
  clientId,
  platform,
  campaignIds,
  disabled = false,
  variant = 'outline',
  size = 'default',
  className,
}: ExportButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'json'>('csv');
  const [selectedPlatform, setSelectedPlatform] = useState<'meta' | 'google' | 'unified'>(
    platform || 'unified'
  );

  const handleQuickExport = (format: 'csv' | 'json', exportPlatform: 'meta' | 'google' | 'unified') => {
    setSelectedFormat(format);
    setSelectedPlatform(exportPlatform);
    setIsDialogOpen(true);
  };

  const getPlatformLabel = (p: string) => {
    switch (p) {
      case 'meta': return 'Meta Ads';
      case 'google': return 'Google Ads';
      case 'unified': return 'Todas as Plataformas';
      default: return p;
    }
  };

  if (platform) {
    // Single platform mode - show simple button
    return (
      <>
        <Button
          variant={variant}
          size={size}
          className={className}
          disabled={disabled}
          onClick={() => setIsDialogOpen(true)}
        >
          <ChevronDown className="h-4 w-4 mr-2" />
          Exportar {getPlatformLabel(platform)}
        </Button>

        <ExportConfigDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          clientId={clientId}
          defaultPlatform={platform}
          defaultFormat={selectedFormat}
          campaignIds={campaignIds}
        />
      </>
    );
  }

  // Multi-platform mode - show dropdown menu
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className={className}
            disabled={disabled}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar Dados
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {/* Quick CSV exports */}
          <DropdownMenuItem onClick={() => handleQuickExport('csv', 'unified')}>
            <FileText className="h-4 w-4 mr-2" />
            CSV - Todas as Plataformas
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleQuickExport('csv', 'meta')}>
            <FileText className="h-4 w-4 mr-2" />
            CSV - Meta Ads
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleQuickExport('csv', 'google')}>
            <FileText className="h-4 w-4 mr-2" />
            CSV - Google Ads
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* Quick JSON exports */}
          <DropdownMenuItem onClick={() => handleQuickExport('json', 'unified')}>
            <Database className="h-4 w-4 mr-2" />
            JSON - Todas as Plataformas
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleQuickExport('json', 'meta')}>
            <Database className="h-4 w-4 mr-2" />
            JSON - Meta Ads
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleQuickExport('json', 'google')}>
            <Database className="h-4 w-4 mr-2" />
            JSON - Google Ads
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ExportConfigDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        clientId={clientId}
        defaultPlatform={selectedPlatform}
        defaultFormat={selectedFormat}
        campaignIds={campaignIds}
      />
    </>
  );
}