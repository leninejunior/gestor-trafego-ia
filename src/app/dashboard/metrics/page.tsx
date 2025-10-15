'use client';

import { useState } from 'react';
import { CustomMetricBuilder } from '@/components/metrics/custom-metric-builder';
import { CustomMetricsList } from '@/components/metrics/custom-metrics-list';
import { CustomMetric } from '@/lib/types/custom-metrics';
import { useToast } from '@/hooks/use-toast';

export default function MetricsPage() {
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [editingMetric, setEditingMetric] = useState<CustomMetric | null>(null);
  const { toast } = useToast();

  const handleCreateNew = () => {
    setEditingMetric(null);
    setView('create');
  };

  const handleEdit = (metric: CustomMetric) => {
    setEditingMetric(metric);
    setView('edit');
  };

  const handleSave = async (metricData: Partial<CustomMetric>) => {
    try {
      const isEditing = view === 'edit' && editingMetric;
      const url = '/api/metrics/custom';
      const method = isEditing ? 'PUT' : 'POST';
      const body = isEditing 
        ? { id: editingMetric.id, ...metricData }
        : metricData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: `Métrica ${isEditing ? 'atualizada' : 'criada'} com sucesso`,
        });
        setView('list');
        setEditingMetric(null);
      } else {
        toast({
          title: 'Erro',
          description: data.error || `Erro ao ${isEditing ? 'atualizar' : 'criar'} métrica`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: `Erro ao ${view === 'edit' ? 'atualizar' : 'criar'} métrica`,
        variant: 'destructive',
      });
    }
  };

  const handleCancel = () => {
    setView('list');
    setEditingMetric(null);
  };

  if (view === 'create' || view === 'edit') {
    return (
      <CustomMetricBuilder
        onSave={handleSave}
        onCancel={handleCancel}
        initialData={editingMetric || undefined}
      />
    );
  }

  return (
    <CustomMetricsList
      onCreateNew={handleCreateNew}
      onEdit={handleEdit}
    />
  );
}