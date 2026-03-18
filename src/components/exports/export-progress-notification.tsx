'use client';

/**
 * Export Progress Notification Component
 * 
 * Shows export progress notifications and handles completion
 * Requirements: 12.1, 12.2, 12.3
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { 
  ArrowDown, 
  CheckCircle, 
  AlertCircle, 
  RotateCw, 
  X,
  File,
  Database,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';

export interface ExportJob {
  id: string;
  format: 'csv' | 'json';
  platform: 'meta' | 'google' | 'unified';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  downloadUrl?: string;
  error?: string;
  fileName?: string;
  fileSize?: number;
  recordCount?: number;
  createdAt: string;
  completedAt?: string;
}

export interface ExportProgressNotificationProps {
  jobs: ExportJob[];
  onDismiss: (jobId: string) => void;
  onDownload: (job: ExportJob) => void;
  className?: string;
}

export function ExportProgressNotification({
  jobs,
  onDismiss,
  onDownload,
  className,
}: ExportProgressNotificationProps) {
  const { toast } = useToast();

  if (jobs.length === 0) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
      case 'pending':
        return <RotateCw className="h-4 w-4 animate-spin text-blue-500" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Aguardando';
      case 'processing':
        return 'Processando';
      case 'completed':
        return 'Concluído';
      case 'failed':
        return 'Falhou';
      default:
        return status;
    }
  };

  const getPlatformLabel = (platform: string) => {
    switch (platform) {
      case 'meta':
        return 'Meta Ads';
      case 'google':
        return 'Google Ads';
      case 'unified':
        return 'Todas as Plataformas';
      default:
        return platform;
    }
  };

  const getFormatIcon = (format: string) => {
    return format === 'csv' ? (
      <File className="h-4 w-4" />
    ) : (
      <Database className="h-4 w-4" />
    );
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
  };

  const handleDownload = (job: ExportJob) => {
    onDownload(job);
    
    toast({
      title: 'Download iniciado',
      description: `Baixando ${job.fileName || 'arquivo de exportação'}`,
    });
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {jobs.map((job) => (
        <Card key={job.id} className="relative">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getFormatIcon(job.format)}
                <CardTitle className="text-sm">
                  Exportação {job.format.toUpperCase()} - {getPlatformLabel(job.platform)}
                </CardTitle>
                <Badge variant={
                  job.status === 'completed' ? 'default' :
                  job.status === 'failed' ? 'destructive' :
                  'secondary'
                }>
                  {getStatusLabel(job.status)}
                </Badge>
              </div>
              
              <div className="flex items-center space-x-2">
                {getStatusIcon(job.status)}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDismiss(job.id)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <CardDescription className="text-xs">
              Iniciado em {format(new Date(job.createdAt), "dd/MM/yyyy 'às' HH:mm")}
              {job.completedAt && (
                <> • Concluído em {format(new Date(job.completedAt), "dd/MM/yyyy 'às' HH:mm")}</>
              )}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-0">
            {/* Progress Bar */}
            {job.status === 'processing' && job.progress !== undefined && (
              <div className="space-y-2 mb-3">
                <Progress value={job.progress} className="w-full" />
                <p className="text-xs text-muted-foreground text-center">
                  {job.progress}% concluído
                </p>
              </div>
            )}

            {/* Success State */}
            {job.status === 'completed' && (
              <div className="space-y-3">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Exportação concluída com sucesso!
                    {job.recordCount && (
                      <> {job.recordCount.toLocaleString()} registros exportados.</>
                    )}
                    {job.fileSize && (
                      <> Tamanho do arquivo: {formatFileSize(job.fileSize)}</>
                    )}
                  </AlertDescription>
                </Alert>

                {job.downloadUrl && (
                  <Button
                    onClick={() => handleDownload(job)}
                    className="w-full"
                    size="sm"
                  >
                    <ArrowDown className="h-4 w-4 mr-2" />
                    Baixar Arquivo
                  </Button>
                )}
              </div>
            )}

            {/* Error State */}
            {job.status === 'failed' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {job.error || 'Erro durante a exportação. Tente novamente.'}
                </AlertDescription>
              </Alert>
            )}

            {/* Processing State */}
            {(job.status === 'processing' || job.status === 'pending') && (
              <div className="flex items-center justify-center py-2">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {job.status === 'pending' ? 'Aguardando processamento...' : 'Processando dados...'}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}