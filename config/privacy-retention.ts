export type RetentionFilter =
  | {
      type: "eq";
      column: string;
      value: string | number | boolean | null;
    }
  | {
      type: "in";
      column: string;
      value: string[];
    };

export interface DataRetentionPolicy {
  key: "menu_sessions" | "access_attempt_logs" | "bonus_download_logs" | "user_email_events";
  table: "menu_sessions" | "access_attempt_logs" | "bonus_download_logs" | "user_email_events";
  dateColumn: string;
  days: number;
  filters?: RetentionFilter[];
  label: string;
  privacyDescription: string;
}

export const DATA_RETENTION_POLICIES: readonly DataRetentionPolicy[] = [
  {
    key: "menu_sessions",
    table: "menu_sessions",
    dateColumn: "created_at",
    days: 30,
    filters: [{ type: "eq", column: "is_archived", value: true }],
    label: "Sessioni chat archiviate",
    privacyDescription:
      "Le sessioni chat archiviate e i relativi messaggi vengono eliminati automaticamente dopo 30 giorni.",
  },
  {
    key: "access_attempt_logs",
    table: "access_attempt_logs",
    dateColumn: "created_at",
    days: 90,
    label: "Tentativi challenge e log accesso",
    privacyDescription:
      "I log tecnici dei tentativi di accesso ai libri vengono eliminati automaticamente dopo 90 giorni.",
  },
  {
    key: "bonus_download_logs",
    table: "bonus_download_logs",
    dateColumn: "downloaded_at",
    days: 180,
    label: "Log download bonus",
    privacyDescription:
      "I log di download dei bonus PDF vengono eliminati automaticamente dopo 180 giorni.",
  },
  {
    key: "user_email_events",
    table: "user_email_events",
    dateColumn: "sent_at",
    days: 365,
    label: "Eventi email transazionali",
    privacyDescription:
      "Gli eventi tecnici delle email transazionali vengono eliminati automaticamente dopo 365 giorni.",
  },
] as const;
