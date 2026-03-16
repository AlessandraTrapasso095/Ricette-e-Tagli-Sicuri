import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/forms/register-form";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/server/auth/session";
import { getPostLoginPath } from "@/server/auth/post-login-path";

export const metadata = {
  title: "Registrazione | Ricette e Tagli Sicuri",
};

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) {
    const path = await getPostLoginPath(user.id, user.email);
    redirect(path);
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-14 sm:px-6 lg:px-8">
      <Card>
        <h1 className="font-heading text-3xl text-rose-900">Crea il tuo account</h1>
        <p className="mt-2 text-sm text-zinc-600">Dopo la verifica email potrai sbloccare i libri acquistati.</p>
        <div className="mt-6">
          <RegisterForm />
        </div>
      </Card>
    </div>
  );
}
