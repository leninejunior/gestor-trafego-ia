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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Edit, Save, X } from "lucide-react";

interface UserDetailsBasicProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onUserUpdated: () => void;
}

export function UserDetailsBasic({ 
  open, 
  onOpenChange, 
  userId, 
  onUserUpdated 
}: UserDetailsBasicProps) {
  const [editMode, setEditMode] = useState(false);
  const [firstName, setFirstName] = useState("João");
  const [lastName, setLastName] = useState("Silva");
  const [email, setEmail] = useState("joao@exemplo.com");

  console.log('🎯 BASIC Modal render - open:', open, 'editMode:', editMode);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            🧪 TESTE BÁSICO {editMode && '✏️ EDITANDO'}
          </DialogTitle>
          <DialogDescription>
            {editMode ? '✏️ Modo de edição ativo' : 'Clique em Editar para testar'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-green-100 border border-green-300 rounded p-3">
            <p className="text-green-800 font-semibold">✅ Modal Funcionando!</p>
            <p className="text-green-700 text-sm">User ID: {userId}</p>
          </div>

          {/* Campos de teste */}
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              {editMode ? (
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Nome"
                />
              ) : (
                <div className="p-2 bg-gray-50 rounded text-sm">{firstName}</div>
              )}
            </div>

            <div>
              <Label>Sobrenome</Label>
              {editMode ? (
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Sobrenome"
                />
              ) : (
                <div className="p-2 bg-gray-50 rounded text-sm">{lastName}</div>
              )}
            </div>

            <div>
              <Label>Email</Label>
              {editMode ? (
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                />
              ) : (
                <div className="p-2 bg-gray-50 rounded text-sm">{email}</div>
              )}
            </div>
          </div>

          {/* Botões */}
          <div className="flex items-center justify-between pt-4 border-t">
            {editMode ? (
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  onClick={() => {
                    console.log('💾 Salvando...');
                    alert('Dados salvos com sucesso!');
                    setEditMode(false);
                  }}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salvar ✅
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    console.log('❌ Cancelando...');
                    setEditMode(false);
                  }}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  console.log('🔧 Ativando modo de edição...');
                  setEditMode(true);
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar ✏️
              </Button>
            )}

            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </div>

          {editMode && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-blue-700 text-sm font-semibold">
                🎯 TESTE: Modo de edição está ATIVO!
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}