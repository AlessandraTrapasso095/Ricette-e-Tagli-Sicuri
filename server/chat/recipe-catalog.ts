import type { MealType } from "@/config/business-rules";

export type RecipeStyle = "classico" | "autosvezzamento";
export type RecipeProteinGroup = "legumi" | "pesce" | "latticino" | "carne" | "uovo";

export interface ChatRecipe {
  id: string;
  style: RecipeStyle;
  mealType: MealType;
  family: string;
  dishName: string;
  ingredients: string[];
  preparation: string;
  notes: string[];
  safetyNotes: string[];
  substitutions: string[];
  meta: {
    fruit?: string;
    carb?: string;
    protein?: string;
    vegetable?: string;
    proteinGroup?: RecipeProteinGroup;
  };
}

function makeSweetRecipe(params: {
  id: string;
  style: RecipeStyle;
  mealType: "colazione" | "merenda";
  family: string;
  dishName: string;
  ingredients: string[];
  preparation: string;
  fruit?: string;
}) {
  return {
    ...params,
    notes: [
      "Preparazione baby, senza sale e senza zucchero aggiunto.",
    ],
    safetyNotes: [
      params.style === "classico"
        ? "Offri in consistenza liscia o molto morbida."
        : "Offri in forma morbida e nei tagli sicuri adeguati.",
    ],
    substitutions: ["Puoi variare la frutta mantenendo ingredienti semplici e naturali."],
    meta: {
      fruit: params.fruit,
    },
  } satisfies ChatRecipe;
}

function makeMainRecipe(params: {
  id: string;
  style: RecipeStyle;
  mealType: "pranzo" | "cena";
  family: string;
  dishName: string;
  ingredients: string[];
  preparation: string;
  carb: string;
  protein: string;
  vegetable: string;
  proteinGroup: RecipeProteinGroup;
}) {
  return {
    ...params,
    notes: [
      "Pasto completo per 1 bambino con carboidrati, proteine, verdure e grassi buoni.",
    ],
    safetyNotes: [
      params.style === "classico"
        ? "Mantieni consistenza cremosa, vellutata o ben schiacciata."
        : "Offri sempre nei tagli sicuri adeguati all'eta del bambino.",
    ],
    substitutions: ["Puoi cambiare la verdura mantenendo il piatto bilanciato e senza sale."],
    meta: {
      carb: params.carb,
      protein: params.protein,
      vegetable: params.vegetable,
      proteinGroup: params.proteinGroup,
    },
  } satisfies ChatRecipe;
}

const classicoBreakfastRecipes: ChatRecipe[] = [
  makeSweetRecipe({
    id: "classico-colazione-porridge-mela-cannella",
    style: "classico",
    mealType: "colazione",
    family: "porridge",
    dishName: "Porridge mela e cannella",
    ingredients: ["20 g fiocchi di avena", "120 ml acqua o latte", "45 g mela cotta", "1 pizzico di cannella"],
    preparation: "Cuoci i fiocchi di avena con acqua o latte fino a ottenere una crema morbida. Aggiungi la mela cotta frullata e un pizzico di cannella, poi servi tiepido.",
    fruit: "mela",
  }),
  makeSweetRecipe({
    id: "classico-colazione-porridge-banana-cacao",
    style: "classico",
    mealType: "colazione",
    family: "porridge",
    dishName: "Porridge banana e cacao",
    ingredients: ["20 g fiocchi di avena", "120 ml acqua o latte", "40 g banana schiacciata", "1 cucchiaino cacao amaro"],
    preparation: "Cuoci i fiocchi di avena con acqua o latte fino a renderli cremosi. Unisci la banana schiacciata e il cacao amaro, mescola bene e servi morbido.",
    fruit: "banana",
  }),
  makeSweetRecipe({
    id: "classico-colazione-porridge-pera-cannella",
    style: "classico",
    mealType: "colazione",
    family: "porridge",
    dishName: "Porridge pera e cannella",
    ingredients: ["20 g fiocchi di avena", "120 ml acqua o latte", "45 g pera cotta", "1 pizzico di cannella"],
    preparation: "Cuoci i fiocchi di avena con il liquido scelto fino a ottenere una crema morbida. Aggiungi la pera cotta frullata e la cannella, poi servi tiepido.",
    fruit: "pera",
  }),
  makeSweetRecipe({
    id: "classico-colazione-porridge-mela-banana",
    style: "classico",
    mealType: "colazione",
    family: "porridge",
    dishName: "Porridge mela e banana",
    ingredients: ["20 g fiocchi di avena", "120 ml acqua o latte", "25 g mela cotta", "25 g banana schiacciata"],
    preparation: "Cuoci i fiocchi di avena finche diventano morbidi e cremosi. Unisci mela cotta e banana schiacciata, mescola bene e servi.",
    fruit: "mela banana",
  }),
  makeSweetRecipe({
    id: "classico-colazione-crema-latte-pera",
    style: "classico",
    mealType: "colazione",
    family: "crema-latte",
    dishName: "Crema di latte e pera",
    ingredients: ["15 g crema di riso", "100 ml latte", "45 g pera cotta frullata"],
    preparation: "Scalda il latte e versa la crema di riso a pioggia fino a ottenere una crema liscia. Aggiungi la pera cotta frullata e servi tiepido.",
    fruit: "pera",
  }),
  makeSweetRecipe({
    id: "classico-colazione-yogurt-pesca",
    style: "classico",
    mealType: "colazione",
    family: "yogurt",
    dishName: "Yogurt con purea di pesca",
    ingredients: ["80 g yogurt bianco intero", "40 g purea di pesca"],
    preparation: "Versa lo yogurt in una ciotola e aggiungi la purea di pesca. Mescola fino a ottenere una consistenza omogenea e servi a temperatura ambiente.",
    fruit: "pesca",
  }),
  makeSweetRecipe({
    id: "classico-colazione-yogurt-prugna",
    style: "classico",
    mealType: "colazione",
    family: "yogurt",
    dishName: "Yogurt con purea di prugna",
    ingredients: ["80 g yogurt bianco intero", "40 g purea di prugna"],
    preparation: "Mescola yogurt bianco e purea di prugna ben liscia. Servi subito in consistenza morbida e uniforme.",
    fruit: "prugna",
  }),
  makeSweetRecipe({
    id: "classico-colazione-budino-mela-semolino",
    style: "classico",
    mealType: "colazione",
    family: "budino",
    dishName: "Budino di mela e semolino",
    ingredients: ["15 g semolino", "120 ml acqua o latte", "40 g mela cotta frullata"],
    preparation: "Cuoci il semolino nel liquido scelto fino a farlo addensare. Unisci la mela cotta frullata, mescola bene e servi in consistenza tipo budino.",
    fruit: "mela",
  }),
  makeSweetRecipe({
    id: "classico-colazione-frullato-banana-mela",
    style: "classico",
    mealType: "colazione",
    family: "frullato",
    dishName: "Frullato banana e mela",
    ingredients: ["40 g banana", "35 g mela cotta", "70 ml acqua o latte"],
    preparation: "Frulla banana e mela cotta con poca acqua o latte fino a ottenere un composto liscio e senza pezzi. Servi subito.",
    fruit: "banana mela",
  }),
];

