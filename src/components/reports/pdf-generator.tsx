'use client';

import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";

interface PDFGeneratorProps {
  insights: any;
  campaignName: string;
  clientName: string;
  dateRange: { since: string; until: string };
}

export function PDFGenerator({ insights, campaignName, clientName, dateRange }: PDFGeneratorProps) {
  const generatePDF = () => {
    // Criar conteúdo HTML para o PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Performance - ${campaignName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 30px 0; }
          .metric-card { border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
          .metric-value { font-size: 24px; font-weight: bold; color: #2563eb; }
          .metric-label { font-size: 14px; color: #666; margin-top: 5px; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Relatório de Performance</h1>
          <h2>${campaignName}</h2>
          <p><strong>Cliente:</strong> ${clientName}</p>
          <p><strong>Período:</strong> ${dateRange.since} a ${dateRange.until}</p>
        </div>
        
        <div class="metrics">
          <div class="metric-card">
            <div class="metric-value">${new Intl.NumberFormat('pt-BR').format(insights.impressions || 0)}</div>
            <div class="metric-label">Impressões</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${new Intl.NumberFormat('pt-BR').format(insights.clicks || 0)}</div>
            <div class="metric-label">Cliques</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(insights.spend || 0)}</div>
            <div class="metric-label">Gasto Total</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${((insights.ctr || 0) * 100).toFixed(2)}%</div>
            <div class="metric-label">CTR</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(insights.cpm || 0)}</div>
            <div class="metric-label">CPM</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(insights.cpc || 0)}</div>
            <div class="metric-label">CPC</div>
          </div>
        </div>
        
        <div class="footer">
          <p>Relatório gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
          <p>Sistema de Gestão de Campanhas</p>
        </div>
      </body>
      </html>
    `;

    // Criar blob e fazer download
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-${campaignName.replace(/[^a-zA-Z0-9]/g, '-')}-${dateRange.since}-${dateRange.until}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generateWhatsAppMessage = () => {
    const message = `📊 *Relatório de Performance*

🎯 *Campanha:* ${campaignName}
👤 *Cliente:* ${clientName}
📅 *Período:* ${dateRange.since} a ${dateRange.until}

📈 *Métricas:*
• Impressões: ${new Intl.NumberFormat('pt-BR').format(insights.impressions || 0)}
• Cliques: ${new Intl.NumberFormat('pt-BR').format(insights.clicks || 0)}
• Gasto: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(insights.spend || 0)}
• CTR: ${((insights.ctr || 0) * 100).toFixed(2)}%
• CPM: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(insights.cpm || 0)}
• CPC: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(insights.cpc || 0)}

Relatório gerado em ${new Date().toLocaleDateString('pt-BR')}`;

    // Copiar para clipboard
    navigator.clipboard.writeText(message).then(() => {
      alert('Mensagem copiada para a área de transferência! Cole no WhatsApp.');
    });
  };

  return (
    <div className="flex space-x-2">
      <Button onClick={generatePDF} className="flex-1">
        <Download className="w-4 h-4 mr-2" />
        Baixar PDF
      </Button>
      <Button onClick={generateWhatsAppMessage} variant="outline" className="flex-1">
        <FileText className="w-4 h-4 mr-2" />
        Copiar para WhatsApp
      </Button>
    </div>
  );
}