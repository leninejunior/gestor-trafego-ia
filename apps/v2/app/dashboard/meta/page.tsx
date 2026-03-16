import { ensureDashboardAccess } from "@/app/dashboard/_lib/ensure-dashboard-access";

import { MetaDashboardClient } from "./meta-dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardMetaPage() {
  await ensureDashboardAccess("/dashboard/meta");

  return <MetaDashboardClient />;
}
