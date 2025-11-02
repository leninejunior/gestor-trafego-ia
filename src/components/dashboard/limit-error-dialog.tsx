'use client';

import { AlertCircle, Crown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface LimitErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limitType: 'clients' | 'campaigns';
  current: number;
  limit: number;
}

export function LimitErrorDialog({
  open,
  onOpenChange,
  limitType,
  current,
  limit
}: LimitErrorDialogProps) {
  const titles = {
    clients: 'Limite de Clientes Atingido',
    campaigns: 'Limite de Campanhas Atingido'
  };

  const descriptions = {
    clients: 'Você atingiu o limite de clientes permitido pelo seu plano atual.',
    campaigns: 'Você atingiu o limite de campanhas permitido pelo seu plano atual.'
  };

  const labels = {
    clients: 'Clientes',
    campaigns: 'Campanhas'
  };

  const benefits = {
    clients: [
      'Mais clientes para gerenciar',
      'Maior retenção de dados históricos',
      'Sincronização mais frequente',
      'Exportação de dados avançada'
    ],
    campaigns: [
      'Mais campanhas por cliente',
      'Maior retenção de dados históricos',
      'Sincronização mais frequente',
      'Exportação de dados avançada'
    ]
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            {titles[limitType]}
          </DialogTitle>
          <DialogDescription>
            {descriptions[limitType]}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">{labels[limitType]} Atuais</span>
              <span className="text-lg font-bold text-orange-600">
                {current} / {limit === -1 ? '∞' : limit}
              </span>
            </div>
            <div className="text-xs text-gray-600">
              Para adicionar mais {limitType === 'clients' ? 'clientes' : 'campanhas'}, faça upgrade do seu plano.
            </div>
          </div>

          <div className="space-y-2 text-sm text-gray-600">
            <p>Com um plano superior você terá:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              {benefits[limitType].map((benefit, index) => (
                <li key={index}>{benefit}</li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            asChild
            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Link href="/dashboard/billing">
              <Crown className="w-4 h-4 mr-2" />
              Ver Planos
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