const classicoLunchRecipes: ChatRecipe[] = [
  makeMainRecipe({
    id: "classico-pranzo-prima-pappa-classica",
    style: "classico",
    mealType: "pranzo",
    family: "pappa-classica",
    dishName: "Prima pappa classica",
    ingredients: ["150 ml brodo vegetale", "20 g crema di riso", "25 g pollo frullato", "50 g carota cotta", "1 cucchiaino olio EVO a crudo"],
    preparation: "Scalda il brodo vegetale e unisci la crema di riso mescolando. Aggiungi pollo frullato e carota ben cotta, amalgama fino a ottenere una pappa liscia e completa con olio EVO.",
    carb: "crema di riso",
    protein: "pollo",
    vegetable: "carota",
    proteinGroup: "carne",
  }),
  makeMainRecipe({
    id: "classico-pranzo-pastina-zucca",
    style: "classico",
    mealType: "pranzo",
    family: "pastina",
    dishName: "Pastina con crema di zucca",
    ingredients: ["25 g pastina", "60 g zucca cotta", "20 g ricotta fresca", "150 ml brodo vegetale", "1 cucchiaino olio EVO a crudo"],
    preparation: "Cuoci la pastina nel brodo vegetale. Frulla la zucca con la ricotta fino a ottenere una crema liscia, uniscila alla pastina e completa con olio EVO.",
    carb: "pastina",
    protein: "ricotta fresca",
    vegetable: "zucca",
    proteinGroup: "latticino",
  }),
  makeMainRecipe({
    id: "classico-pranzo-pastina-zucchine",
    style: "classico",
    mealType: "pranzo",
    family: "pastina",
    dishName: "Pastina con crema di zucchine",
    ingredients: ["25 g pastina", "60 g zucchine cotte", "25 g robiola", "150 ml brodo vegetale", "1 cucchiaino olio EVO a crudo"],
    preparation: "Cuoci la pastina nel brodo. Frulla le zucchine con la robiola fino a ottenere una crema morbida, mescola alla pastina e servi con olio EVO a crudo.",
    carb: "pastina",
    protein: "robiola",
    vegetable: "zucchine",
    proteinGroup: "latticino",
  }),
  makeMainRecipe({
    id: "classico-pranzo-pastina-pollo",
    style: "classico",
    mealType: "pranzo",
    family: "pastina",
    dishName: "Pastina con pollo",
    ingredients: ["25 g pastina", "30 g pollo cotto", "50 g carota cotta", "150 ml brodo vegetale", "1 cucchiaino olio EVO a crudo"],
    preparation: "Cuoci la pastina nel brodo. Frulla pollo e carota con poco brodo fino a ottenere una crema liscia, unisci alla pastina e completa con olio EVO.",
    carb: "pastina",
    protein: "pollo",
    vegetable: "carota",
    proteinGroup: "carne",
  }),
  makeMainRecipe({
    id: "classico-pranzo-pastina-tacchino",
    style: "classico",
    mealType: "pranzo",
    family: "pastina",
    dishName: "Pastina con tacchino",
    ingredients: ["25 g pastina", "30 g tacchino cotto", "50 g zucchine cotte", "150 ml brodo vegetale", "1 cucchiaino olio EVO a crudo"],
    preparation: "Cuoci la pastina nel brodo vegetale. Frulla tacchino e zucchine fino a ottenere un composto liscio, unisci alla pastina e servi con olio EVO.",
    carb: "pastina",
    protein: "tacchino",
    vegetable: "zucchine",
    proteinGroup: "carne",
  }),
  makeMainRecipe({
    id: "classico-pranzo-pastina-pesce",
    style: "classico",
    mealType: "pranzo",
    family: "pastina",
    dishName: "Pastina con pesce",
    ingredients: ["25 g pastina", "30 g merluzzo cotto", "50 g carota cotta", "150 ml brodo vegetale", "1 cucchiaino olio EVO a crudo"],
    preparation: "Cuoci la pastina nel brodo. Frulla il merluzzo con la carota ben cotta e unisci la crema ottenuta alla pastina. Completa con olio EVO a crudo.",
    carb: "pastina",
    protein: "merluzzo",
    vegetable: "carota",
    proteinGroup: "pesce",
  }),
  makeMainRecipe({
    id: "classico-pranzo-cavolfiore-manzo",
    style: "classico",
    mealType: "pranzo",
    family: "pastina",
    dishName: "Pastina cavolfiore e manzo",
    ingredients: ["25 g pastina", "30 g manzo cotto", "60 g cavolfiore cotto", "150 ml brodo vegetale", "1 cucchiaino olio EVO a crudo"],
    preparation: "Cuoci la pastina nel brodo. Frulla manzo e cavolfiore con poco brodo fino a ottenere una crema morbida, uniscila alla pastina e servi con olio EVO.",
    carb: "pastina",
    protein: "manzo",
    vegetable: "cavolfiore",
    proteinGroup: "carne",
  }),
  makeMainRecipe({
    id: "classico-pranzo-merluzzo-formaggio",
    style: "classico",
    mealType: "pranzo",
    family: "pastina",
    dishName: "Pastina merluzzo e formaggio",
    ingredients: ["25 g pastina", "30 g merluzzo cotto", "20 g robiola", "50 g zucchine cotte", "150 ml brodo vegetale", "1 cucchiaino olio EVO a crudo"],
    preparation: "Cuoci la pastina e prepara una crema frullando merluzzo, robiola e zucchine. Unisci alla pastina, mescola bene e servi con olio EVO.",
    carb: "pastina",
    protein: "merluzzo e robiola",
    vegetable: "zucchine",
    proteinGroup: "pesce",
  }),
  makeMainRecipe({
    id: "classico-pranzo-pasta-ragu-carne",
    style: "classico",
    mealType: "pranzo",
    family: "pastina",
    dishName: "Pastina con ragu di carne",
    ingredients: ["25 g pastina", "30 g manzo macinato", "50 g carota cotta", "30 g passata di pomodoro", "1 cucchiaino olio EVO a crudo"],
    preparation: "Cuoci molto bene la pastina nel brodo o in acqua. Prepara un ragu delicato con manzo, carota e passata di pomodoro; frulla leggermente se serve e condisci la pastina con olio EVO.",
    carb: "pastina",
    protein: "manzo",
    vegetable: "carota",
    proteinGroup: "carne",
  }),
  makeMainRecipe({
    id: "classico-pranzo-pasta-lenticchie",
    style: "classico",
    mealType: "pranzo",
    family: "pastina",
    dishName: "Pastina con lenticchie",
    ingredients: ["25 g pastina", "35 g lenticchie decorticate cotte", "50 g carota cotta", "1 cucchiaino olio EVO a crudo"],
    preparation: "Cuoci molto bene la pastina. Frulla lenticchie e carota fino a ottenere una crema morbida, condisci la pastina e completa con olio EVO.",
    carb: "pastina",
    protein: "lenticchie decorticate",
    vegetable: "carota",
    proteinGroup: "legumi",
  }),
  makeMainRecipe({
    id: "classico-pranzo-pasta-ceci-pomodoro",
    style: "classico",
    mealType: "pranzo",
    family: "pastina",
    dishName: "Pastina con ceci e pomodoro",
    ingredients: ["25 g pastina", "35 g ceci decorticati cotti", "40 g passata di pomodoro", "40 g zucchine cotte", "1 cucchiaino olio EVO a crudo"],
    preparation: "Cuoci la pastina finche morbida. Frulla ceci, zucchine e poca passata di pomodoro fino a ottenere un condimento liscio, poi condisci la pastina e aggiungi olio EVO.",
    carb: "pastina",
    protein: "ceci decorticati",
    vegetable: "zucchine",
    proteinGroup: "legumi",
  }),
  makeMainRecipe({
    id: "classico-pranzo-pasta-tacchino-zucchine",
    style: "classico",
    mealType: "pranzo",
    family: "pastina",
    dishName: "Pastina con tacchino e zucchine",
    ingredients: ["25 g pastina", "30 g tacchino cotto", "60 g zucchine cotte", "1 cucchiaino olio EVO a crudo"],
    preparation: "Cuoci molto bene la pastina. Frulla tacchino e zucchine con poca acqua di cottura fino a ottenere un sugo morbido, condisci la pastina e servi con olio EVO.",
    carb: "pastina",
    protein: "tacchino",
    vegetable: "zucchine",
    proteinGroup: "carne",
  }),
  makeMainRecipe({
    id: "classico-pranzo-pasta-ricotta-spinaci",
    style: "classico",
    mealType: "pranzo",
    family: "pastina",
    dishName: "Pastina con ricotta e spinaci",
    ingredients: ["25 g pastina", "25 g ricotta fresca", "50 g spinaci cotti", "1 cucchiaino olio EVO a crudo"],
    preparation: "Cuoci la pastina. Frulla spinaci e ricotta fino a ottenere una crema liscia, usa il composto per condire la pastina e completa con olio EVO.",
    carb: "pastina",
    protein: "ricotta fresca",
    vegetable: "spinaci",
    proteinGroup: "latticino",
  }),
  makeMainRecipe({
    id: "classico-pranzo-pasta-salmone-zucchine",
    style: "classico",
    mealType: "pranzo",
    family: "pastina",
    dishName: "Pastina con salmone e zucchine",
    ingredients: ["25 g pastina", "30 g salmone cotto", "50 g zucchine cotte", "1 cucchiaino olio EVO a crudo"],
    preparation: "Cuoci molto bene la pastina. Frulla salmone e zucchine fino a ottenere un condimento morbido, poi condisci la pastina e servi con olio EVO.",
    carb: "pastina",
    protein: "salmone",
    vegetable: "zucchine",
    proteinGroup: "pesce",
  }),
  makeMainRecipe({
    id: "classico-pranzo-riso-zucchine-formaggio",
    style: "classico",
    mealType: "pranzo",
    family: "riso",
    dishName: "Riso con zucchine e formaggio",
    ingredients: ["25 g riso", "20 g robiola", "60 g zucchine cotte", "1 cucchiaino olio EVO a crudo"],
    preparation: "Cuoci il riso finche molto morbido. Frulla zucchine e robiola per creare una crema delicata, uniscila al riso e completa con olio EVO.",
    carb: "riso",
    protein: "robiola",
    vegetable: "zucchine",
    proteinGroup: "latticino",
  }),
  makeMainRecipe({
    id: "classico-pranzo-riso-pollo-carote",
    style: "classico",
    mealType: "pranzo",
    family: "riso",
    dishName: "Riso con pollo e carote",
    ingredients: ["25 g riso", "30 g pollo cotto", "60 g carote cotte", "1 cucchiaino olio EVO a crudo"],
    preparation: "Cuoci il riso fino a renderlo molto morbido. Frulla pollo e carote per ottenere una crema vellutata, mescola al riso e servi con olio EVO.",
    carb: "riso",
    protein: "pollo",
    vegetable: "carote",
    proteinGroup: "carne",
  }),
  makeMainRecipe({
    id: "classico-pranzo-riso-lenticchie-zucca",
    style: "classico",
    mealType: "pranzo",
    family: "riso",
    dishName: "Riso con lenticchie e zucca",
    ingredients: ["25 g riso", "35 g lenticchie decorticate cotte", "60 g zucca cotta", "1 cucchiaino olio EVO a crudo"],
    preparation: "Cuoci riso, lenticchie e zucca fino a consistenza molto morbida. Frulla tutto parzialmente per ottenere un piatto cremoso, poi completa con olio EVO.",
    carb: "riso",
    protein: "lenticchie decorticate",
    vegetable: "zucca",
    proteinGroup: "legumi",
  }),
  makeMainRecipe({
    id: "classico-pranzo-quinoa-ceci-verdure",
    style: "classico",
    mealType: "pranzo",
    family: "quinoa",
    dishName: "Quinoa con verdure e ceci",
    ingredients: ["25 g quinoa", "35 g ceci decorticati cotti", "60 g carota e zucchine cotte", "1 cucchiaino olio EVO a crudo"],
    preparation: "Cuoci la quinoa finche morbida. Frulla ceci e verdure con poca acqua di cottura, unisci alla quinoa e servi con olio EVO a crudo.",
    carb: "quinoa",
    protein: "ceci decorticati",
    vegetable: "carota e zucchine",
    proteinGroup: "legumi",
  }),
  makeMainRecipe({
    id: "classico-pranzo-cous-cous-pesce-zucchine",
    style: "classico",
    mealType: "pranzo",
    family: "cous-cous",
    dishName: "Cous cous con pesce e zucchine",
    ingredients: ["25 g cous cous", "30 g nasello cotto", "60 g zucchine cotte", "1 cucchiaino olio EVO a crudo"],
    preparation: "Idrata il cous cous con poca acqua calda. Frulla nasello e zucchine fino a ottenere un composto morbido, uniscilo al cous cous e completa con olio EVO.",
    carb: "cous cous",
    protein: "nasello",
    vegetable: "zucchine",
    proteinGroup: "pesce",
  }),
  makeMainRecipe({
    id: "classico-pranzo-orzo-verdure-formaggio",
    style: "classico",
    mealType: "pranzo",
    family: "orzo",
    dishName: "Orzo con verdure e formaggio",
    ingredients: ["25 g orzo", "20 g ricotta fresca", "60 g carota e zucchine cotte", "1 cucchiaino olio EVO a crudo"],
    preparation: "Cuoci l'orzo finche molto morbido. Frulla le verdure con la ricotta, mescola all'orzo e servi con olio EVO.",
    carb: "orzo",
    protein: "ricotta fresca",
    vegetable: "carota e zucchine",
    proteinGroup: "latticino",
  }),
];

