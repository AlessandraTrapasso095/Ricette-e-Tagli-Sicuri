export const siteConfig = {
  name: "Ricette e Tagli Sicuri",
  description:
    "Area lettori privata per sbloccare i bonus dei libri, creare menu giornalieri personalizzati e gestire il profilo del tuo bambino.",
  url: process.env.APP_BASE_URL ?? "http://localhost:3000",
  supportEmail: process.env.SUPPORT_TARGET_EMAIL ?? "ricettetaglisicuri@gmail.com",
};

export const defaultMetadata = {
  title: siteConfig.name,
  description: siteConfig.description,
};
