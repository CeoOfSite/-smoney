import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

import AdminUsersClient from "./admin-users-client";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await getSessionUser();
  if (!admin?.isAdmin) {
    redirect("/");
  }

  return <AdminUsersClient currentAdminSteamId={admin.steamId} />;
}
