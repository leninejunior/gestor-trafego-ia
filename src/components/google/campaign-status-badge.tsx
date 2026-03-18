'use client';

import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  Pause, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Loader2
} from "lucide-react";

export type CampaignStatus = 
  | 'ENABLED' 
  | 'PAUSED' 
  | 'REMOVED' 
  | 'DRAFT' 
  | 'PENDING' 
  | 'SUSPENDED'
  | 'UNKNOWN';

interface GoogleCampaignStatusBadgeProps {
  status: CampaignStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline' | 'secondary';
}

interface StatusConfig {
  label: string;
  variant: 'default' | 'destructive' | 'secondary' | 'outline';
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  description: string;
}

const STATUS_CONFIG: Record<CampaignStatus, StatusConfig> = {
  ENABLED: {
    label: 'Ativa',
    variant: 'default',
    color: 'text-green-800',
    bgColor: 'bg-green-100',
    icon: <CheckCircle className="w-3 h-3" />,
    description: 'Campanha está rodando e pode receber tráfego',
  },
  PAUSED: {
    label: 'Pausada',
    variant: 'secondary',
    color: 'text-yellow-800',
    bgColor: 'bg-yellow-100',
    icon: <Pause className="w-3 h-3" />,
    description: 'Campanha está pausada e não recebe tráfego',
  },
  REMOVED: {
    label: 'Removida',
    variant: 'destructive',
    color: 'text-red-800',
    bgColor: 'bg-red-100',
    icon: <XCircle className="w-3 h-3" />,
    description: 'Campanha foi removida e não pode ser reativada',
  },
  DRAFT: {
    label: 'Rascunho',
    variant: 'outline',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    icon: <Clock className="w-3 h-3" />,
    description: 'Campanha está em modo rascunho',
  },
  PENDING: {
    label: 'Pendente',
    variant: 'outline',
    color: 'text-blue-800',
    bgColor: 'bg-blue-100',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    description: 'Campanha está sendo processada',
  },
  SUSPENDED: {
    label: 'Suspensa',
    variant: 'destructive',
    color: 'text-orange-800',
    bgColor: 'bg-orange-100',
    icon: <AlertTriangle className="w-3 h-3" />,
    description: 'Campanha foi suspensa por violação de políticas',
  },
  UNKNOWN: {
    label: 'Desconhecido',
    variant: 'secondary',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    icon: <AlertTriangle className="w-3 h-3" />,
    description: 'Status da campanha não identificado',
  },
};

export function GoogleCampaignStatusBadge({ 
  status, 
  showIcon = true, 
  size = 'md',
  variant 
}: GoogleCampaignStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.UNKNOWN;
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const badgeVariant = variant || config.variant;

  return (
    <Badge 
      variant={badgeVariant}
      className={`
        ${sizeClasses[size]} 
        ${badgeVariant === 'default' ? `${config.bgColor} ${config.color} hover:${config.bgColor}` : ''}
        inline-flex items-center gap-1.5 font-medium
      `}
      title={config.description}
    >
      {showIcon && config.icon}
      {config.label}
    </Badge>
  );
}

// Helper function to get status color for use in other components
export function getStatusColor(status: CampaignStatus): string {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.UNKNOWN;
  return config.color;
}

// Helper function to get status background color
export function getStatusBgColor(status: CampaignStatus): string {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.UNKNOWN;
  return config.bgColor;
}

// Helper function to check if status is active
export function isActiveStatus(status: CampaignStatus): boolean {
  return status === 'ENABLED';
}

// Helper function to check if status allows editing
export function isEditableStatus(status: CampaignStatus): boolean {
  return ['ENABLED', 'PAUSED', 'DRAFT'].includes(status);
}

// Helper function to get all possible statuses for filters
export function getAllStatuses(): { value: CampaignStatus; label: string }[] {
  return Object.entries(STATUS_CONFIG).map(([value, config]) => ({
    value: value as CampaignStatus,
    label: config.label,
  }));
}

// Component for displaying status with additional info
interface CampaignStatusInfoProps {
  status: CampaignStatus;
  lastModified?: string;
  showDescription?: boolean;
}

export function GoogleCampaignStatusInfo({ 
  status, 
  lastModified, 
  showDescription = false 
}: CampaignStatusInfoProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.UNKNOWN;

  return (
    <div className="flex flex-col gap-1">
      <GoogleCampaignStatusBadge status={status} />
      
      {showDescription && (
        <p className="text-xs text-muted-foreground">
          {config.description}
        </p>
      )}
      
      {lastModified && (
        <p className="text-xs text-muted-foreground">
          Modificado: {new Date(lastModified).toLocaleDateString('pt-BR')}
        </p>
      )}
    </div>
  );
}

// Bulk status component for showing multiple statuses
interface CampaignStatusSummaryProps {
  statuses: { status: CampaignStatus; count: number }[];
  total: number;
}

export function GoogleCampaignStatusSummary({ statuses, total }: CampaignStatusSummaryProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map(({ status, count }) => (
        <div key={status} className="flex items-center gap-1">
          <GoogleCampaignStatusBadge status={status} size="sm" />
          <span className="text-sm text-muted-foreground">
            {count} ({((count / total) * 100).toFixed(1)}%)
          </span>
        </div>
      ))}
    </div>
  );
}