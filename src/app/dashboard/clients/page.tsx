import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddClientButton } from "./add-client-button";

export const dynamic = 'force-dynamic'; // Garante que a página seja sempre renderizada dinamicamente

interface Client {
  id: string;
  name: string;
  created_at: string;
}

export default async function ClientsPage() {
  const supabase = createClient();

  const { data: clients, error } = await supabase
    .from("clients")
    .select("*");

  if (error) {
    console.error("Error fetching clients:", error);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Clientes</h1>
        <AddClientButton />
      </div>
      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableCaption>Uma lista dos seus clientes recentes.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Nome</TableHead>
              <TableHead>Data de Criação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients?.map((client: Client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">{client.name}</TableCell>
                <TableCell>
                  {new Date(client.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}