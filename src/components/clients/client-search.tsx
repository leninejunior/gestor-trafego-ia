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
import { Building2, Users, ChevronDown, Search, Crown, Shield, User } from 'lucide-react';
import { useUserAccessNew } from '@/hooks/use-user-access-new';
import { cn } from '@/lib/utils';

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
  triggerClassName?: string;
  dropdownContentClassName?: string;
  showAllOption?: boolean;
  isSuperAdmin?: boolean;
  filterByAccess?: boolean; // New prop to enable access filtering
  showUserContext?: boolean;
  showSelectedClientDetails?: boolean;
}

export function ClientSearch({
  clients,
  selectedClient,
  onClientSelect,
  placeholder = 'Buscar cliente...',
  className,
  triggerClassName,
  dropdownContentClassName,
  showAllOption = true,
  isSuperAdmin = false,
  filterByAccess = true,
  showUserContext = true,
  showSelectedClientDetails = true
}: ClientSearchProps) {
  const [searchValue, setSearchValue] = useState(selectedClient || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [accessibleClients, setAccessibleClients] = useState<Client[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(false);

  const { userType, isSuperAdmin: isUserSuperAdmin, getUserAccessibleClients } = useUserAccessNew();

  useEffect(() => {
    setSearchValue(selectedClient || '');
  }, [selectedClient]);

  // Load accessible clients when filterByAccess is enabled
  useEffect(() => {
    const loadAccessibleClients = async () => {
      if (!filterByAccess || isUserSuperAdmin) {
        setAccessibleClients(clients);
        return;
      }

      setLoadingAccess(true);
      try {
        const accessible = await getUserAccessibleClients();
        // Filter the provided clients to only include accessible ones
        const filteredClients = clients.filter(client => 
          accessible.some(ac => ac.id === client.id)
        );
        setAccessibleClients(filteredClients);
      } catch (error) {
        console.error('Erro ao carregar clientes acessíveis:', error);
        setAccessibleClients([]);
      } finally {
        setLoadingAccess(false);
      }
    };

    loadAccessibleClients();
  }, [clients, filterByAccess, isUserSuperAdmin, getUserAccessibleClients]);

  const formatCurrency = (value?: number) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Use accessible clients if filtering is enabled
  const displayClients = filterByAccess ? accessibleClients : clients;
  const selectedClientData = displayClients.find(c => c.id === searchValue);
  const selectedLabel = selectedClientData ? selectedClientData.name : 
                       (searchValue === 'all' ? 'Todos os clientes' : placeholder);

  // Filtrar clientes baseado na busca
  const filteredClients = displayClients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.organization_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get user type icon
  const getUserTypeIcon = () => {
    if (isUserSuperAdmin) return <Crown className="h-4 w-4 text-yellow-600" />;
    if (userType === 'org_admin') return <Shield className="h-4 w-4 text-blue-600" />;
    return <User className="h-4 w-4 text-gray-600" />;
  };

  const handleClientSelect = (clientId: string) => {
    setSearchValue(clientId);
    onClientSelect(clientId);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={className}>
      {/* User Type Indicator */}
      {showUserContext && userType && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          {getUserTypeIcon()}
          <span>
            {isUserSuperAdmin ? 'Super Admin' : 
             userType === 'org_admin' ? 'Admin da Organização' : 
             'Usuário Comum'}
          </span>
          {filterByAccess && !isUserSuperAdmin && (
            <span className="text-xs">
              • {displayClients.length} cliente(s) autorizado(s)
            </span>
          )}
        </div>
      )}

      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-between",
              triggerClassName
            )}
            onClick={() => setIsOpen(!isOpen)}
            disabled={loadingAccess}
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">
                {loadingAccess ? 'Carregando...' : selectedLabel}
              </span>
            </div>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className={cn(
            "w-[var(--radix-dropdown-menu-trigger-width)] min-w-[18rem] p-0",
            dropdownContentClassName
          )}
          align="start"
        >
          <div className="p-2">
            <Input
              placeholder="Digite para buscar clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-2"
            />
          </div>
          
          <div className="max-h-64 overflow-auto">
            {showAllOption && displayClients.length > 0 && (
              <DropdownMenuItem
                onClick={() => handleClientSelect('all')}
                className="flex flex-col items-start p-3"
              >
                <div className="font-medium">Todos os clientes</div>
                <div className="text-xs text-muted-foreground">
                  {displayClients.length} clientes {filterByAccess && !isUserSuperAdmin ? 'autorizados' : 'disponíveis'}
                </div>
              </DropdownMenuItem>
            )}
            
            {filteredClients.length === 0 ? (
              <div className="p-3 text-center text-muted-foreground">
                {loadingAccess ? 'Carregando clientes...' : 
                 filterByAccess && !isUserSuperAdmin ? 'Nenhum cliente autorizado encontrado' : 
                 'Nenhum cliente encontrado'}
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
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {showSelectedClientDetails && searchValue && searchValue !== 'all' && selectedClientData && (
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
            
            {(selectedClientData.campaigns_count !== undefined || selectedClientData.total_spend !== undefined) && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                {selectedClientData.campaigns_count !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Campanhas:</span>
                    <div className="font-medium">{selectedClientData.campaigns_count}</div>
                  </div>
                )}
                {isSuperAdmin && selectedClientData.total_spend !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Gasto Total:</span>
                    <div className="font-medium">{formatCurrency(selectedClientData.total_spend)}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