const classicoSnackRecipes: ChatRecipe[] = [
  makeSweetRecipe({ id: "classico-merenda-purea-mela", style: "classico", mealType: "merenda", family: "purea", dishName: "Purea di mela", ingredients: ["80 g mela cotta"], preparation: "Cuoci la mela finche morbida, poi frullala o schiacciala fino a ottenere una purea liscia.", fruit: "mela" }),
  makeSweetRecipe({ id: "classico-merenda-purea-pera", style: "classico", mealType: "merenda", family: "purea", dishName: "Purea di pera", ingredients: ["80 g pera cotta"], preparation: "Cuoci la pera finche morbida e riducila in purea liscia. Servi tiepida o a temperatura ambiente.", fruit: "pera" }),
  makeSweetRecipe({ id: "classico-merenda-purea-banana", style: "classico", mealType: "merenda", family: "purea", dishName: "Purea di banana", ingredients: ["70 g banana"], preparation: "Schiaccia bene la banana con una forchetta fino a ottenere una crema liscia e omogenea.", fruit: "banana" }),
  makeSweetRecipe({ id: "classico-merenda-purea-pesca", style: "classico", mealType: "merenda", family: "purea", dishName: "Purea di pesca", ingredients: ["80 g pesca matura"], preparation: "Sbuccia la pesca, cuocila leggermente se serve e frullala fino a ottenere una purea liscia.", fruit: "pesca" }),
  makeSweetRecipe({ id: "classico-merenda-purea-prugna", style: "classico", mealType: "merenda", family: "purea", dishName: "Purea di prugna", ingredients: ["80 g prugna cotta"], preparation: "Cuoci la prugna finche tenera, poi frullala fino a ottenere una purea morbida e uniforme.", fruit: "prugna" }),
  makeSweetRecipe({ id: "classico-merenda-frullato-banana-mela", style: "classico", mealType: "merenda", family: "frullato", dishName: "Frullato banana e mela", ingredients: ["40 g banana", "35 g mela cotta", "70 ml acqua o latte"], preparation: "Frulla banana e mela cotta con poca acqua o latte fino a ottenere un composto liscio e senza pezzi.", fruit: "banana mela" }),
  makeSweetRecipe({ id: "classico-merenda-smoothie-banana-lamponi", style: "classico", mealType: "merenda", family: "frullato", dishName: "Smoothie banana e lamponi", ingredients: ["40 g banana", "25 g lamponi", "60 ml yogurt o acqua"], preparation: "Frulla banana e lamponi con poco yogurt o acqua fino a ottenere uno smoothie liscio e morbido.", fruit: "banana lamponi" }),
  makeSweetRecipe({ id: "classico-merenda-yogurt-frutta", style: "classico", mealType: "merenda", family: "yogurt", dishName: "Yogurt con frutta", ingredients: ["80 g yogurt bianco intero", "40 g purea di frutta"], preparation: "Mescola lo yogurt con la purea di frutta fino a ottenere una consistenza uniforme e cremosa.", fruit: "frutta" }),
  makeSweetRecipe({ id: "classico-merenda-porridge-semplice", style: "classico", mealType: "merenda", family: "porridge", dishName: "Porridge semplice", ingredients: ["18 g fiocchi di avena", "110 ml acqua o latte", "35 g mela o banana"], preparation: "Cuoci i fiocchi di avena con il liquido scelto, poi completa con frutta schiacciata fino a ottenere una crema morbida.", fruit: "mela banana" }),
  makeSweetRecipe({ id: "classico-merenda-pancake-banana-avena", style: "classico", mealType: "merenda", family: "pancake", dishName: "Pancake banana e avena", ingredients: ["25 g farina di avena", "45 g banana schiacciata", "20 ml acqua"], preparation: "Mescola banana e farina di avena con poca acqua. Cuoci piccoli pancake in padella antiaderente finche morbidi.", fruit: "banana" }),
  makeSweetRecipe({ id: "classico-merenda-muffin-mela-cannella", style: "classico", mealType: "merenda", family: "muffin", dishName: "Muffin mela e cannella", ingredients: ["35 g farina di avena", "45 g mela grattugiata", "20 g yogurt bianco", "1 pizzico di cannella"], preparation: "Mescola tutti gli ingredienti fino a ottenere un impasto morbido. Versa in uno stampino e cuoci finche soffice.", fruit: "mela" }),
  makeSweetRecipe({ id: "classico-merenda-torta-mele", style: "classico", mealType: "merenda", family: "torta", dishName: "Torta di mele", ingredients: ["40 g farina", "50 g mela grattugiata", "25 g yogurt bianco", "1 cucchiaino olio EVO"], preparation: "Mescola farina, mela, yogurt e olio fino a ottenere un composto morbido. Cuoci in piccolo stampo finche la torta resta soffice.", fruit: "mela" }),
  makeSweetRecipe({ id: "classico-merenda-plumcake-banana", style: "classico", mealType: "merenda", family: "plumcake", dishName: "Plumcake alla banana", ingredients: ["40 g farina di avena", "50 g banana schiacciata", "20 g yogurt bianco"], preparation: "Amalgama gli ingredienti fino a ottenere un composto morbido. Versa in stampo piccolo e cuoci finche il plumcake risulta soffice.", fruit: "banana" }),
];

