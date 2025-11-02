import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { 
  ArrowLeft,
  Users, 
  Search,
  Filter,
  UserCheck,
  UserX,
  Shield,
  Mail,
  Calendar,
  Building2,
  Settings,
  Ban,
  CheckCircle,
  XCircle,
  Clock,
  Eye
} from "lucide-react";
import UserManagementSimple from "@/components/admin/user-management-simple";

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  return <UserManagementSimple />;
}