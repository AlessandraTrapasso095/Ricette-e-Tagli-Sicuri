"use client";

import { useState } from "react";

import {
  notificationPreferenceItems,
  type NotificationPreferences,
} from "@/config/notification-preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { OptionalUserGender, UserGender } from "@/lib/user-gender";

type ProfileGenderValue = UserGender | "";

interface AccountSettingsFormProps {
  initialEmail: string;
  initialFullName: string;
  initialDisplayName: string;
  initialGender: OptionalUserGender;
  initialNotificationPreferences: NotificationPreferences;
  profileEndpoint?: string;
  notificationEndpoint?: string;
  emailRedirectPath?: string;
}

export function AccountSettingsForm({
  initialEmail,
  initialFullName,
  initialDisplayName,
  initialGender,
  initialNotificationPreferences,
  profileEndpoint = "/api/account/profile",
  notificationEndpoint = "/api/account/notifications",
  emailRedirectPath = "/dashboard/impostazioni",
}: AccountSettingsFormProps) {
  const [fullName, setFullName] = useState(initialFullName);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [gender, setGender] = useState<ProfileGenderValue>(initialGender ?? "");
  const [nextEmail, setNextEmail] = useState(initialEmail);
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(
    initialNotificationPreferences,
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null);

  async function saveProfile() {
    setSavingProfile(true);
    setProfileStatus(null);

    if (!gender) {
      setSavingProfile(false);
      setProfileStatus("Seleziona maschio o femmina.");
      return;
    }

    try {
      const response = await fetch(profileEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          displayName,
          gender,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Aggiornamento profilo non riuscito.");
      }

      setFullName(json.data?.fullName ?? fullName);
      setDisplayName(json.data?.displayName ?? displayName);
      setGender(json.data?.gender ?? gender);
      setProfileStatus(json.data?.warning ?? "Profilo aggiornato correttamente.");
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
      const emailRedirectTo = new URL("/auth/callback", redirectOrigin);
      emailRedirectTo.searchParams.set("next", emailRedirectPath);
      const { error } = await supabase.auth.updateUser(
        { email: nextEmail.trim() },
        { emailRedirectTo: emailRedirectTo.toString() },
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

  async function saveNotifications() {
    setSavingNotifications(true);
    setNotificationStatus(null);

    try {
      const response = await fetch(notificationEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationPreferences),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Aggiornamento notifiche non riuscito.");
      }

      setNotificationPreferences(json.data ?? notificationPreferences);
      setNotificationStatus("Preferenze notifiche aggiornate correttamente.");
    } catch (error) {
      setNotificationStatus(error instanceof Error ? error.message : "Aggiornamento notifiche non riuscito.");
    } finally {
      setSavingNotifications(false);
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
        <div>
          <label className="text-sm font-medium text-zinc-700">Genere</label>
          <Select value={gender} onChange={(event) => setGender(event.target.value as ProfileGenderValue)}>
            <option value="" disabled>
              Seleziona maschio o femmina
            </option>
            <option value="femmina">Femmina</option>
            <option value="maschio">Maschio</option>
          </Select>
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

      <section className="space-y-3 rounded-2xl border border-zinc-200 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">Notifiche</h3>
        <p className="text-sm text-zinc-600">
          Scegli quali notifiche email desideri ricevere. Le comunicazioni essenziali di accesso, sicurezza e recupero
          account restano sempre attive.
        </p>
        <div className="space-y-3">
          {notificationPreferenceItems.map((item) => (
            <label
              key={item.key}
              className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50/40 p-4"
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                checked={notificationPreferences[item.key]}
                onChange={(event) =>
                  setNotificationPreferences((current) => ({
                    ...current,
                    [item.key]: event.target.checked,
                  }))
                }
              />
              <span>
                <span className="block text-sm font-medium text-zinc-800">{item.label}</span>
                <span className="mt-1 block text-sm text-zinc-600">{item.description}</span>
              </span>
            </label>
          ))}
        </div>
        {notificationStatus ? <p className="text-sm text-zinc-700">{notificationStatus}</p> : null}
        <Button type="button" variant="secondary" disabled={savingNotifications} onClick={saveNotifications}>
          {savingNotifications ? "Salvataggio..." : "Salva notifiche"}
        </Button>
      </section>

      <section className="rounded-2xl border border-zinc-200 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">Altro</h3>
        <div className="mt-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
          <p className="text-sm font-medium text-zinc-800">Gestione comunicazioni</p>
          <p className="mt-2 text-sm text-zinc-600">
            Le preferenze notifiche controllano le email opzionali della piattaforma:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-zinc-700">
            <li>
              <span className="font-medium">Ricezione comunicazioni:</span> aggiornamenti importanti, novità e avvisi
              sulla piattaforma.
            </li>
            <li>
              <span className="font-medium">Promozioni:</span> sconti, offerte e nuove uscite.
            </li>
            <li>
              <span className="font-medium">Notifiche personali:</span> messaggi individuali legati al tuo account o a
              iniziative dedicate.
            </li>
            <li>
              <span className="font-medium">Ticket supporto:</span> avvisi quando arriva una nuova risposta nei tuoi
              ticket.
            </li>
          </ul>
          <p className="mt-3 text-sm text-zinc-600">
            Restano sempre attive le email tecniche indispensabili, come conferma indirizzo email, recupero password e
            sicurezza account.
          </p>
        </div>
      </section>
    </div>
  );
}
