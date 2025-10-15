'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Building2, Users, ChevronDown, Search } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  organization_name: string;
  email?: string;
  phone?: string;
  status?: 'active' | 'inactive';
  campaigns_count?: number;
  total_spend?: number;
}

interface ClientSearchProps {
  clients: Client[];
  selectedClient?: string;
  onClientSelect: (clientId: string) => void;
  placeholder?: string;
  className?: string;
  showAllOption?: boolean;
  isSuperAdmin?: boolean;
}

export function ClientSearch({
  clients,
  selectedClient,
  onClientSelect,
  placeholder = 'Buscar cliente...',
  className,
  showAllOption = true,
  isSuperAdmin = false
}: ClientSearchProps) {
  const [searchValue, setSearchValue] = useState(selectedClient || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setSearchValue(selectedClient || '');
  }, [selectedClient]);

  const formatCurrency = (value?: number) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const selectedClientData = clients.find(c => c.id === searchValue);
  const selectedLabel = selectedClientData ? selectedClientData.name : 
                       (searchValue === 'all' ? 'Todos os clientes' : placeholder);

  // Filtrar clientes baseado na busca
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.organization_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleClientSelect = (clientId: string) => {
    setSearchValue(clientId);
    onClientSelect(clientId);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={className}>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => setIsOpen(!isOpen)}
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{selectedLabel}</span>
            </div>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-full min-w-[300px] p-0" align="start">
          <div className="p-2">
            <Input
              placeholder="Digite para buscar clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-2"
            />
          </div>
          
          <div className="max-h-64 overflow-auto">
            {showAllOption && (
              <DropdownMenuItem
                onClick={() => handleClientSelect('all')}
                className="flex flex-col items-start p-3"
              >
                <div className="font-medium">Todos os clientes</div>
                <div className="text-xs text-muted-foreground">
                  {clients.length} clientes disponíveis
                </div>
              </DropdownMenuItem>
            )}
            
            {filteredClients.length === 0 ? (
              <div className="p-3 text-center text-muted-foreground">
                Nenhum cliente encontrado
              </div>
            ) : (
              filteredClients.map((client) => (
                <DropdownMenuItem
                  key={client.id}
                  onClick={() => handleClientSelect(client.id)}
                  className="flex flex-col items-start p-3"
                >
                  <div className="font-medium">{client.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {client.organization_name}
                    {client.campaigns_count !== undefined && ` • ${client.campaigns_count} campanhas`}
                    {isSuperAdmin && client.total_spend && ` • ${formatCurrency(client.total_spend)}`}
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {searchValue && searchValue !== 'all' && selectedClientData && (
        <div className="mt-2 p-3 bg-muted/50 rounded-lg">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium">{selectedClientData.name}</h4>
              </div>
              {selectedClientData.status && (
                <Badge variant={selectedClientData.status === 'active' ? 'default' : 'secondary'}>
                  {selectedClientData.status === 'active' ? 'Ativo' : 'Inativo'}
                </Badge>
              )}
            </div>
            
            <div className="text-sm text-muted-foreground">
              <div className="flex items-center gap-1 mb-1">
                <Users className="h-3 w-3" />
                <span>{selectedClientData.organization_name}</span>
              </div>
              
              {selectedClientData.email && (
                <div className="mb-1">
                  Email: {selectedClientData.email}
                </div>
              )}
              
              {selectedClientData.phone && (
                <div className="mb-1">
                  Telefone: {selectedClientData.phone}
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Campanhas:</span>
                <div className="font-medium">{selectedClientData.campaigns_count || 0}</div>
              </div>
              {isSuperAdmin && selectedClientData.total_spend !== undefined && (
                <div>
                  <span className="text-muted-foreground">Gasto Total:</span>
                  <div className="font-medium">{formatCurrency(selectedClientData.total_spend)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}