const classicoDinnerRecipes: ChatRecipe[] = [
  makeMainRecipe({ id: "classico-cena-crema-patate-carote", style: "classico", mealType: "cena", family: "crema", dishName: "Crema di patate e carote", ingredients: ["80 g patate", "60 g carote", "20 g ricotta fresca", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci patate e carote finche molto morbide, poi frullale con la ricotta fino a ottenere una crema liscia. Completa con olio EVO.", carb: "patate", protein: "ricotta fresca", vegetable: "carote", proteinGroup: "latticino" }),
  makeMainRecipe({ id: "classico-cena-crema-zucca-lenticchie", style: "classico", mealType: "cena", family: "crema", dishName: "Crema di zucca e lenticchie", ingredients: ["60 g zucca", "35 g lenticchie decorticate cotte", "25 g semolino", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci zucca, lenticchie e semolino fino a ottenere una consistenza molto morbida. Frulla tutto e servi con olio EVO.", carb: "semolino", protein: "lenticchie decorticate", vegetable: "zucca", proteinGroup: "legumi" }),
  makeMainRecipe({ id: "classico-cena-crema-carote-formaggio", style: "classico", mealType: "cena", family: "crema", dishName: "Crema di carote e formaggio", ingredients: ["60 g carote", "20 g robiola", "25 g miglio", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci carote e miglio finche morbidi, poi frullali con la robiola fino a ottenere una crema delicata. Aggiungi olio EVO a crudo.", carb: "miglio", protein: "robiola", vegetable: "carote", proteinGroup: "latticino" }),
  makeMainRecipe({ id: "classico-cena-crema-zucchine-ricotta", style: "classico", mealType: "cena", family: "crema", dishName: "Crema di zucchine e ricotta", ingredients: ["60 g zucchine", "25 g ricotta fresca", "25 g riso", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci zucchine e riso fino a renderli morbidi. Frulla con la ricotta fino a ottenere una crema liscia e servi con olio EVO.", carb: "riso", protein: "ricotta fresca", vegetable: "zucchine", proteinGroup: "latticino" }),
  makeMainRecipe({ id: "classico-cena-crema-cavolfiore-pollo", style: "classico", mealType: "cena", family: "crema", dishName: "Crema di cavolfiore e pollo", ingredients: ["60 g cavolfiore", "30 g pollo cotto", "25 g patata", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci cavolfiore e patata finche morbidi. Unisci il pollo cotto e frulla tutto fino a ottenere una crema liscia, poi completa con olio EVO.", carb: "patata", protein: "pollo", vegetable: "cavolfiore", proteinGroup: "carne" }),
  makeMainRecipe({ id: "classico-cena-crema-broccoli-formaggio", style: "classico", mealType: "cena", family: "crema", dishName: "Crema di broccoli e formaggio", ingredients: ["60 g broccoli", "20 g stracchino", "25 g semolino", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci broccoli e semolino finche diventano molto morbidi. Frulla con lo stracchino per ottenere una crema liscia e completa con olio EVO.", carb: "semolino", protein: "stracchino", vegetable: "broccoli", proteinGroup: "latticino" }),
  makeMainRecipe({ id: "classico-cena-vellutata-zucchine-pollo", style: "classico", mealType: "cena", family: "vellutata", dishName: "Vellutata di zucchine e pollo", ingredients: ["60 g zucchine", "30 g pollo cotto", "25 g patata", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci zucchine e patata finche morbide. Unisci il pollo cotto e frulla tutto fino a ottenere una vellutata liscia, poi servi con olio EVO.", carb: "patata", protein: "pollo", vegetable: "zucchine", proteinGroup: "carne" }),
  makeMainRecipe({ id: "classico-cena-vellutata-piselli-patate", style: "classico", mealType: "cena", family: "vellutata", dishName: "Vellutata di piselli e patate", ingredients: ["50 g piselli cotti", "70 g patate", "20 g ricotta fresca", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci piselli e patate finche molto morbidi. Frulla con la ricotta fino a ottenere una vellutata liscia e completa con olio EVO.", carb: "patate", protein: "ricotta fresca", vegetable: "piselli", proteinGroup: "latticino" }),
  makeMainRecipe({ id: "classico-cena-vellutata-patate-pesce", style: "classico", mealType: "cena", family: "vellutata", dishName: "Vellutata di patate e pesce", ingredients: ["80 g patate", "30 g merluzzo cotto", "50 g carote", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci patate e carote finche molto morbide. Unisci il merluzzo cotto e frulla tutto fino a ottenere una vellutata liscia, poi aggiungi olio EVO.", carb: "patate", protein: "merluzzo", vegetable: "carote", proteinGroup: "pesce" }),
  makeMainRecipe({ id: "classico-cena-passato-semolino", style: "classico", mealType: "cena", family: "passato", dishName: "Passato di verdure con semolino", ingredients: ["70 g verdure miste", "20 g semolino", "25 g ricotta fresca", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci le verdure finche morbide e frullale. Aggiungi il semolino e la ricotta, cuoci ancora pochi minuti fino a ottenere un passato morbido e uniforme.", carb: "semolino", protein: "ricotta fresca", vegetable: "verdure miste", proteinGroup: "latticino" }),
  makeMainRecipe({ id: "classico-cena-passato-lenticchie", style: "classico", mealType: "cena", family: "passato", dishName: "Passato di verdure e lenticchie", ingredients: ["70 g verdure miste", "35 g lenticchie decorticate cotte", "25 g riso", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci verdure, lenticchie e riso finche molto morbidi. Frulla tutto fino a ottenere un passato liscio e servi con olio EVO.", carb: "riso", protein: "lenticchie decorticate", vegetable: "verdure miste", proteinGroup: "legumi" }),
];

const autoBreakfastRecipes: ChatRecipe[] = [
  makeSweetRecipe({ id: "auto-colazione-pancake-banana-uova", style: "autosvezzamento", mealType: "colazione", family: "pancake", dishName: "Pancake banana e uova", ingredients: ["1 uovo piccolo", "45 g banana schiacciata", "20 g farina di avena"], preparation: "Mescola banana, uovo e farina di avena fino a ottenere una pastella. Cuoci piccoli pancake in padella antiaderente e servi in pezzi morbidi.", fruit: "banana" }),
  makeSweetRecipe({ id: "auto-colazione-pancake-mela-avena", style: "autosvezzamento", mealType: "colazione", family: "pancake", dishName: "Pancake mela e avena", ingredients: ["25 g farina di avena", "45 g mela grattugiata", "20 g yogurt bianco"], preparation: "Mescola mela, farina di avena e yogurt. Cuoci piccoli pancake finche risultano morbidi e facili da afferrare.", fruit: "mela" }),
  makeSweetRecipe({ id: "auto-colazione-pancake-pera-avena", style: "autosvezzamento", mealType: "colazione", family: "pancake", dishName: "Pancake pera e avena", ingredients: ["25 g farina di avena", "45 g pera grattugiata", "20 g yogurt bianco"], preparation: "Mescola pera, farina di avena e yogurt fino a ottenere una pastella. Cuoci piccoli pancake in padella e servi morbidi.", fruit: "pera" }),
  makeSweetRecipe({ id: "auto-colazione-pancake-yogurt-avena", style: "autosvezzamento", mealType: "colazione", family: "pancake", dishName: "Pancake yogurt e avena", ingredients: ["25 g farina di avena", "30 g yogurt bianco", "35 g banana schiacciata"], preparation: "Amalgama farina, yogurt e banana. Cuoci piccoli pancake soffici e servili tiepidi in pezzi adeguati.", fruit: "banana" }),
  makeSweetRecipe({ id: "auto-colazione-muffin-banana-avena", style: "autosvezzamento", mealType: "colazione", family: "muffin", dishName: "Muffin banana e avena", ingredients: ["35 g farina di avena", "50 g banana schiacciata", "20 g yogurt bianco"], preparation: "Mescola gli ingredienti fino a ottenere un impasto morbido. Versa in uno stampino e cuoci finche il muffin resta soffice.", fruit: "banana" }),
  makeSweetRecipe({ id: "auto-colazione-muffin-banana-mela", style: "autosvezzamento", mealType: "colazione", family: "muffin", dishName: "Muffin banana e mela", ingredients: ["35 g farina di avena", "30 g banana schiacciata", "35 g mela grattugiata"], preparation: "Unisci banana, mela e farina di avena. Cuoci in stampino da muffin finche soffice, poi servi in pezzi morbidi.", fruit: "banana mela" }),
  makeSweetRecipe({ id: "auto-colazione-waffle-yogurt-banana", style: "autosvezzamento", mealType: "colazione", family: "waffle", dishName: "Waffle yogurt e banana", ingredients: ["35 g farina", "30 g yogurt bianco", "40 g banana schiacciata"], preparation: "Prepara una pastella morbida con yogurt, banana e farina. Cuoci nello stampo per waffle o in padella e servi a pezzi morbidi.", fruit: "banana" }),
  makeSweetRecipe({ id: "auto-colazione-crepes-yogurt-frutta", style: "autosvezzamento", mealType: "colazione", family: "crepes", dishName: "Crepes yogurt e frutta", ingredients: ["30 g farina", "30 g yogurt bianco", "40 g purea di mela o pera"], preparation: "Prepara una pastella liscia e cuoci una crepes sottile. Farcisci con purea di frutta e servi in strisce morbide.", fruit: "mela pera" }),
  makeSweetRecipe({ id: "auto-colazione-toast-avocado-uovo", style: "autosvezzamento", mealType: "colazione", family: "toast", dishName: "Toast avocado e uovo", ingredients: ["1 fetta pane morbido", "30 g avocado schiacciato", "1 uovo piccolo"], preparation: "Tosta leggermente il pane finche resta morbido. Spalma l'avocado e aggiungi l'uovo strapazzato morbido, poi servi in pezzi sicuri.", fruit: undefined }),
  makeSweetRecipe({ id: "auto-colazione-porridge-banana-cannella", style: "autosvezzamento", mealType: "colazione", family: "porridge", dishName: "Porridge banana e cannella", ingredients: ["20 g fiocchi di avena", "120 ml acqua o latte", "40 g banana schiacciata", "1 pizzico di cannella"], preparation: "Cuoci l'avena fino a ottenere un porridge cremoso. Aggiungi banana schiacciata e cannella, poi servi in consistenza morbida.", fruit: "banana" }),
  makeSweetRecipe({ id: "auto-colazione-tortina-carote", style: "autosvezzamento", mealType: "colazione", family: "torta", dishName: "Tortina morbida alle carote", ingredients: ["35 g farina", "50 g carote grattugiate finemente", "25 g yogurt bianco", "1 cucchiaino olio EVO"], preparation: "Mescola farina, carote, yogurt e olio fino a ottenere un composto morbido. Versa in uno stampino piccolo e cuoci finche la tortina resta soffice.", fruit: "carota" }),
  makeSweetRecipe({ id: "auto-colazione-banana-bread", style: "autosvezzamento", mealType: "colazione", family: "banana-bread", dishName: "Banana bread morbido", ingredients: ["40 g banana schiacciata", "35 g farina di avena", "20 g yogurt bianco"], preparation: "Mescola banana, farina di avena e yogurt fino a ottenere un impasto morbido. Versa in piccolo stampo e cuoci finche il plumcake resta soffice.", fruit: "banana" }),
  makeSweetRecipe({ id: "auto-colazione-budino-pera", style: "autosvezzamento", mealType: "colazione", family: "budino", dishName: "Budino di pera", ingredients: ["15 g crema di riso", "100 ml acqua o latte", "45 g purea di pera"], preparation: "Cuoci la crema di riso nel liquido scelto fino a farla addensare. Unisci la purea di pera e servi in consistenza tipo budino.", fruit: "pera" }),
];

const autoLunchRecipes: ChatRecipe[] = [
  makeMainRecipe({ id: "auto-pranzo-pasta-pomodoro-ricotta", style: "autosvezzamento", mealType: "pranzo", family: "pasta", dishName: "Pasta con pomodoro e ricotta", ingredients: ["25 g pasta corta", "25 g ricotta fresca", "40 g passata di pomodoro", "40 g carota cotta", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci la pasta molto bene. Prepara un sugo delicato con pomodoro e carota, unisci la ricotta e condisci la pasta con olio EVO.", carb: "pasta corta", protein: "ricotta fresca", vegetable: "carota", proteinGroup: "latticino" }),
  makeMainRecipe({ id: "auto-pranzo-pasta-zucchine-pollo", style: "autosvezzamento", mealType: "pranzo", family: "pasta", dishName: "Pasta con zucchine e pollo", ingredients: ["25 g pasta corta", "30 g pollo cotto", "60 g zucchine cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci la pasta. Taglia o sfilaccia il pollo in consistenza morbida, uniscilo alle zucchine ben cotte e usa il condimento per la pasta completando con olio EVO.", carb: "pasta corta", protein: "pollo", vegetable: "zucchine", proteinGroup: "carne" }),
  makeMainRecipe({ id: "auto-pranzo-pasta-lenticchie-carote", style: "autosvezzamento", mealType: "pranzo", family: "pasta", dishName: "Pasta con lenticchie e carote", ingredients: ["25 g pasta corta", "35 g lenticchie decorticate cotte", "50 g carote cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci la pasta molto bene. Prepara un condimento morbido con lenticchie e carote schiacciate, condisci la pasta e servi con olio EVO.", carb: "pasta corta", protein: "lenticchie decorticate", vegetable: "carote", proteinGroup: "legumi" }),
  makeMainRecipe({ id: "auto-pranzo-pasta-zucchine-ricotta", style: "autosvezzamento", mealType: "pranzo", family: "pasta", dishName: "Pasta con zucchine e ricotta", ingredients: ["25 g pasta corta", "25 g ricotta fresca", "60 g zucchine cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci la pasta molto bene. Schiaccia le zucchine con la ricotta per ottenere un condimento morbido e usa il composto per condire la pasta.", carb: "pasta corta", protein: "ricotta fresca", vegetable: "zucchine", proteinGroup: "latticino" }),
  makeMainRecipe({ id: "auto-pranzo-pasta-salmone-ricotta", style: "autosvezzamento", mealType: "pranzo", family: "pasta", dishName: "Pasta con salmone e ricotta", ingredients: ["25 g pasta corta", "30 g salmone cotto", "20 g ricotta fresca", "50 g zucchine cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci la pasta. Mescola salmone ben morbido, ricotta e zucchine cotte fino a ottenere un condimento umido, poi servi con olio EVO.", carb: "pasta corta", protein: "salmone", vegetable: "zucchine", proteinGroup: "pesce" }),
  makeMainRecipe({ id: "auto-pranzo-pasta-manzo-carote", style: "autosvezzamento", mealType: "pranzo", family: "pasta", dishName: "Pasta con manzo e carote", ingredients: ["25 g pasta corta", "30 g manzo cotto", "50 g carote cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci la pasta molto bene. Prepara un ragu morbido di manzo e carote, condisci la pasta e completa con olio EVO.", carb: "pasta corta", protein: "manzo", vegetable: "carote", proteinGroup: "carne" }),
  makeMainRecipe({ id: "auto-pranzo-pasta-ceci-zucchine", style: "autosvezzamento", mealType: "pranzo", family: "pasta", dishName: "Pasta con ceci e zucchine", ingredients: ["25 g pasta corta", "35 g ceci decorticati cotti", "60 g zucchine cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci la pasta. Schiaccia ceci e zucchine fino a ottenere un condimento morbido, usa il composto per condire la pasta e servi con olio EVO.", carb: "pasta corta", protein: "ceci decorticati", vegetable: "zucchine", proteinGroup: "legumi" }),
  makeMainRecipe({ id: "auto-pranzo-riso-pesce-verdure", style: "autosvezzamento", mealType: "pranzo", family: "riso", dishName: "Riso con pesce e verdure", ingredients: ["25 g riso", "30 g merluzzo cotto", "60 g verdure miste cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci il riso finche morbido. Unisci pesce e verdure ben cotte in consistenza morbida, mescola tutto e completa con olio EVO.", carb: "riso", protein: "merluzzo", vegetable: "verdure miste", proteinGroup: "pesce" }),
  makeMainRecipe({ id: "auto-pranzo-riso-tacchino-piselli", style: "autosvezzamento", mealType: "pranzo", family: "riso", dishName: "Riso con tacchino e piselli", ingredients: ["25 g riso", "30 g tacchino cotto", "50 g piselli ben cotti", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci il riso finche morbido. Unisci tacchino sfilacciato e piselli ben cotti, amalgama e servi con olio EVO a crudo.", carb: "riso", protein: "tacchino", vegetable: "piselli", proteinGroup: "carne" }),
  makeMainRecipe({ id: "auto-pranzo-riso-uovo-zucchine", style: "autosvezzamento", mealType: "pranzo", family: "riso", dishName: "Riso con uovo e zucchine", ingredients: ["25 g riso", "1 uovo piccolo", "60 g zucchine cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci il riso finche morbido. Prepara un uovo strapazzato soffice con zucchine ben cotte, uniscilo al riso e completa con olio EVO.", carb: "riso", protein: "uovo", vegetable: "zucchine", proteinGroup: "uovo" }),
  makeMainRecipe({ id: "auto-pranzo-quinoa-pollo-zucchine", style: "autosvezzamento", mealType: "pranzo", family: "quinoa", dishName: "Quinoa con pollo e zucchine", ingredients: ["25 g quinoa", "30 g pollo cotto", "60 g zucchine cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci la quinoa finche tenera. Mescola con pollo sfilacciato e zucchine morbide, poi servi con olio EVO a crudo.", carb: "quinoa", protein: "pollo", vegetable: "zucchine", proteinGroup: "carne" }),
  makeMainRecipe({ id: "auto-pranzo-cous-cous-ceci-verdure", style: "autosvezzamento", mealType: "pranzo", family: "cous-cous", dishName: "Cous cous con ceci e verdure", ingredients: ["25 g cous cous", "35 g ceci decorticati cotti", "60 g verdure miste cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Idrata il cous cous con poca acqua calda. Unisci ceci e verdure morbide, mescola bene e completa con olio EVO a crudo.", carb: "cous cous", protein: "ceci decorticati", vegetable: "verdure miste", proteinGroup: "legumi" }),
  makeMainRecipe({ id: "auto-pranzo-orzo-ricotta-zucchine", style: "autosvezzamento", mealType: "pranzo", family: "orzo", dishName: "Orzo con ricotta e zucchine", ingredients: ["25 g orzo ben cotto", "25 g ricotta fresca", "60 g zucchine cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci l'orzo finche molto morbido. Schiaccia le zucchine con la ricotta fino a ottenere un condimento umido, uniscilo all'orzo e servi con olio EVO.", carb: "orzo", protein: "ricotta fresca", vegetable: "zucchine", proteinGroup: "latticino" }),
  makeMainRecipe({ id: "auto-pranzo-orzo-pollo-carote", style: "autosvezzamento", mealType: "pranzo", family: "orzo", dishName: "Orzo con pollo e carote", ingredients: ["25 g orzo ben cotto", "30 g pollo cotto", "50 g carote cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci l'orzo finche molto morbido. Unisci pollo sfilacciato e carote ben cotte in consistenza morbida, mescola e servi con olio EVO a crudo.", carb: "orzo", protein: "pollo", vegetable: "carote", proteinGroup: "carne" }),
];

const autoSnackRecipes: ChatRecipe[] = [
  makeSweetRecipe({ id: "auto-merenda-muffin-mela-cannella", style: "autosvezzamento", mealType: "merenda", family: "muffin", dishName: "Muffin mela e cannella", ingredients: ["35 g farina di avena", "45 g mela grattugiata", "20 g yogurt bianco", "1 pizzico di cannella"], preparation: "Mescola tutti gli ingredienti fino a ottenere un impasto morbido. Versa in uno stampino e cuoci finche soffice.", fruit: "mela" }),
  makeSweetRecipe({ id: "auto-merenda-pancake-yogurt-frutta", style: "autosvezzamento", mealType: "merenda", family: "pancake", dishName: "Pancake yogurt e frutta", ingredients: ["25 g farina di avena", "30 g yogurt bianco", "40 g frutta schiacciata"], preparation: "Mescola yogurt, frutta e farina di avena. Cuoci piccoli pancake morbidi e servi nei tagli sicuri adeguati.", fruit: "frutta" }),
  makeSweetRecipe({ id: "auto-merenda-smoothie-frutta-mista", style: "autosvezzamento", mealType: "merenda", family: "frullato", dishName: "Smoothie frutta mista", ingredients: ["35 g banana", "30 g mela cotta", "25 g pesca", "70 ml acqua o yogurt"], preparation: "Frulla la frutta con poca acqua o yogurt fino a ottenere uno smoothie liscio e cremoso.", fruit: "frutta mista" }),
  makeSweetRecipe({ id: "auto-merenda-smoothie-banana-fragole", style: "autosvezzamento", mealType: "merenda", family: "frullato", dishName: "Smoothie banana e fragole", ingredients: ["40 g banana", "30 g fragole", "60 ml yogurt o acqua"], preparation: "Frulla banana e fragole con poco yogurt o acqua fino a ottenere uno smoothie liscio.", fruit: "banana fragole" }),
  makeSweetRecipe({ id: "auto-merenda-yogurt-frutta-avena", style: "autosvezzamento", mealType: "merenda", family: "yogurt", dishName: "Yogurt con frutta e avena", ingredients: ["80 g yogurt bianco intero", "35 g purea di frutta", "10 g fiocchi di avena ammorbiditi"], preparation: "Mescola yogurt, purea di frutta e fiocchi di avena gia ammorbiditi finche la consistenza resta morbida.", fruit: "frutta" }),
  makeSweetRecipe({ id: "auto-merenda-biscotti-avena-banana", style: "autosvezzamento", mealType: "merenda", family: "biscotti", dishName: "Biscotti avena e banana", ingredients: ["35 g farina di avena", "45 g banana schiacciata"], preparation: "Mescola banana e avena, forma piccoli biscotti morbidi e cuoci finche restano soffici al centro.", fruit: "banana" }),
  makeSweetRecipe({ id: "auto-merenda-ciambelline-yogurt", style: "autosvezzamento", mealType: "merenda", family: "ciambelline", dishName: "Ciambelline allo yogurt", ingredients: ["35 g farina", "25 g yogurt bianco", "35 g mela grattugiata"], preparation: "Mescola gli ingredienti, forma piccole ciambelline morbide e cuoci finche soffici.", fruit: "mela" }),
  makeSweetRecipe({ id: "auto-merenda-barrette-avena-mela", style: "autosvezzamento", mealType: "merenda", family: "barrette", dishName: "Barrette avena e mela", ingredients: ["35 g fiocchi di avena", "45 g mela grattugiata", "20 g banana schiacciata"], preparation: "Mescola avena, mela e banana fino a ottenere un composto morbido. Compatta in stampo piccolo, cuoci e servi in bastoncini morbidi.", fruit: "mela banana" }),
  makeSweetRecipe({ id: "auto-merenda-budino-mela", style: "autosvezzamento", mealType: "merenda", family: "budino", dishName: "Budino di mela", ingredients: ["15 g crema di riso", "100 ml acqua o latte", "45 g purea di mela"], preparation: "Cuoci la crema di riso nel liquido scelto fino a renderla morbida. Unisci la purea di mela e lascia addensare leggermente prima di servire.", fruit: "mela" }),
  makeSweetRecipe({ id: "auto-merenda-banana-bread", style: "autosvezzamento", mealType: "merenda", family: "banana-bread", dishName: "Banana bread morbido", ingredients: ["40 g banana schiacciata", "35 g farina di avena", "20 g yogurt bianco"], preparation: "Mescola banana, farina di avena e yogurt fino a ottenere un impasto morbido. Cuoci in piccolo stampo e servi in pezzi soffici.", fruit: "banana" }),
  makeSweetRecipe({ id: "auto-merenda-torta-mele", style: "autosvezzamento", mealType: "merenda", family: "torta", dishName: "Torta di mele morbida", ingredients: ["40 g farina", "50 g mela grattugiata", "25 g yogurt bianco", "1 cucchiaino olio EVO"], preparation: "Amalgama farina, mela, yogurt e olio fino a ottenere un composto morbido. Cuoci in piccolo stampo finche la torta resta soffice.", fruit: "mela" }),
];

const autoDinnerRecipes: ChatRecipe[] = [
  makeMainRecipe({ id: "auto-cena-polpette-lenticchie", style: "autosvezzamento", mealType: "cena", family: "polpette", dishName: "Polpette di lenticchie", ingredients: ["40 g lenticchie decorticate cotte", "25 g patata", "60 g carote cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Schiaccia lenticchie, patata e carote fino a ottenere un composto morbido. Forma polpette soffici, cuocile e servi con olio EVO a crudo.", carb: "patata", protein: "lenticchie decorticate", vegetable: "carote", proteinGroup: "legumi" }),
  makeMainRecipe({ id: "auto-cena-burger-ceci", style: "autosvezzamento", mealType: "cena", family: "burger", dishName: "Burger di ceci", ingredients: ["40 g ceci decorticati cotti", "25 g patata", "60 g zucchine cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Schiaccia ceci, patata e zucchine fino a ottenere un impasto morbido. Forma un burger soffice, cuoci e servi con verdure morbide e olio EVO.", carb: "patata", protein: "ceci decorticati", vegetable: "zucchine", proteinGroup: "legumi" }),
  makeMainRecipe({ id: "auto-cena-burger-ceci-zucchine", style: "autosvezzamento", mealType: "cena", family: "burger", dishName: "Burger di ceci e zucchine", ingredients: ["40 g ceci decorticati cotti", "20 g pane morbido", "70 g zucchine cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Unisci ceci, pane morbido e zucchine ben cotte fino a ottenere un impasto soffice. Forma il burger, cuocilo e servi con verdure morbide e olio EVO.", carb: "pane morbido", protein: "ceci decorticati", vegetable: "zucchine", proteinGroup: "legumi" }),
  makeMainRecipe({ id: "auto-cena-burger-lenticchie-carote", style: "autosvezzamento", mealType: "cena", family: "burger", dishName: "Burger di lenticchie e carote", ingredients: ["40 g lenticchie decorticate cotte", "20 g pane morbido", "60 g carote cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Mescola lenticchie, pane morbido e carote cotte fino a ottenere un composto soffice. Forma il burger, cuoci e servi con un filo di olio EVO.", carb: "pane morbido", protein: "lenticchie decorticate", vegetable: "carote", proteinGroup: "legumi" }),
  makeMainRecipe({ id: "auto-cena-polpette-pollo-zucchine", style: "autosvezzamento", mealType: "cena", family: "polpette", dishName: "Polpette di pollo e zucchine", ingredients: ["40 g pollo cotto", "20 g patata", "60 g zucchine cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Trita pollo e mescolalo con patata e zucchine morbide. Forma polpette soffici, cuocile e servi con altra verdura e olio EVO.", carb: "patata", protein: "pollo", vegetable: "zucchine", proteinGroup: "carne" }),
  makeMainRecipe({ id: "auto-cena-polpette-pesce-patate", style: "autosvezzamento", mealType: "cena", family: "polpette", dishName: "Polpette di pesce e patate", ingredients: ["35 g merluzzo cotto", "60 g patate", "50 g carote cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Schiaccia pesce, patate e carote fino a ottenere un composto morbido. Forma polpette soffici, cuocile e servi con olio EVO.", carb: "patate", protein: "merluzzo", vegetable: "carote", proteinGroup: "pesce" }),
  makeMainRecipe({ id: "auto-cena-polpette-ricotta-spinaci", style: "autosvezzamento", mealType: "cena", family: "polpette", dishName: "Polpette di ricotta e spinaci", ingredients: ["30 g ricotta fresca", "20 g patata", "60 g spinaci cotti", "1 cucchiaino olio EVO a crudo"], preparation: "Mescola ricotta, patata e spinaci ben cotti fino a ottenere un composto soffice. Forma polpette morbide, cuoci e servi con olio EVO.", carb: "patata", protein: "ricotta fresca", vegetable: "spinaci", proteinGroup: "latticino" }),
  makeMainRecipe({ id: "auto-cena-polpette-tacchino-carote", style: "autosvezzamento", mealType: "cena", family: "polpette", dishName: "Polpette di tacchino e carote", ingredients: ["40 g tacchino cotto", "20 g cous cous", "60 g carote cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Mescola tacchino tritato, cous cous gia idratato e carote morbide. Forma polpette soffici, cuocile e servi con olio EVO.", carb: "cous cous", protein: "tacchino", vegetable: "carote", proteinGroup: "carne" }),
  makeMainRecipe({ id: "auto-cena-polpette-quinoa-verdure", style: "autosvezzamento", mealType: "cena", family: "polpette", dishName: "Polpette di quinoa e verdure", ingredients: ["30 g quinoa cotta", "30 g ceci decorticati cotti", "60 g verdure miste cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Mescola quinoa, ceci e verdure ben cotte fino a ottenere un composto morbido. Forma polpette soffici, cuocile e servi con olio EVO.", carb: "quinoa", protein: "ceci decorticati", vegetable: "verdure miste", proteinGroup: "legumi" }),
  makeMainRecipe({ id: "auto-cena-frittata-zucchine", style: "autosvezzamento", mealType: "cena", family: "frittata", dishName: "Frittata di zucchine", ingredients: ["1 uovo piccolo", "25 g patata", "60 g zucchine cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Sbatti l'uovo e uniscilo a zucchine ben cotte. Cuoci una frittata morbida, servi con patata morbida e olio EVO a crudo.", carb: "patata", protein: "uovo", vegetable: "zucchine", proteinGroup: "uovo" }),
  makeMainRecipe({ id: "auto-cena-frittata-patate", style: "autosvezzamento", mealType: "cena", family: "frittata", dishName: "Frittata con patate", ingredients: ["1 uovo piccolo", "60 g patate cotte", "50 g carote cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Sbatti l'uovo e uniscilo a patate gia cotte e schiacciate. Cuoci una frittata morbida, accompagna con carote morbide e completa con olio EVO.", carb: "patate", protein: "uovo", vegetable: "carote", proteinGroup: "uovo" }),
  makeMainRecipe({ id: "auto-cena-frittata-ricotta-spinaci", style: "autosvezzamento", mealType: "cena", family: "frittata", dishName: "Frittata ricotta e spinaci", ingredients: ["1 uovo piccolo", "20 g ricotta fresca", "50 g spinaci cotti", "25 g pane morbido", "1 cucchiaino olio EVO a crudo"], preparation: "Sbatti l'uovo con la ricotta, aggiungi gli spinaci ben cotti e cuoci una frittata soffice. Servi con pane morbido e olio EVO a crudo.", carb: "pane morbido", protein: "uovo e ricotta fresca", vegetable: "spinaci", proteinGroup: "uovo" }),
  makeMainRecipe({ id: "auto-cena-vellutata-ceci-zucca", style: "autosvezzamento", mealType: "cena", family: "vellutata", dishName: "Vellutata completa di ceci e zucca", ingredients: ["35 g ceci decorticati cotti", "70 g zucca cotta", "50 g patate", "1 cucchiaino olio EVO a crudo"], preparation: "Cuoci zucca e patate finche molto morbide. Unisci i ceci gia cotti, frulla fino a ottenere una vellutata densa e servi con olio EVO a crudo.", carb: "patate", protein: "ceci decorticati", vegetable: "zucca", proteinGroup: "legumi" }),
  makeMainRecipe({ id: "auto-cena-cotoletta-pollo-patate", style: "autosvezzamento", mealType: "cena", family: "cotoletta", dishName: "Cotoletta morbida di pollo con patate e carote", ingredients: ["40 g pollo cotto", "20 g pane morbido sbriciolato", "60 g patate cotte", "50 g carote cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Trita il pollo e compattalo con poco pane morbido fino a ottenere una cotoletta soffice. Cuocila bene e servila con patate e carote morbide e olio EVO a crudo.", carb: "patate", protein: "pollo", vegetable: "carote", proteinGroup: "carne" }),
  makeMainRecipe({ id: "auto-cena-sformatino-ricotta-verdure", style: "autosvezzamento", mealType: "cena", family: "sformatino", dishName: "Sformatino di ricotta e verdure", ingredients: ["25 g ricotta fresca", "30 g quinoa cotta", "60 g zucchine e carote cotte", "1 cucchiaino olio EVO a crudo"], preparation: "Mescola ricotta, quinoa e verdure morbide fino a ottenere un composto soffice. Versa in uno stampino e cuoci finche lo sformatino resta morbido, poi completa con olio EVO.", carb: "quinoa", protein: "ricotta fresca", vegetable: "zucchine e carote", proteinGroup: "latticino" }),
];

export const chatRecipeCatalog = {
  classico: {
    colazione: classicoBreakfastRecipes,
    pranzo: classicoLunchRecipes,
    merenda: classicoSnackRecipes,
    cena: classicoDinnerRecipes,
  },
  autosvezzamento: {
    colazione: autoBreakfastRecipes,
    pranzo: autoLunchRecipes,
    merenda: autoSnackRecipes,
    cena: autoDinnerRecipes,
  },
} as const;
