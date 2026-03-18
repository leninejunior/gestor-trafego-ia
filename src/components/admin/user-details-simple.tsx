"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

interface UserDetailsSimpleProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onUserUpdated: () => void;
}

export function UserDetailsSimple({ 
  open, 
  onOpenChange, 
  userId, 
  onUserUpdated 
}: UserDetailsSimpleProps) {
  console.log('🎯 SIMPLE Modal render - open:', open, 'userId:', userId);

  if (!open) {
    console.log('❌ SIMPLE Modal não está aberto');
    return null;
  }

  return (
    <>
      {console.log('✅ SIMPLE Modal renderizando conteúdo')}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              TESTE SIMPLES - Modal Funcionando
            </DialogTitle>
            <DialogDescription>
              Este é um teste para verificar se o modal aparece
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-4">
            <div className="text-lg font-bold text-green-600">
              ✅ MODAL ESTÁ FUNCIONANDO!
            </div>
            
            <div className="space-y-2">
              <div><strong>User ID:</strong> {userId}</div>
              <div><strong>Modal Open:</strong> {open ? 'SIM' : 'NÃO'}</div>
              <div><strong>Timestamp:</strong> {new Date().toLocaleTimeString()}</div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => onOpenChange(false)} className="flex-1">
                Fechar Modal
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  console.log('🔄 Teste de atualização');
                  onUserUpdated();
                }}
                className="flex-1"
              >
                Testar Callback
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}