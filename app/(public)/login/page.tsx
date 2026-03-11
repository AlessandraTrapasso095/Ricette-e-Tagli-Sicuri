import { redirect } from "next/navigation";

import { LoginForm } from "@/components/forms/login-form";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/server/auth/session";
import { getPostLoginPath } from "@/server/auth/post-login-path";

export const metadata = {
  title: "Accedi | Ricette e Tagli Sicuri",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    const path = await getPostLoginPath(user.id, user.email);
    redirect(path);
  }

  const { reason } = await searchParams;
  const reasonMessage =
    reason === "timeout"
      ? "Sessione terminata per inattività (10 minuti)."
      : null;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-14 sm:px-6 lg:px-8">
      <Card>
        <h1 className="font-heading text-3xl text-rose-900">Bentornata nell&apos;Area Lettori</h1>
        <p className="mt-2 text-sm text-zinc-600">Accedi per visualizzare libri sbloccati, bonus e chat menu.</p>
        {reasonMessage ? <p className="mt-2 text-sm text-amber-700">{reasonMessage}</p> : null}
        <div className="mt-6">
          <LoginForm />
          <ResetPasswordForm />
        </div>
      </Card>
    </div>
  );
}
