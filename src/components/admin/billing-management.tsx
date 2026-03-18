'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  AlertTriangle,
  CreditCard,
  DollarSign,
  Users,
  Calendar,
  Search,
  Filter,
  Download,
  RefreshCw,
  Settings,
  Eye,
  Edit,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';

interface BillingStats {
  totalRevenue: number;
  monthlyRevenue: number;
  failedPayments: number;
  activeSubscriptions: number;
  revenueGrowth: number;
  churnRate: number;
}

interface FailedPayment {
  id: string;
  subscriptionId: string;
  organizationName: string;
  customerEmail: string;
  amount: number;
  currency: string;
  failureReason: string;
  attemptCount: number;
  nextRetryAt: string;
  createdAt: string;
  status: 'pending_retry' | 'failed' | 'resolved';
}

interface SubscriptionAdjustment {
  subscriptionId: string;
  adjustmentType: 'credit' | 'charge' | 'plan_change' | 'pause' | 'resume';
  amount?: number;
  description: string;
  newPlanId?: string;
}

interface CustomerBilling {
  id: string;
  organizationName: string;
  customerEmail: string;
  currentPlan: string;
  subscriptionStatus: string;
  monthlyRevenue: number;
  totalRevenue: number;
  lastPayment: string;
  nextBilling: string;
  paymentMethod: string;
}

