export type NotificationPreferenceKey =
  | "communications"
  | "promotions"
  | "personalNotifications"
  | "ticketUpdates";

export interface NotificationPreferences {
  communications: boolean;
  promotions: boolean;
  personalNotifications: boolean;
  ticketUpdates: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  communications: true,
  promotions: true,
  personalNotifications: true,
  ticketUpdates: true,
};

export const notificationPreferenceItems: Array<{
  key: NotificationPreferenceKey;
  label: string;
  description: string;
}> = [
  {
    key: "communications",
    label: "Ricezione comunicazioni",
    description: "Novità importanti sulla piattaforma, aggiornamenti di servizio e nuove funzioni.",
  },
  {
    key: "promotions",
    label: "Promozioni",
    description: "Sconti, offerte dedicate, nuove uscite e comunicazioni commerciali.",
  },
  {
    key: "personalNotifications",
    label: "Notifiche personali",
    description: "Comunicazioni individuali legate al tuo account o a iniziative dedicate ai lettori.",
  },
  {
    key: "ticketUpdates",
    label: "Ticket supporto",
    description: "Avvisi via email quando ricevi una risposta nella sezione Ticket.",
  },
];

export type BroadcastAudienceCategory = "communications" | "promotions";

export const broadcastAudienceLabels: Record<BroadcastAudienceCategory, string> = {
  communications: "Comunicazioni",
  promotions: "Promozioni",
};
