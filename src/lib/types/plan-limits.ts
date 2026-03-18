import { z } from 'zod';

/**
 * Interface completa para limites de plano
 * Baseado nos requisitos 1.1, 1.2 do documento de requirements
 */
export interface PlanLimits {
  id: string;
  plan_id: string;
  
  // Limites de recursos
  max_clients: number;           // -1 = ilimitado
  max_campaigns_per_client: number; // -1 = ilimitado
  
  // Cache e retenção
  data_retention_days: number;   // 30-3650 dias
  sync_interval_hours: number;   // 1-168 horas
  
  // Exportação
  allow_csv_export: boolean;
  allow_json_export: boolean;
  
  // Metadados
  created_at: string;
  updated_at: string;
}

/**
 * Schema Zod para validação de PlanLimits
 * Garante que todos os valores estejam dentro dos limites especificados
 */
export const PlanLimitsSchema = z.object({
  id: z.string().uuid().optional(),
  plan_id: z.string().uuid(),
  
  // Limites de recursos - validação: >= -1 (onde -1 = ilimitado)
  max_clients: z.number().int().min(-1, 'max_clients deve ser -1 (ilimitado) ou maior que 0'),
  max_campaigns_per_client: z.number().int().min(-1, 'max_campaigns_per_client deve ser -1 (ilimitado) ou maior que 0'),
  
  // Cache e retenção - validação conforme requisitos
  data_retention_days: z.number().int().min(30, 'data_retention_days deve ser no mínimo 30 dias')
    .max(3650, 'data_retention_days deve ser no máximo 3650 dias (10 anos)'),
  sync_interval_hours: z.number().int().min(1, 'sync_interval_hours deve ser no mínimo 1 hora')
    .max(168, 'sync_interval_hours deve ser no máximo 168 horas (7 dias)'),
  
  // Exportação
  allow_csv_export: z.boolean(),
  allow_json_export: z.boolean(),
  
  // Metadados
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

/**
 * Schema para criação de PlanLimits (sem id e timestamps)
 */
export const CreatePlanLimitsSchema = PlanLimitsSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

/**
 * Schema para atualização parcial de PlanLimits
 */
export const UpdatePlanLimitsSchema = PlanLimitsSchema.partial().omit({
  id: true,
  plan_id: true,
  created_at: true,
  updated_at: true,
});

/**
 * Tipo para criação de PlanLimits
 */
export type CreatePlanLimits = z.infer<typeof CreatePlanLimitsSchema>;

/**
 * Tipo para atualização de PlanLimits
 */
export type UpdatePlanLimits = z.infer<typeof UpdatePlanLimitsSchema>;

/**
 * Resultado de validação
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Valores padrão para PlanLimits
 * Conforme especificado nos requisitos
 */
export const DEFAULT_PLAN_LIMITS: Omit<CreatePlanLimits, 'plan_id'> = {
  max_clients: 5,
  max_campaigns_per_client: 25,
  data_retention_days: 90,
  sync_interval_hours: 24,
  allow_csv_export: false,
  allow_json_export: false,
};

/**
 * Helper para verificar se um limite é ilimitado
 */
export function isUnlimited(value: number): boolean {
  return value === -1;
}

/**
 * Helper para formatar limite para exibição
 */
export function formatLimit(value: number, unit?: string): string {
  if (isUnlimited(value)) {
    return 'Ilimitado';
  }
  return unit ? `${value} ${unit}` : value.toString();
}
