"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  Shield,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PaymentMethod {
  id: string;
  type: 'card';
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  is_default: boolean;
}

interface PaymentMethodFormProps {
  organizationId: string;
  paymentMethods?: PaymentMethod[];
  onPaymentMethodsChange?: (methods: PaymentMethod[]) => void;
}

export function PaymentMethodForm({ 
  organizationId, 
  paymentMethods = [], 
  onPaymentMethodsChange 
}: PaymentMethodFormProps) {
  const [loading, setLoading] = useState(false);
  const [addingMethod, setAddingMethod] = useState(false);
  const [removingMethod, setRemovingMethod] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for new payment method
  const [cardForm, setCardForm] = useState({
    number: '',
    expiry: '',
    cvc: '',
    name: '',
  });

  const formatCardNumber = (value: string) => {
    // Remove all non-digits
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    
    // Add spaces every 4 digits
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const getCardBrandIcon = (brand: string) => {
    // In a real app, you'd have actual card brand icons
    return <CreditCard className="h-4 w-4" />;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    if (formatted.length <= 19) { // 16 digits + 3 spaces
      setCardForm(prev => ({ ...prev, number: formatted }));
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiry(e.target.value);
    if (formatted.length <= 5) { // MM/YY
      setCardForm(prev => ({ ...prev, expiry: formatted }));
    }
  };

  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length <= 4) {
      setCardForm(prev => ({ ...prev, cvc: value }));
    }
  };

  const validateForm = () => {
    const { number, expiry, cvc, name } = cardForm;
    
    if (!name.trim()) return 'Nome do portador é obrigatório';
    if (number.replace(/\s/g, '').length < 13) return 'Número do cartão inválido';
    if (expiry.length !== 5) return 'Data de validade inválida';
    if (cvc.length < 3) return 'CVC inválido';
    
    // Validate expiry date
    const [month, year] = expiry.split('/');
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear() % 100;
    const currentMonth = currentDate.getMonth() + 1;
    
    if (parseInt(month) < 1 || parseInt(month) > 12) {
      return 'Mês inválido';
    }
    
    if (parseInt(year) < currentYear || 
        (parseInt(year) === currentYear && parseInt(month) < currentMonth)) {
      return 'Cartão expirado';
    }
    
    return null;
  };

  const addPaymentMethod = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setAddingMethod(true);
      setError(null);

      const response = await fetch('/api/subscriptions/payment-methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: organizationId,
          card: {
            number: cardForm.number.replace(/\s/g, ''),
            exp_month: parseInt(cardForm.expiry.split('/')[0]),
            exp_year: parseInt('20' + cardForm.expiry.split('/')[1]),
            cvc: cardForm.cvc,
          },
          billing_details: {
            name: cardForm.name,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || 'Falha ao adicionar método de pagamento');
      }

      const data = await response.json();
      
      // Update payment methods list
      const updatedMethods = [...paymentMethods, data.payment_method];
      onPaymentMethodsChange?.(updatedMethods);

      // Reset form and close dialog
      setCardForm({ number: '', expiry: '', cvc: '', name: '' });
      setShowAddDialog(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setAddingMethod(false);
    }
  };

  const removePaymentMethod = async (methodId: string) => {
    try {
      setRemovingMethod(methodId);

      const response = await fetch('/api/subscriptions/payment-methods', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: organizationId,
          payment_method_id: methodId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || 'Falha ao remover método de pagamento');
      }

      // Update payment methods list
      const updatedMethods = paymentMethods.filter(method => method.id !== methodId);
      onPaymentMethodsChange?.(updatedMethods);
    } catch (err) {
      console.error('Erro ao remover método de pagamento:', err);
      // You might want to show a toast notification here
    } finally {
      setRemovingMethod(null);
    }
  };

  const setDefaultPaymentMethod = async (methodId: string) => {
    try {
      setLoading(true);

      const response = await fetch('/api/subscriptions/payment-methods', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: organizationId,
          payment_method_id: methodId,
          set_default: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || 'Falha ao definir método padrão');
      }

      // Update payment methods list
      const updatedMethods = paymentMethods.map(method => ({
        ...method,
        is_default: method.id === methodId
      }));
      onPaymentMethodsChange?.(updatedMethods);
    } catch (err) {
      console.error('Erro ao definir método padrão:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Métodos de Pagamento
            </CardTitle>
            <CardDescription>
              Gerencie seus cartões de crédito e métodos de pagamento
            </CardDescription>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Cartão
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Adicionar Método de Pagamento</DialogTitle>
                <DialogDescription>
                  Adicione um novo cartão de crédito para suas cobranças
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="cardName">Nome do Portador</Label>
                  <Input
                    id="cardName"
                    placeholder="Nome como aparece no cartão"
                    value={cardForm.name}
                    onChange={(e) => setCardForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cardNumber">Número do Cartão</Label>
                  <Input
                    id="cardNumber"
                    placeholder="1234 5678 9012 3456"
                    value={cardForm.number}
                    onChange={handleCardNumberChange}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiry">Validade</Label>
                    <Input
                      id="expiry"
                      placeholder="MM/AA"
                      value={cardForm.expiry}
                      onChange={handleExpiryChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cvc">CVC</Label>
                    <Input
                      id="cvc"
                      placeholder="123"
                      value={cardForm.cvc}
                      onChange={handleCvcChange}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-700">
                    Seus dados são protegidos com criptografia SSL
                  </span>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setShowAddDialog(false)}
                  disabled={addingMethod}
                >
                  Cancelar
                </Button>
                <Button onClick={addPaymentMethod} disabled={addingMethod}>
                  {addingMethod ? 'Adicionando...' : 'Adicionar Cartão'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {paymentMethods.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum método de pagamento cadastrado</p>
            <p className="text-sm">Adicione um cartão para gerenciar suas cobranças</p>
          </div>
        ) : (
          <div className="space-y-4">
            {paymentMethods.map((method) => (
              <div 
                key={method.id} 
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getCardBrandIcon(method.card.brand)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        •••• •••• •••• {method.card.last4}
                      </span>
                      {method.is_default && (
                        <Badge variant="secondary">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Padrão
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {method.card.brand.toUpperCase()} • Expira {method.card.exp_month.toString().padStart(2, '0')}/{method.card.exp_year}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!method.is_default && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDefaultPaymentMethod(method.id)}
                      disabled={loading}
                    >
                      Definir como Padrão
                    </Button>
                  )}
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={removingMethod === method.id}
                      >
                        {removingMethod === method.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover Método de Pagamento</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja remover este cartão? Esta ação não pode ser desfeita.
                          {method.is_default && (
                            <span className="block mt-2 text-orange-600">
                              Este é seu método de pagamento padrão. Defina outro cartão como padrão antes de remover este.
                            </span>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => removePaymentMethod(method.id)}
                          disabled={method.is_default}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}