export function AdminBillingManagement() {
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [failedPayments, setFailedPayments] = useState<FailedPayment[]>([]);
  const [customerBilling, setCustomerBilling] = useState<CustomerBilling[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('30');
  
  // Dialogs
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);
  const [isBillingHistoryDialogOpen, setIsBillingHistoryDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerBilling | null>(null);
  
  // Adjustment form
  const [adjustmentForm, setAdjustmentForm] = useState<SubscriptionAdjustment>({
    subscriptionId: '',
    adjustmentType: 'credit',
    amount: 0,
    description: '',
    newPlanId: ''
  });
  
  const [processing, setProcessing] = useState(false);

  const fetchBillingStats = async () => {
    try {
      const response = await fetch('/api/admin/billing/stats');
      if (!response.ok) throw new Error('Failed to fetch billing stats');
      
      const result = await response.json();
      if (result.success) {
        setStats(result.data);
      }
    } catch (err) {
      console.error('Error fetching billing stats:', err);
    }
  };

  const fetchFailedPayments = async () => {
    try {
      const response = await fetch('/api/admin/billing/failed-payments');
      if (!response.ok) throw new Error('Failed to fetch failed payments');
      
      const result = await response.json();
      if (result.success) {
        setFailedPayments(result.data);
      }
    } catch (err) {
      console.error('Error fetching failed payments:', err);
    }
  };

  const fetchCustomerBilling = async () => {
    try {
      const params = new URLSearchParams({
        search: searchTerm,
        status: statusFilter,
        days: dateRange
      });
      
      const response = await fetch(`/api/admin/billing/customers?${params}`);
      if (!response.ok) throw new Error('Failed to fetch customer billing');
      
      const result = await response.json();
      if (result.success) {
        setCustomerBilling(result.data);
      }
    } catch (err) {
      console.error('Error fetching customer billing:', err);
    }
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      await Promise.all([
        fetchBillingStats(),
        fetchFailedPayments(),
        fetchCustomerBilling()
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch billing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    fetchCustomerBilling();
  }, [searchTerm, statusFilter, dateRange]);

  const handleRetryPayment = async (paymentId: string) => {
    try {
      setProcessing(true);
      
      const response = await fetch(`/api/admin/billing/retry-payment/${paymentId}`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to retry payment');
      
      const result = await response.json();
      if (result.success) {
        await fetchFailedPayments();
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleSubscriptionAdjustment = async () => {
    try {
      setProcessing(true);
      
      const response = await fetch('/api/admin/billing/adjust-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(adjustmentForm)
      });
      
      if (!response.ok) throw new Error('Failed to adjust subscription');
      
      const result = await response.json();
      if (result.success) {
        setIsAdjustmentDialogOpen(false);
        setAdjustmentForm({
          subscriptionId: '',
          adjustmentType: 'credit',
          amount: 0,
          description: '',
          newPlanId: ''
        });
        await fetchCustomerBilling();
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust subscription');
    } finally {
      setProcessing(false);
    }
  };

  const openAdjustmentDialog = (customer: CustomerBilling) => {
    setAdjustmentForm(prev => ({
      ...prev,
      subscriptionId: customer.id
    }));
    setIsAdjustmentDialogOpen(true);
  };

  const openBillingHistory = (customer: CustomerBilling) => {
    setSelectedCustomer(customer);
    setIsBillingHistoryDialogOpen(true);
  };

  const exportBillingData = async () => {
    try {
      const response = await fetch('/api/admin/billing/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          search: searchTerm,
          status: statusFilter,
          days: dateRange
        })
      });
      
      if (!response.ok) throw new Error('Failed to export data');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `billing-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export data');
    }
  };

  if (loading) {
    return <BillingManagementSkeleton />;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {stats.revenueGrowth >= 0 ? (
                  <TrendingUp className="w-3 h-3 mr-1 text-green-500" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-1 text-red-500" />
                )}
                {Math.abs(stats.revenueGrowth).toFixed(1)}% from last month
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.monthlyRevenue)}</div>
              <p className="text-xs text-muted-foreground">Current month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Payments</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.failedPayments}</div>
              <p className="text-xs text-muted-foreground">Requiring attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                Churn rate: {stats.churnRate.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Failed Payments Section */}
      {failedPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
              Failed Payments
            </CardTitle>
            <CardDescription>
              Payments that require immediate attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Failure Reason</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Next Retry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failedPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{payment.organizationName}</div>
                        <div className="text-sm text-gray-500">{payment.customerEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(payment.amount)}</TableCell>
                    <TableCell>
                      <span className="text-sm text-red-600">{payment.failureReason}</span>
                    </TableCell>
                    <TableCell>{payment.attemptCount}/3</TableCell>
                    <TableCell>
                      {payment.nextRetryAt ? new Date(payment.nextRetryAt).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        payment.status === 'resolved' ? 'default' :
                        payment.status === 'pending_retry' ? 'secondary' : 'destructive'
                      }>
                        {payment.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRetryPayment(payment.id)}
                        disabled={processing || payment.status === 'resolved'}
                      >
                        {processing ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          'Retry'
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Customer Billing Management */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Customer Billing</CardTitle>
              <CardDescription>
                Manage customer subscriptions and billing history
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={exportBillingData}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" onClick={fetchAllData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="past_due">Past Due</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
                <SelectItem value="trialing">Trialing</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Customer Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Monthly Revenue</TableHead>
                <TableHead>Total Revenue</TableHead>
                <TableHead>Last Payment</TableHead>
                <TableHead>Next Billing</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customerBilling.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{customer.organizationName}</div>
                      <div className="text-sm text-gray-500">{customer.customerEmail}</div>
                    </div>
                  </TableCell>
                  <TableCell>{customer.currentPlan}</TableCell>
                  <TableCell>
                    <Badge variant={
                      customer.subscriptionStatus === 'active' ? 'default' :
                      customer.subscriptionStatus === 'past_due' ? 'destructive' :
                      customer.subscriptionStatus === 'trialing' ? 'secondary' : 'outline'
                    }>
                      {customer.subscriptionStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(customer.monthlyRevenue)}</TableCell>
                  <TableCell>{formatCurrency(customer.totalRevenue)}</TableCell>
                  <TableCell>
                    {customer.lastPayment ? new Date(customer.lastPayment).toLocaleDateString() : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {customer.nextBilling ? new Date(customer.nextBilling).toLocaleDateString() : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openBillingHistory(customer)}
                      >
                        <Eye className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAdjustmentDialog(customer)}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Subscription Adjustment Dialog */}
      <Dialog open={isAdjustmentDialogOpen} onOpenChange={setIsAdjustmentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Subscription</DialogTitle>
            <DialogDescription>
              Make manual adjustments to customer subscription
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="adjustmentType">Adjustment Type</Label>
              <Select 
                value={adjustmentForm.adjustmentType} 
                onValueChange={(value: any) => setAdjustmentForm(prev => ({ ...prev, adjustmentType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Apply Credit</SelectItem>
                  <SelectItem value="charge">Add Charge</SelectItem>
                  <SelectItem value="plan_change">Change Plan</SelectItem>
                  <SelectItem value="pause">Pause Subscription</SelectItem>
                  <SelectItem value="resume">Resume Subscription</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(adjustmentForm.adjustmentType === 'credit' || adjustmentForm.adjustmentType === 'charge') && (
              <div>
                <Label htmlFor="amount">Amount (BRL)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={adjustmentForm.amount}
                  onChange={(e) => setAdjustmentForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            )}

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={adjustmentForm.description}
                onChange={(e) => setAdjustmentForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Reason for adjustment..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdjustmentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubscriptionAdjustment} disabled={processing}>
              {processing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Apply Adjustment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Billing History Dialog */}
      <Dialog open={isBillingHistoryDialogOpen} onOpenChange={setIsBillingHistoryDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Billing History</DialogTitle>
            <DialogDescription>
              {selectedCustomer && `Billing history for ${selectedCustomer.organizationName}`}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCustomer && (
            <CustomerBillingHistory customerId={selectedCustomer.id} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Customer Billing History Component
function CustomerBillingHistory({ customerId }: { customerId: string }) {
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBillingHistory = async () => {
      try {
        const response = await fetch(`/api/admin/billing/history/${customerId}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setBillingHistory(result.data);
          }
        }
      } catch (err) {
        console.error('Error fetching billing history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBillingHistory();
  }, [customerId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-200 rounded animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {billingHistory.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{new Date(item.created_at).toLocaleDateString()}</TableCell>
              <TableCell>{item.description}</TableCell>
              <TableCell>{formatCurrency(item.amount)}</TableCell>
              <TableCell>
                <Badge variant={item.status === 'paid' ? 'default' : 'destructive'}>
                  {item.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Button size="sm" variant="outline">
                  <Download className="w-3 h-3" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function BillingManagementSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
              <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-32 animate-pulse mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-20 animate-pulse"></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table Skeleton */}
      <Card>
        <CardHeader>
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}