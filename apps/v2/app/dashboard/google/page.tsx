import { ensureDashboardAccess } from "@/app/dashboard/_lib/ensure-dashboard-access";

import { GoogleDashboardClient } from "./google-dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardGooglePage() {
  await ensureDashboardAccess("/dashboard/google");

  return <GoogleDashboardClient />;
}
