'use client';

/**
 * Export Manager Hook
 * 
 * Manages export jobs state and provides utilities for export operations
 * Requirements: 12.1, 12.2, 12.3
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

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

export interface ExportRequest {
  clientId: string;
  format: 'csv' | 'json';
  platform: 'meta' | 'google' | 'unified';
  dateFrom: string;
  dateTo: string;
  campaignIds?: string[];
  metrics?: string[];
}

export function useExportManager() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load jobs from localStorage on mount
  useEffect(() => {
    const savedJobs = localStorage.getItem('exportJobs');
    if (savedJobs) {
      try {
        const parsedJobs = JSON.parse(savedJobs);
        setJobs(parsedJobs);
        
        // Resume polling for incomplete jobs
        parsedJobs.forEach((job: ExportJob) => {
          if (job.status === 'processing' || job.status === 'pending') {
            startPolling(job.id);
          }
        });
      } catch (error) {
        console.error('Failed to load export jobs:', error);
      }
    }
  }, []);

  // Save jobs to localStorage whenever jobs change
  useEffect(() => {
    localStorage.setItem('exportJobs', JSON.stringify(jobs));
  }, [jobs]);

  const updateJob = useCallback((jobId: string, updates: Partial<ExportJob>) => {
    setJobs(prev => prev.map(job => 
      job.id === jobId ? { ...job, ...updates } : job
    ));
  }, []);

  const addJob = useCallback((job: ExportJob) => {
    setJobs(prev => [job, ...prev]);
  }, []);

  const removeJob = useCallback((jobId: string) => {
    setJobs(prev => prev.filter(job => job.id !== jobId));
  }, []);

  const startPolling = useCallback((jobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/exports/${jobId}/download`);
        const result = await response.json();

        if (response.ok && result.success) {
          const exportData = result.export;
          
          updateJob(jobId, {
            status: exportData.status,
            progress: exportData.status === 'completed' ? 100 : 75,
            downloadUrl: exportData.downloadUrl,
            fileName: exportData.fileName,
            fileSize: exportData.fileSize,
            recordCount: exportData.recordCount,
            completedAt: exportData.completedAt,
          });

          if (exportData.status === 'completed') {
            clearInterval(pollInterval);
            
            toast({
              title: 'Exportação concluída',
              description: 'Seu arquivo está pronto para download.',
            });
          } else if (exportData.status === 'failed') {
            clearInterval(pollInterval);
            
            updateJob(jobId, {
              status: 'failed',
              error: result.error || 'Exportação falhou',
            });
            
            toast({
              title: 'Exportação falhou',
              description: result.error || 'Erro desconhecido durante a exportação',
              variant: 'destructive',
            });
          }
        } else if (result.status === 'failed') {
          clearInterval(pollInterval);
          
          updateJob(jobId, {
            status: 'failed',
            error: result.error || 'Exportação falhou',
          });
          
          toast({
            title: 'Exportação falhou',
            description: result.error || 'Erro desconhecido durante a exportação',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Polling error:', error);
        // Don't clear interval on network errors, keep trying
      }
    }, 3000); // Poll every 3 seconds

    // Store interval reference to clean up later
    return pollInterval;
  }, [updateJob, toast]);

  const startExport = useCallback(async (request: ExportRequest): Promise<string> => {
    setIsLoading(true);
    
    try {
      // Choose the appropriate endpoint
      let endpoint = `/api/exports/${request.format}`;
      if (request.platform === 'google') {
        endpoint = '/api/exports/google';
      } else if (request.platform === 'unified') {
        endpoint = '/api/exports/unified';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Falha ao iniciar exportação');
      }

      // Create job entry
      const job: ExportJob = {
        id: result.export.id,
        format: request.format,
        platform: request.platform,
        status: 'processing',
        progress: 0,
        createdAt: new Date().toISOString(),
      };

      addJob(job);
      startPolling(job.id);

      toast({
        title: 'Exportação iniciada',
        description: 'Sua exportação está sendo processada. Você será notificado quando estiver pronta.',
      });

      return job.id;
    } catch (error) {
      console.error('Export error:', error);
      
      toast({
        title: 'Erro na exportação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [addJob, startPolling, toast]);

  const downloadExport = useCallback((job: ExportJob) => {
    if (job.downloadUrl) {
      // Create a temporary link to trigger download
      const link = document.createElement('a');
      link.href = job.downloadUrl;
      link.download = job.fileName || `export-${job.id}.${job.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: 'Download iniciado',
        description: `Baixando ${job.fileName || 'arquivo de exportação'}`,
      });
    }
  }, [toast]);

  const dismissJob = useCallback((jobId: string) => {
    removeJob(jobId);
  }, [removeJob]);

  const clearCompletedJobs = useCallback(() => {
    setJobs(prev => prev.filter(job => 
      job.status !== 'completed' && job.status !== 'failed'
    ));
  }, []);

  const getActiveJobs = useCallback(() => {
    return jobs.filter(job => 
      job.status === 'processing' || job.status === 'pending'
    );
  }, [jobs]);

  const getCompletedJobs = useCallback(() => {
    return jobs.filter(job => job.status === 'completed');
  }, [jobs]);

  const getFailedJobs = useCallback(() => {
    return jobs.filter(job => job.status === 'failed');
  }, [jobs]);

  return {
    jobs,
    isLoading,
    startExport,
    downloadExport,
    dismissJob,
    clearCompletedJobs,
    getActiveJobs,
    getCompletedJobs,
    getFailedJobs,
  };
}