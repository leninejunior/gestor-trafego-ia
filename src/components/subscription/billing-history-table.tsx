"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Download, 
  CreditCard, 
  Calendar,
  Receipt,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle
} from "lucide-react";
import { SubscriptionInvoice } from "@/lib/types/subscription";
import { formatCurrency } from "@/lib/utils/currency";
import { formatters } from "@/lib/utils/date-formatter";

interface BillingHistoryTableProps {
  organizationId: string;
}

export function BillingHistoryTable({ organizationId }: BillingHistoryTableProps) {
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState<string | null>(null);

  useEffect(() => {
    fetchBillingHistory();
  }, [organizationId]);

  const fetchBillingHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/subscriptions/billing-history?organization_id=${organizationId}`);
      
      if (!response.ok) {
        throw new Error('Falha ao carregar histórico de cobrança');
      }

      const data = await response.json();
      setInvoices(data.invoices || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const downloadInvoice = async (invoiceId: string) => {
    try {
      setDownloadingInvoice(invoiceId);

      const response = await fetch(`/api/invoices/${invoiceId}/download`);
      
      if (!response.ok) {
        throw new Error('Falha ao baixar fatura');
      }

      // Get the PDF blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `fatura-${invoiceId}.pdf`;
      
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Erro ao baixar fatura:', err);
      // You might want to show a toast notification here
    } finally {
      setDownloadingInvoice(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'open':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'void':
      case 'uncollectible':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Pago';
      case 'open':
        return 'Pendente';
      case 'void':
        return 'Cancelado';
      case 'uncollectible':
        return 'Não Cobrável';
      case 'draft':
        return 'Rascunho';
      default:
        return status;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'paid':
        return 'default';
      case 'open':
        return 'secondary';
      case 'void':
      case 'uncollectible':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Histórico de Faturas
          </CardTitle>
          <CardDescription>
            Suas faturas e pagamentos recentes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Histórico de Faturas
          </CardTitle>
          <CardDescription>
            Suas faturas e pagamentos recentes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchBillingHistory} variant="outline">
              Tentar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Histórico de Faturas
        </CardTitle>
        <CardDescription>
          Suas faturas e pagamentos recentes
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma fatura encontrada</p>
            <p className="text-sm">As faturas aparecerão aqui após o primeiro pagamento</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {invoices.filter(inv => inv.status === 'paid').length}
                </div>
                <div className="text-sm text-muted-foreground">Faturas Pagas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {invoices.filter(inv => inv.status === 'open').length}
                </div>
                <div className="text-sm text-muted-foreground">Pendentes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {formatCurrency(
                    invoices
                      .filter(inv => inv.status === 'paid')
                      .reduce((sum, inv) => sum + inv.amount, 0)
                  )}
                </div>
                <div className="text-sm text-muted-foreground">Total Pago</div>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fatura</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Receipt className="h-4 w-4 text-muted-foreground" />
                          {invoice.invoice_number}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatters.short(invoice.created_at)}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(invoice.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={getStatusVariant(invoice.status)}
                          className="flex items-center gap-1 w-fit"
                        >
                          {getStatusIcon(invoice.status)}
                          {getStatusLabel(invoice.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadInvoice(invoice.id)}
                          disabled={downloadingInvoice === invoice.id}
                        >
                          {downloadingInvoice === invoice.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Load More Button (if needed) */}
            {invoices.length >= 10 && (
              <div className="text-center pt-4">
                <Button variant="outline" onClick={fetchBillingHistory}>
                  Carregar Mais
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}