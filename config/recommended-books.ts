export interface RecommendedBook {
  id?: string;
  title: string;
  subtitle?: string;
  url: string;
  isActive?: boolean;
}

export const READER_BOOK_RECOMMENDATIONS: RecommendedBook[] = [
  { id: "rts", title: "Ricette e Tagli Sicuri", subtitle: "Apri su Amazon", url: "https://amzn.to/4uiVAa1", isActive: true },
  {
    id: "rsc",
    title: "Ricette e Svezzamento Classico",
    subtitle: "Apri su Amazon",
    url: "https://amzn.to/3PdXLvb",
    isActive: true,
  },
  {
    id: "raf",
    title: "Ricette e Autosvezzamento Felice",
    subtitle: "Apri su Amazon",
    url: "https://amzn.to/4sFy70V",
    isActive: true,
  },
  { id: "cm", title: "Colazione e Merenda", subtitle: "Apri su Amazon", url: "https://amzn.to/4cCakKA", isActive: true },
  {
    id: "csa",
    title: "Come Smettere di Allattare",
    subtitle: "Apri su Amazon",
    url: "https://amzn.to/3P0NiTW",
    isActive: true,
  },
  {
    id: "neo-mamma",
    title: "Tutte le Cose che da Neo-Mamma Avrei Voluto Sapere",
    subtitle: "Apri su Amazon",
    url: "https://amzn.to/4lnQh4Z",
    isActive: true,
  },
  {
    id: "libretto-rosa",
    title: "Libretto Sanitario Pediatrico Rosa",
    subtitle: "Apri su Amazon",
    url: "https://amzn.to/3Pvz3Xh",
    isActive: true,
  },
  {
    id: "libretto-blu",
    title: "Libretto Sanitario Pediatrico Blu",
    subtitle: "Apri su Amazon",
    url: "https://amzn.to/4ljR72y",
    isActive: true,
  },
  {
    id: "libretto-giallo",
    title: "Libretto Sanitario Pediatrico Giallo",
    subtitle: "Apri su Amazon",
    url: "https://amzn.to/4b6nKNW",
    isActive: true,
  },
  {
    id: "favole",
    title: "C'era una Volta...e ancora: Libro di Favole della Buonanotte",
    subtitle: "Apri su Amazon",
    url: "https://amzn.to/3OTZK85",
    isActive: true,
  },
];
