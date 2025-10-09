import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send, Settings, Calendar } from "lucide-react";

export default function WhatsAppPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <MessageSquare className="w-8 h-8 mr-3 text-green-600" />
          WhatsApp
        </h1>
        <p className="text-gray-600 mt-1">
          Configure relatórios automáticos via WhatsApp
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Send className="w-5 h-5 mr-2" />
              Relatórios Automáticos
            </CardTitle>
            <CardDescription>
              Envie relatórios de performance automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">
              <Settings className="w-4 h-4 mr-2" />
              Configurar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Agendamentos
            </CardTitle>
            <CardDescription>
              Programe envios diários, semanais ou mensais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Agendar Envios
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare className="w-5 h-5 mr-2" />
              Templates
            </CardTitle>
            <CardDescription>
              Personalize modelos de mensagens
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Gerenciar Templates
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Funcionalidade em Desenvolvimento</CardTitle>
          <CardDescription>
            Integração com WhatsApp Business API será implementada em breve
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              WhatsApp Business API em Breve
            </h3>
            <p className="text-gray-500 mb-4">
              Estamos desenvolvendo a integração com WhatsApp Business API para 
              envio automático de relatórios e alertas de campanhas.
            </p>
            <div className="space-y-2 text-sm text-gray-600">
              <p>✓ Relatórios automáticos de performance</p>
              <p>✓ Alertas de orçamento e campanhas</p>
              <p>✓ Templates personalizáveis</p>
              <p>✓ Agendamento flexível</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}