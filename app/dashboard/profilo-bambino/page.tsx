import { ChildProfileForm } from "@/components/forms/child-profile-form";
import { requireUser } from "@/server/auth/session";

export default async function DashboardProfiloBambinoPage() {
  await requireUser("/login");

  return <ChildProfileForm />;
}
