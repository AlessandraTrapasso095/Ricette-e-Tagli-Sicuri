import "server-only";

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from "@/config/notification-preferences";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface NotificationPreferenceRow {
  receive_communications: boolean | null;
  receive_promotions: boolean | null;
  receive_personal_notifications: boolean | null;
  receive_ticket_updates: boolean | null;
}

function mapRowToPreferences(row?: NotificationPreferenceRow | null): NotificationPreferences {
  return {
    communications: row?.receive_communications ?? DEFAULT_NOTIFICATION_PREFERENCES.communications,
    promotions: row?.receive_promotions ?? DEFAULT_NOTIFICATION_PREFERENCES.promotions,
    personalNotifications:
      row?.receive_personal_notifications ?? DEFAULT_NOTIFICATION_PREFERENCES.personalNotifications,
    ticketUpdates: row?.receive_ticket_updates ?? DEFAULT_NOTIFICATION_PREFERENCES.ticketUpdates,
  };
}

export function buildNotificationPreferencesUpdate(
  preferences: NotificationPreferences,
): NotificationPreferenceRow {
  return {
    receive_communications: preferences.communications,
    receive_promotions: preferences.promotions,
    receive_personal_notifications: preferences.personalNotifications,
    receive_ticket_updates: preferences.ticketUpdates,
  };
}

export async function getUserNotificationPreferences(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select(
      "receive_communications, receive_promotions, receive_personal_notifications, receive_ticket_updates",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mapRowToPreferences((data ?? null) as NotificationPreferenceRow | null);
}

export async function updateUserNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences,
) {
  const admin = createSupabaseAdminClient();
  const payload = buildNotificationPreferencesUpdate(preferences);

  const { error } = await admin.from("profiles").update(payload).eq("id", userId);
  if (error) {
    throw error;
  }

  return preferences;
}
