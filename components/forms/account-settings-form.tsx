"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

interface AccountSettingsFormProps {
  initialEmail: string;
  initialFullName: string;
  initialDisplayName: string;
}

export function AccountSettingsForm({ initialEmail, initialFullName, initialDisplayName }: AccountSettingsFormProps) {
  const [fullName, setFullName] = useState(initialFullName);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [nextEmail, setNextEmail] = useState(initialEmail);
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);

  async function saveProfile() {
    setSavingProfile(true);
    setProfileStatus(null);

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          displayName,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Aggiornamento profilo non riuscito.");
      }

      setFullName(json.data?.fullName ?? fullName);
      setDisplayName(json.data?.displayName ?? displayName);
      setProfileStatus("Profilo aggiornato correttamente.");
    } catch (error) {
      setProfileStatus(error instanceof Error ? error.message : "Aggiornamento profilo non riuscito.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function updateEmail() {
    setSavingEmail(true);
    setEmailStatus(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const redirectOrigin = window.location.origin;
      const { error } = await supabase.auth.updateUser(
        { email: nextEmail.trim() },
        { emailRedirectTo: `${redirectOrigin}/auth/callback?next=/dashboard/impostazioni` },
      );

      if (error) {
        throw error;
      }

      setEmailStatus("Richiesta inviata. Controlla la nuova email per confermare il cambio.");
    } catch (error) {
      setEmailStatus(error instanceof Error ? error.message : "Aggiornamento email non riuscito.");
    } finally {
      setSavingEmail(false);
    }
  }

  async function updatePassword() {
    if (nextPassword.length < 8) {
      setPasswordStatus("La nuova password deve contenere almeno 8 caratteri.");
      return;
    }

    if (nextPassword !== confirmPassword) {
      setPasswordStatus("Le password non coincidono.");
      return;
    }

    setSavingPassword(true);
    setPasswordStatus(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password: nextPassword });

      if (error) {
        throw error;
      }

      setNextPassword("");
      setConfirmPassword("");
      setPasswordStatus("Password aggiornata con successo.");
    } catch (error) {
      setPasswordStatus(error instanceof Error ? error.message : "Aggiornamento password non riuscito.");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="mt-5 space-y-6">
      <section className="space-y-3 rounded-2xl border border-zinc-200 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">Profilo</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-zinc-700">Nome e cognome</label>
            <Input value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Nome utente</label>
            <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </div>
        </div>
        {profileStatus ? <p className="text-sm text-zinc-700">{profileStatus}</p> : null}
        <Button type="button" disabled={savingProfile} onClick={saveProfile}>
          {savingProfile ? "Salvataggio..." : "Salva profilo"}
        </Button>
      </section>

      <section className="space-y-3 rounded-2xl border border-zinc-200 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">Email</h3>
        <div>
          <label className="text-sm font-medium text-zinc-700">Nuova email</label>
          <Input type="email" value={nextEmail} onChange={(event) => setNextEmail(event.target.value)} />
        </div>
        {emailStatus ? <p className="text-sm text-zinc-700">{emailStatus}</p> : null}
        <Button type="button" variant="secondary" disabled={savingEmail} onClick={updateEmail}>
          {savingEmail ? "Invio..." : "Aggiorna email"}
        </Button>
      </section>

      <section className="space-y-3 rounded-2xl border border-zinc-200 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">Password</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-zinc-700">Nuova password</label>
            <Input type="password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Conferma password</label>
            <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </div>
        </div>
        {passwordStatus ? <p className="text-sm text-zinc-700">{passwordStatus}</p> : null}
        <Button type="button" variant="secondary" disabled={savingPassword} onClick={updatePassword}>
          {savingPassword ? "Aggiornamento..." : "Aggiorna password"}
        </Button>
      </section>

      <section className="rounded-2xl border border-zinc-200 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">Altro</h3>
        <p className="mt-2 text-sm text-zinc-600">Prossimamente: preferenze notifiche e gestione comunicazioni.</p>
      </section>
    </div>
  );
}
