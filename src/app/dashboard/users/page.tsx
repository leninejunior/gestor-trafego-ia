import { UserManagement } from '@/components/organization/user-management';

export default function UsersPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Usuários</h1>
        <p className="text-muted-foreground">
          Gerencie os usuários da sua organização
        </p>
      </div>

      <UserManagement />
    </div>
  );
}
