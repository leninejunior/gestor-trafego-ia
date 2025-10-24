import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BillingEngine } from '@/lib/services/billing-engine';
import PDFDocument from 'pdfkit';

/**
 * GET /api/invoices/[id]/download
 * Download invoice as PDF
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get invoice with subscription and organization info
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('subscription_invoices')
      .select(`
        *,
        subscription:subscriptions(
          organization_id,
          plan:subscription_plans(name, description)
        )
      `)
      .eq('id', params.id)
      .single();

    if (invoiceError || !invoiceData) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Verify user has access to this invoice's organization
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', invoiceData.subscription.organization_id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get organization details
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('name, email')
      .eq('id', membership.organization_id)
      .single();

    if (orgError || !organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoiceData, organization);

    // Return PDF response
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoiceData.invoice_number}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Generate PDF for invoice
 */
async function generateInvoicePDF(invoiceData: any, organization: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text('INVOICE', 50, 50);
      doc.fontSize(12).text(`Invoice #: ${invoiceData.invoice_number}`, 50, 80);
      doc.text(`Date: ${new Date(invoiceData.created_at).toLocaleDateString()}`, 50, 95);
      doc.text(`Due Date: ${new Date(invoiceData.due_date).toLocaleDateString()}`, 50, 110);

      // Company info (right side)
      doc.text('Ads Manager System', 400, 50);
      doc.text('SaaS Subscription Services', 400, 65);
      doc.text('support@adsmanager.com', 400, 80);

      // Bill to
      doc.fontSize(14).text('Bill To:', 50, 150);
      doc.fontSize(12).text(organization.name, 50, 170);
      if (organization.email) {
        doc.text(organization.email, 50, 185);
      }

      // Status
      const statusY = 150;
      doc.fontSize(14).text('Status:', 400, statusY);
      doc.fontSize(12).text(invoiceData.status.toUpperCase(), 400, statusY + 20);

      // Line items table
      const tableTop = 250;
      doc.fontSize(12);
      
      // Table headers
      doc.text('Description', 50, tableTop);
      doc.text('Qty', 300, tableTop);
      doc.text('Unit Price', 350, tableTop);
      doc.text('Total', 450, tableTop);
      
      // Draw header line
      doc.moveTo(50, tableTop + 15).lineTo(500, tableTop + 15).stroke();

      // Line items
      let currentY = tableTop + 30;
      const lineItems = invoiceData.line_items || [];
      
      for (const item of lineItems) {
        doc.text(item.description, 50, currentY);
        doc.text(item.quantity.toString(), 300, currentY);
        doc.text(`$${item.unit_price.toFixed(2)}`, 350, currentY);
        doc.text(`$${item.total.toFixed(2)}`, 450, currentY);
        currentY += 20;
      }

      // Total line
      doc.moveTo(50, currentY + 10).lineTo(500, currentY + 10).stroke();
      doc.fontSize(14).text('Total:', 400, currentY + 20);
      doc.text(`$${invoiceData.amount.toFixed(2)}`, 450, currentY + 20);

      // Payment info
      if (invoiceData.status === 'paid' && invoiceData.paid_at) {
        doc.fontSize(12).text(
          `Paid on: ${new Date(invoiceData.paid_at).toLocaleDateString()}`,
          50,
          currentY + 60
        );
      }

      // Footer
      doc.fontSize(10).text(
        'Thank you for your business!',
        50,
        doc.page.height - 100,
        { align: 'center' }
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}