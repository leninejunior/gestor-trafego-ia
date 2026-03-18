import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const { user, error: authError } = await requireAdminAuth(request);
    if (authError) {
      return authError;
    }

    const body = await request.json();
    const { search = '', status = 'all', days = 30 } = body;

    const supabase = await createClient();

    // Calculate date range
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    // Build query similar to the customers endpoint
    let query = supabase
      .from('subscriptions')
      .select(`
        id,
        status,
        current_period_start,
        current_period_end,
        created_at,
        updated_at,
        subscription_plans!inner (
          id,
          name,
          monthly_price
        ),
        organizations!inner (
          id,
          name,
          slug
        )
      `);

    // Apply filters
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`organizations.name.ilike.%${search}%,organizations.slug.ilike.%${search}%`);
    }

    query = query.gte('created_at', dateFrom.toISOString());

    const { data: subscriptions, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Get billing data for each subscription
    const exportDataPromises = subscriptions?.map(async (subscription) => {
      // Get total revenue for this subscription
      const { data: invoices } = await supabase
        .from('subscription_invoices')
        .select('amount, paid_at, created_at')
        .eq('subscription_id', subscription.id)
        .eq('status', 'paid');

      const totalRevenue = invoices?.reduce((sum, invoice) => sum + invoice.amount, 0) || 0;
      const monthlyRevenue = subscription.subscription_plans?.monthly_price || 0;

      // Get last payment date
      const lastPayment = invoices?.length > 0 
        ? invoices.sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())[0].paid_at
        : null;

      return {
        'Organization Name': subscription.organizations?.name || 'Unknown',
        'Plan': subscription.subscription_plans?.name || 'Unknown Plan',
        'Status': subscription.status,
        'Monthly Revenue': monthlyRevenue,
        'Total Revenue': totalRevenue,
        'Last Payment': lastPayment ? new Date(lastPayment).toLocaleDateString() : 'N/A',
        'Next Billing': subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'N/A',
        'Created Date': new Date(subscription.created_at).toLocaleDateString(),
        'Subscription ID': subscription.id
      };
    }) || [];

    const exportData = await Promise.all(exportDataPromises);

    // Convert to CSV
    if (exportData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No data to export' },
        { status: 400 }
      );
    }

    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => 
        headers.map(header => {
          const value = row[header as keyof typeof row];
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="billing-report-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });

  } catch (error) {
    console.error('Error exporting billing data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export billing data' },
      { status: 500 }
    );
  }
}