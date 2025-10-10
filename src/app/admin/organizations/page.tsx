import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { 
  Building2, 
  Users, 
  CreditCard, 
  Eye,
  ArrowLeft,
  Calendar,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function AdminOrganizationsPage() {
  const supabase = await createClient();

  // Verificar se é super admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return redirect("/login");
  }

  // Buscar todas as organizações com dados relacionados
  const { data: organizations } = await supabase
    .from("organizations")
    .select(`
      id,
      name,
      created_at,
      memberships (
        id,
        role,
        status,
        user_profiles (
          first_name,
          last_name
        )
      ),
      clients (
        id,
        name
      ),
      subscriptions (
        id,
        status,
        current_period_end,
        subscription_plans (
          name,
          price_monthly
        )
      )
    `)
    .order("created_at", { ascending: false });

  const getSubscriptionStatus = (subscriptions: any[]) => {
    const activeSub = subscriptions?.find(sub => sub.status === 'active');
    if (!activeSub) return { status: 'none', plan: 'Sem plano', color: 'secondary' };
    
    const isExpired = new Date(activeSub.current_period_end) < new Date();
    if (isExpired) return { status: 'expired', plan: activeSub.subscription_plans?.name, color: 'destructive' };
    
    return { 
      status: 'active', 
      plan: activeSub.subscription_plans?.name,
      price: activeSub.subscription_plans?.price_monthly,
      color: 'default' 
    };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <Button asChild variant="outline" size="sm">
                <Link href="/admin">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Link>
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Gerenciar Organizações
                </h1>
                <p className="text-gray-600 mt-1">
                  Todas as organizações cadastradas no sistema
                </p>
              </div>
            </div>
            <Badge variant="destructive" className="px-3 py-1">
              SUPER ADMIN
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{organizations?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Com Plano Ativo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {organizations?.filter(org => 
                  getSubscriptionStatus(org.subscriptions).status === 'active'
                ).length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Trial/Gratuito</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {organizations?.filter(org => 
                  getSubscriptionStatus(org.subscriptions).status === 'none'
                ).length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Expirados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {organizations?.filter(org => 
                  getSubscriptionStatus(org.subscriptions).status === 'expired'
                ).length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Organizations Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Organizações</CardTitle>
            <CardDescription>
              Todas as organizações cadastradas com seus respectivos dados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead>Membros</TableHead>
                  <TableHead>Clientes</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations?.map((org) => {
                  const subscription = getSubscriptionStatus(org.subscriptions);
                  const owner = org.memberships?.find(m => m.role === 'owner');
                  
                  return (
                    <TableRow key={org.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{org.name}</div>
                          <div className="text-sm text-gray-500">
                            ID: {org.id.slice(0, 8)}...
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span>{org.memberships?.length || 0}</span>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span>{org.clients?.length || 0}</span>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div>
                          <Badge variant={subscription.color as any}>
                            {subscription.plan}
                          </Badge>
                          {subscription.price && (
                            <div className="text-xs text-gray-500 mt-1">
                              R$ {subscription.price}/mês
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          {subscription.status === 'active' && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                          {subscription.status === 'expired' && (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                          {subscription.status === 'none' && (
                            <Clock className="w-4 h-4 text-gray-500" />
                          )}
                          <span className="text-sm capitalize">
                            {subscription.status === 'active' ? 'Ativo' :
                             subscription.status === 'expired' ? 'Expirado' : 'Trial'}
                          </span>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">
                            {new Date(org.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/organizations/${org.id}`}>
                            <Eye className="w-4 h-4 mr-1" />
                            Ver Detalhes
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}