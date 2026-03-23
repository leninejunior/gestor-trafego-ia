import { MessageSquare } from "lucide-react";
import { GroupBindingsManager } from "./_components/group-bindings-manager";

export default function WhatsAppPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <MessageSquare className="w-8 h-8 mr-3 text-green-600" />
          WhatsApp
        </h1>
        <p className="text-gray-600 mt-1">Admin de vinculos de grupos para comandos OpenClaw</p>
      </div>

      <GroupBindingsManager />
    </div>
  );
}
