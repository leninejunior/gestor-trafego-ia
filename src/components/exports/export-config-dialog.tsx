'use client';

/**
 * Export Configuration Dialog
 * 
 * Modal for configuring export parameters and monitoring progress
 * Requirements: 12.1, 12.2, 12.3
 */

import { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon, Download, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface ExportConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  defaultPlatform?: 'meta' | 'google' | 'unified';
  defaultFormat?: 'csv' | 'json';
  campaignIds?: string[];
}

interface ExportJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  downloadUrl?: string;
  error?: string;
}

const AVAILABLE_METRICS = [
  { id: 'impressions', label: 'Impressões' },
  { id: 'clicks', label: 'Cliques' },
  { id: 'conversions', label: 'Conversões' },
  { id: 'spend', label: 'Gasto' },
  { id: 'ctr', label: 'CTR' },
  { id: 'cpc', label: 'CPC' },
  { id: 'cpa', label: 'CPA' },
  { id: 'roas', label: 'ROAS' },
  { id: 'conversion_rate', label: 'Taxa de Conversão' },
];

export function ExportConfigDialog({
  isOpen,
  onClose,
  clientId,
  defaultPlatform = 'unified',
  defaultFormat = 'csv',
  campaignIds,
}: ExportConfigDialogProps) {
  const { toast } = useToast();
  
  // Form state
  const [platform, setPlatform] = useState<'meta' | 'google' | 'unified'>(defaultPlatform);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>(defaultFormat);
  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    'impressions', 'clicks', 'conversions', 'spend', 'ctr', 'cpc'
  ]);
  
  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setPlatform(defaultPlatform);
      setExportFormat(defaultFormat);
      setDateFrom(subDays(new Date(), 30));
      setDateTo(new Date());
      setSelectedMetrics(['impressions', 'clicks', 'conversions', 'spend', 'ctr', 'cpc']);
      setExportJob(null);
      setIsExporting(false);
    }
  }, [isOpen, defaultPlatform, defaultFormat]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval]);

  const handleMetricToggle = (metricId: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metricId)
        ? prev.filter(id => id !== metricId)
        : [...prev, metricId]
    );
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);

      const exportData = {
        clientId,
        format: exportFormat,
        dateFrom: dateFrom.toISOString().split('T')[0],
        dateTo: dateTo.toISOString().split('T')[0],
        ...(platform !== 'unified' && { platform }),
        ...(campaignIds && { campaignIds }),
        ...(selectedMetrics.length > 0 && { metrics: selectedMetrics }),
      };

      // Choose the appropriate endpoint
      let endpoint = `/api/exports/${exportFormat}`;
      if (platform === 'google') {
        endpoint = '/api/exports/google';
      } else if (platform === 'unified') {
        endpoint = '/api/exports/unified';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Falha ao iniciar exportação');
      }

      // Set initial job state
      setExportJob({
        id: result.export.id,
        status: 'processing',
        progress: 0,
      });

      // Start polling for status
      startPolling(result.export.id);

      toast({
        title: 'Exportação iniciada',
        description: 'Sua exportação está sendo processada. Você será notificado quando estiver pronta.',
      });

    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Erro na exportação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setIsExporting(false);
    }
  };

  const startPolling = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/exports/${jobId}/download`);
        const result = await response.json();

        if (response.ok && result.success) {
          setExportJob({
            id: jobId,
            status: result.export.status,
            progress: result.export.status === 'completed' ? 100 : 75,
            downloadUrl: result.export.downloadUrl,
          });

          if (result.export.status === 'completed') {
            clearInterval(interval);
            setPollInterval(null);
            setIsExporting(false);
            
            toast({
              title: 'Exportação concluída',
              description: 'Seu arquivo está pronto para download.',
            });
          }
        } else if (result.status === 'failed') {
          setExportJob({
            id: jobId,
            status: 'failed',
            error: result.error || 'Exportação falhou',
          });
          
          clearInterval(interval);
          setPollInterval(null);
          setIsExporting(false);
          
          toast({
            title: 'Exportação falhou',
            description: result.error || 'Erro desconhecido durante a exportação',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000); // Poll every 2 seconds

    setPollInterval(interval);
  };

  const handleDownload = () => {
    if (exportJob?.downloadUrl) {
      window.open(exportJob.downloadUrl, '_blank');
      
      toast({
        title: 'Download iniciado',
        description: 'O arquivo será baixado em breve.',
      });
    }
  };

  const handleClose = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
    setIsExporting(false);
    setExportJob(null);
    onClose();
  };

  const getPlatformLabel = (p: string) => {
    switch (p) {
      case 'meta': return 'Meta Ads';
      case 'google': return 'Google Ads';
      case 'unified': return 'Todas as Plataformas';
      default: return p;
    }
  };

  const canExport = !isExporting && selectedMetrics.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Exportar Dados de Campanhas</DialogTitle>
          <DialogDescription>
            Configure os parâmetros da exportação e monitore o progresso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Platform Selection */}
          <div className="space-y-2">
            <Label htmlFor="platform">Plataforma</Label>
            <Select value={platform} onValueChange={(value) => setPlatform(value as 'meta' | 'google' | 'unified')}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a plataforma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unified">Todas as Plataformas</SelectItem>
                <SelectItem value="meta">Meta Ads</SelectItem>
                <SelectItem value="google">Google Ads</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Format Selection */}
          <div className="space-y-2">
            <Label htmlFor="format">Formato</Label>
            <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as 'csv' | 'json')}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o formato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV (Excel)</SelectItem>
                <SelectItem value="json">JSON (Dados estruturados)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(date) => date && setDateFrom(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data Final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(date) => date && setDateTo(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Metrics Selection */}
          <div className="space-y-2">
            <Label>Métricas para Exportar</Label>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
              {AVAILABLE_METRICS.map((metric) => (
                <div key={metric.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={metric.id}
                    checked={selectedMetrics.includes(metric.id)}
                    onCheckedChange={() => handleMetricToggle(metric.id)}
                  />
                  <Label htmlFor={metric.id} className="text-sm">
                    {metric.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Export Progress */}
          {exportJob && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Status da Exportação</Label>
                {exportJob.status === 'completed' && (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
                {exportJob.status === 'failed' && (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
                {(exportJob.status === 'processing' || exportJob.status === 'pending') && (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                )}
              </div>

              {exportJob.progress !== undefined && (
                <Progress value={exportJob.progress} className="w-full" />
              )}

              {exportJob.status === 'completed' && exportJob.downloadUrl && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Exportação concluída com sucesso! Clique no botão abaixo para fazer o download.
                  </AlertDescription>
                </Alert>
              )}

              {exportJob.status === 'failed' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {exportJob.error || 'Erro durante a exportação'}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {exportJob?.status === 'completed' ? 'Fechar' : 'Cancelar'}
          </Button>
          
          {exportJob?.status === 'completed' && exportJob.downloadUrl ? (
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Baixar Arquivo
            </Button>
          ) : (
            <Button onClick={handleExport} disabled={!canExport}>
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar {getPlatformLabel(platform)}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}