"use client";

import { Button } from "@/components/ui/button";
import { Crown, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

interface UpgradePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
  currentUsage?: number;
  limit?: number;
  title: string;
  description: string;
}

export function UpgradePrompt({
  open,
  onOpenChange,
  feature,
  currentUsage = 0,
  limit = 0,
  title,
  description
}: UpgradePromptProps) {
  const usagePercentage = limit > 0 ? (currentUsage / limit) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Crown className="w-6 h-6 text-orange-600" />
            </div>
            <DialogTitle className="text-xl">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Usage Display */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Uso atual</span>
              <span className="font-medium">{currentUsage} de {limit}</span>
            </div>
            <Progress value={usagePercentage} className="h-2" />
          </div>

          {/* Benefits */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg">
            <h4 className="font-semibold text-foreground mb-2">Com o upgrade você terá:</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li className="flex items-center">
                <ArrowRight className="w-3 h-3 mr-2 text-blue-600 dark:text-blue-400" />
                Mais clientes e campanhas
              </li>
              <li className="flex items-center">
                <ArrowRight className="w-3 h-3 mr-2 text-blue-600 dark:text-blue-400" />
                Analytics avançados
              </li>
              <li className="flex items-center">
                <ArrowRight className="w-3 h-3 mr-2 text-blue-600 dark:text-blue-400" />
                Relatórios personalizados
              </li>
              <li className="flex items-center">
                <ArrowRight className="w-3 h-3 mr-2 text-blue-600 dark:text-blue-400" />
                Suporte prioritário
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Continuar com Plano Atual
          </Button>
          <Button asChild className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
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