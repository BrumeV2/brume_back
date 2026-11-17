import { Box } from '../../modules/products/entities/box.entity';
import { Ingredient } from '../../modules/products/entities/ingredient.entity';
import { ProductFormat } from '../../modules/products/entities/product-format.entity';
import { Product } from '../../modules/products/entities/product.entity';
import { CaffeineLevel } from '../../modules/products/enums/caffeine-level.enum';
import { ConsumptionMoment } from '../../modules/products/enums/consumption-moment.enum';
import { IngredientType } from '../../modules/products/enums/ingredient-type.enum';
import { Packaging } from '../../modules/products/enums/packaging.enum';
import dataSource from '../data-source';

// Jeu de données de dev : vide le catalogue puis le remplit (prix en centimes).
// Les produits sont générés en croisant des thés de base et des profils aromatiques,
// avec un aléatoire à graine fixe : le résultat est identique à chaque lancement.

interface TeaBase {
  label: string;
  ingredient: string;
  description: string;
  typeTea: string;
  origin: string;
  caffeine: CaffeineLevel;
  // prix de vente indicatif pour 100 g, en centimes
  pricePer100g: number;
}

interface FlavorProfile {
  label: string;
  phrase: string;
  ingredients: string[];
  moment: ConsumptionMoment;
  teaTypes: string[];
}

const bases: TeaBase[] = [
  {
    label: 'Assam',
    ingredient: 'Thé noir Assam',
    description: 'Thé noir indien corsé et malté',
    typeTea: 'noir',
    origin: 'Inde',
    caffeine: CaffeineLevel.HIGH,
    pricePer100g: 890,
  },
  {
    label: 'Darjeeling',
    ingredient: 'Thé noir Darjeeling',
    description: 'Thé noir des contreforts himalayens, notes de muscat',
    typeTea: 'noir',
    origin: 'Inde',
    caffeine: CaffeineLevel.HIGH,
    pricePer100g: 1390,
  },
  {
    label: 'Ceylan',
    ingredient: 'Thé noir Ceylan',
    description: 'Thé noir sri-lankais vif et lumineux',
    typeTea: 'noir',
    origin: 'Sri Lanka',
    caffeine: CaffeineLevel.HIGH,
    pricePer100g: 950,
  },
  {
    label: 'Yunnan',
    ingredient: 'Thé noir Yunnan',
    description: 'Thé noir chinois doux aux notes de cacao',
    typeTea: 'noir',
    origin: 'Chine',
    caffeine: CaffeineLevel.HIGH,
    pricePer100g: 1190,
  },
  {
    label: 'Lapsang Souchong',
    ingredient: 'Thé noir Lapsang Souchong',
    description: 'Thé noir fumé au bois de pin',
    typeTea: 'noir',
    origin: 'Chine',
    caffeine: CaffeineLevel.HIGH,
    pricePer100g: 1090,
  },
  {
    label: 'Sencha',
    ingredient: 'Thé vert Sencha',
    description: 'Thé vert japonais, notes herbacées et iodées',
    typeTea: 'vert',
    origin: 'Japon',
    caffeine: CaffeineLevel.MEDIUM,
    pricePer100g: 1090,
  },
  {
    label: 'Gunpowder',
    ingredient: 'Thé vert Gunpowder',
    description: 'Thé vert chinois roulé en perles',
    typeTea: 'vert',
    origin: 'Chine',
    caffeine: CaffeineLevel.MEDIUM,
    pricePer100g: 790,
  },
  {
    label: 'Chun Mee',
    ingredient: 'Thé vert Chun Mee',
    description: 'Thé vert chinois aux feuilles en sourcils',
    typeTea: 'vert',
    origin: 'Chine',
    caffeine: CaffeineLevel.MEDIUM,
    pricePer100g: 850,
  },
  {
    label: 'Bancha',
    ingredient: 'Thé vert Bancha',
    description: 'Thé vert japonais du quotidien, peu de théine',
    typeTea: 'vert',
    origin: 'Japon',
    caffeine: CaffeineLevel.LOW,
    pricePer100g: 890,
  },
  {
    label: 'Matcha',
    ingredient: 'Matcha',
    description: 'Thé vert japonais moulu en poudre fine',
    typeTea: 'vert',
    origin: 'Japon',
    caffeine: CaffeineLevel.HIGH,
    pricePer100g: 2490,
  },
  {
    label: 'Pai Mu Tan',
    ingredient: 'Thé blanc Pai Mu Tan',
    description: 'Thé blanc chinois doux et floral',
    typeTea: 'blanc',
    origin: 'Chine',
    caffeine: CaffeineLevel.LOW,
    pricePer100g: 1490,
  },
  {
    label: 'Silver Needle',
    ingredient: 'Thé blanc Silver Needle',
    description: 'Bourgeons de thé blanc, très délicats',
    typeTea: 'blanc',
    origin: 'Chine',
    caffeine: CaffeineLevel.LOW,
    pricePer100g: 2590,
  },
  {
    label: 'Tie Guan Yin',
    ingredient: 'Oolong Tie Guan Yin',
    description: 'Oolong peu oxydé, notes de fleurs',
    typeTea: 'oolong',
    origin: 'Chine',
    caffeine: CaffeineLevel.MEDIUM,
    pricePer100g: 1590,
  },
  {
    label: 'Milky Oolong',
    ingredient: 'Oolong Milky',
    description: 'Oolong taïwanais aux notes lactées',
    typeTea: 'oolong',
    origin: 'Taïwan',
    caffeine: CaffeineLevel.MEDIUM,
    pricePer100g: 1690,
  },
  {
    label: 'Pu-erh',
    ingredient: 'Pu-erh',
    description: 'Thé sombre fermenté, notes de sous-bois',
    typeTea: 'pu-erh',
    origin: 'Chine',
    caffeine: CaffeineLevel.HIGH,
    pricePer100g: 1290,
  },
  {
    label: 'Rooibos',
    ingredient: 'Rooibos',
    description: "Plante d'Afrique du Sud, sans théine",
    typeTea: 'rooibos',
    origin: 'Afrique du Sud',
    caffeine: CaffeineLevel.NONE,
    pricePer100g: 750,
  },
  {
    label: 'Rooibos Vert',
    ingredient: 'Rooibos vert',
    description: 'Rooibos non fermenté, plus végétal',
    typeTea: 'rooibos',
    origin: 'Afrique du Sud',
    caffeine: CaffeineLevel.NONE,
    pricePer100g: 850,
  },
  {
    label: 'Honeybush',
    ingredient: 'Honeybush',
    description: 'Cousin du rooibos aux notes de miel',
    typeTea: 'rooibos',
    origin: 'Afrique du Sud',
    caffeine: CaffeineLevel.NONE,
    pricePer100g: 890,
  },
  {
    label: 'Maté',
    ingredient: 'Maté vert',
    description: "Feuilles de yerba maté d'Amérique du Sud",
    typeTea: 'maté',
    origin: 'Argentine',
    caffeine: CaffeineLevel.HIGH,
    pricePer100g: 690,
  },
  {
    label: 'Verveine',
    ingredient: 'Verveine',
    description: 'Feuilles de verveine odorante',
    typeTea: 'infusion',
    origin: 'France',
    caffeine: CaffeineLevel.NONE,
    pricePer100g: 790,
  },
  {
    label: 'Camomille',
    ingredient: 'Camomille',
    description: 'Fleurs de camomille matricaire',
    typeTea: 'infusion',
    origin: 'Égypte',
    caffeine: CaffeineLevel.NONE,
    pricePer100g: 750,
  },
];

const flavorProfiles: FlavorProfile[] = [
  {
    label: 'Bergamote',
    phrase: 'à la bergamote',
    ingredients: ['Huile essentielle de bergamote'],
    moment: ConsumptionMoment.MORNING,
    teaTypes: ['noir', 'vert', 'blanc', 'rooibos'],
  },
  {
    label: 'Agrumes',
    phrase: "aux zestes d'agrumes",
    ingredients: [
      'Écorces d’orange',
      'Zestes de citron',
      'Huile essentielle de citron',
    ],
    moment: ConsumptionMoment.MORNING,
    teaTypes: ['noir', 'vert', 'blanc', 'rooibos', 'maté'],
  },
  {
    label: 'Fruits Rouges',
    phrase: 'aux fruits rouges',
    ingredients: ['Morceaux de fraise', 'Framboises', 'Arôme fruits rouges'],
    moment: ConsumptionMoment.SNACK,
    teaTypes: ['noir', 'vert', 'blanc', 'rooibos', 'infusion'],
  },
  {
    label: 'Chaï',
    phrase: 'aux épices chaï',
    ingredients: [
      'Cannelle',
      'Gingembre',
      'Cardamome',
      'Clou de girofle',
      'Poivre noir',
    ],
    moment: ConsumptionMoment.MORNING,
    teaTypes: ['noir', 'rooibos', 'maté', 'pu-erh'],
  },
  {
    label: 'Vanille',
    phrase: 'à la vanille',
    ingredients: ['Arôme vanille'],
    moment: ConsumptionMoment.EVENING,
    teaTypes: ['noir', 'rooibos', 'oolong', 'blanc'],
  },
  {
    label: 'Caramel',
    phrase: 'au caramel et aux amandes',
    ingredients: ['Arôme caramel', 'Amandes effilées'],
    moment: ConsumptionMoment.SNACK,
    teaTypes: ['noir', 'rooibos', 'pu-erh', 'oolong'],
  },
  {
    label: 'Jasmin',
    phrase: 'aux fleurs de jasmin',
    ingredients: ['Fleurs de jasmin'],
    moment: ConsumptionMoment.NOON,
    teaTypes: ['vert', 'blanc', 'oolong'],
  },
  {
    label: 'Rose',
    phrase: 'aux pétales de rose',
    ingredients: ['Pétales de rose'],
    moment: ConsumptionMoment.SNACK,
    teaTypes: ['noir', 'vert', 'blanc', 'oolong'],
  },
  {
    label: 'Menthe',
    phrase: 'à la menthe poivrée',
    ingredients: [
      'Feuilles de menthe poivrée',
      'Huile essentielle de menthe poivrée',
    ],
    moment: ConsumptionMoment.NOON,
    teaTypes: ['vert', 'noir', 'rooibos', 'maté', 'infusion'],
  },
  {
    label: 'Pêche',
    phrase: 'à la pêche de vigne',
    ingredients: ['Arôme pêche', 'Fleurs de souci'],
    moment: ConsumptionMoment.SNACK,
    teaTypes: ['vert', 'blanc', 'oolong', 'rooibos'],
  },
  {
    label: 'Tropical',
    phrase: 'aux fruits tropicaux',
    ingredients: [
      'Morceaux de mangue',
      'Morceaux d’ananas',
      'Arôme fruit de la passion',
      'Noix de coco râpée',
    ],
    moment: ConsumptionMoment.SNACK,
    teaTypes: ['vert', 'blanc', 'rooibos', 'maté'],
  },
  {
    label: 'Pomme Cannelle',
    phrase: 'à la pomme et à la cannelle',
    ingredients: ['Morceaux de pomme', 'Cannelle', 'Arôme pain d’épices'],
    moment: ConsumptionMoment.EVENING,
    teaTypes: ['noir', 'rooibos', 'infusion'],
  },
  {
    label: 'Cacao',
    phrase: 'au cacao et à la noisette',
    ingredients: ['Éclats de cacao', 'Arôme noisette'],
    moment: ConsumptionMoment.SNACK,
    teaTypes: ['noir', 'rooibos', 'pu-erh', 'maté'],
  },
  {
    label: 'Lavande',
    phrase: 'à la lavande et au bleuet',
    ingredients: [
      'Fleurs de lavande',
      'Bleuet',
      'Huile essentielle de lavande',
    ],
    moment: ConsumptionMoment.EVENING,
    teaTypes: ['noir', 'blanc', 'infusion'],
  },
  {
    label: 'Hibiscus',
    phrase: "à l'hibiscus et à la myrtille",
    ingredients: ['Hibiscus', 'Myrtilles'],
    moment: ConsumptionMoment.SNACK,
    teaTypes: ['vert', 'rooibos', 'infusion'],
  },
  {
    label: 'Marron Glacé',
    phrase: 'au marron glacé',
    ingredients: ['Arôme marron glacé', 'Amandes effilées'],
    moment: ConsumptionMoment.EVENING,
    teaTypes: ['noir', 'rooibos'],
  },
  {
    label: 'Citronnelle',
    phrase: 'à la citronnelle et au gingembre',
    ingredients: ['Citronnelle', 'Gingembre', 'Zestes de citron'],
    moment: ConsumptionMoment.NOON,
    teaTypes: ['vert', 'maté', 'infusion', 'rooibos'],
  },
  {
    label: 'Réglisse',
    phrase: "à la réglisse et à l'anis",
    ingredients: ['Réglisse', 'Anis étoilé', 'Fenouil'],
    moment: ConsumptionMoment.EVENING,
    teaTypes: ['noir', 'rooibos', 'infusion'],
  },
  {
    label: 'Miel',
    phrase: 'au miel',
    ingredients: ['Arôme miel'],
    moment: ConsumptionMoment.EVENING,
    teaTypes: ['blanc', 'oolong', 'rooibos'],
  },
];

// Ingrédients d'aromatisation (les bases sont ajoutées à partir de `bases`)
const flavorIngredients: {
  name: string;
  description: string;
  type: IngredientType;
  price: number;
}[] = [
  {
    name: 'Pétales de rose',
    description: 'Pétales de rose séchés',
    type: IngredientType.DRIED_INGREDIENT,
    price: 120,
  },
  {
    name: 'Écorces d’orange',
    description: 'Zestes d’orange séchés',
    type: IngredientType.DRIED_INGREDIENT,
    price: 90,
  },
  {
    name: 'Zestes de citron',
    description: 'Zestes de citron séchés',
    type: IngredientType.DRIED_INGREDIENT,
    price: 90,
  },
  {
    name: 'Morceaux de pomme',
    description: 'Dés de pomme séchés',
    type: IngredientType.DRIED_INGREDIENT,
    price: 80,
  },
  {
    name: 'Morceaux de fraise',
    description: 'Fraises séchées en dés',
    type: IngredientType.DRIED_INGREDIENT,
    price: 160,
  },
  {
    name: 'Framboises',
    description: 'Framboises lyophilisées',
    type: IngredientType.DRIED_INGREDIENT,
    price: 220,
  },
  {
    name: 'Myrtilles',
    description: 'Myrtilles séchées',
    type: IngredientType.DRIED_INGREDIENT,
    price: 200,
  },
  {
    name: 'Morceaux de mangue',
    description: 'Mangue séchée en dés',
    type: IngredientType.DRIED_INGREDIENT,
    price: 150,
  },
  {
    name: 'Morceaux d’ananas',
    description: 'Ananas confit en dés',
    type: IngredientType.DRIED_INGREDIENT,
    price: 140,
  },
  {
    name: 'Noix de coco râpée',
    description: 'Coco râpée grillée',
    type: IngredientType.DRIED_INGREDIENT,
    price: 110,
  },
  {
    name: 'Gingembre',
    description: 'Racine de gingembre séchée en morceaux',
    type: IngredientType.DRIED_INGREDIENT,
    price: 110,
  },
  {
    name: 'Cannelle',
    description: 'Bâtons de cannelle concassés',
    type: IngredientType.DRIED_INGREDIENT,
    price: 100,
  },
  {
    name: 'Cardamome',
    description: 'Gousses de cardamome verte',
    type: IngredientType.DRIED_INGREDIENT,
    price: 240,
  },
  {
    name: 'Clou de girofle',
    description: 'Clous de girofle entiers',
    type: IngredientType.DRIED_INGREDIENT,
    price: 130,
  },
  {
    name: 'Poivre noir',
    description: 'Grains de poivre noir concassés',
    type: IngredientType.DRIED_INGREDIENT,
    price: 120,
  },
  {
    name: 'Anis étoilé',
    description: 'Étoiles de badiane',
    type: IngredientType.DRIED_INGREDIENT,
    price: 150,
  },
  {
    name: 'Fenouil',
    description: 'Graines de fenouil',
    type: IngredientType.DRIED_INGREDIENT,
    price: 90,
  },
  {
    name: 'Réglisse',
    description: 'Racine de réglisse en morceaux',
    type: IngredientType.DRIED_INGREDIENT,
    price: 120,
  },
  {
    name: 'Citronnelle',
    description: 'Tiges de citronnelle coupées',
    type: IngredientType.DRIED_INGREDIENT,
    price: 100,
  },
  {
    name: 'Feuilles de menthe poivrée',
    description: 'Menthe poivrée séchée',
    type: IngredientType.DRIED_INGREDIENT,
    price: 90,
  },
  {
    name: 'Fleurs de jasmin',
    description: 'Fleurs de jasmin séchées',
    type: IngredientType.DRIED_INGREDIENT,
    price: 260,
  },
  {
    name: 'Fleurs de lavande',
    description: 'Fleurs de lavande de Provence',
    type: IngredientType.DRIED_INGREDIENT,
    price: 140,
  },
  {
    name: 'Bleuet',
    description: 'Pétales de bleuet',
    type: IngredientType.DRIED_INGREDIENT,
    price: 180,
  },
  {
    name: 'Fleurs de souci',
    description: 'Pétales de souci',
    type: IngredientType.DRIED_INGREDIENT,
    price: 150,
  },
  {
    name: 'Hibiscus',
    description: "Calices d'hibiscus séchés",
    type: IngredientType.DRIED_INGREDIENT,
    price: 110,
  },
  {
    name: 'Éclats de cacao',
    description: 'Fèves de cacao concassées',
    type: IngredientType.DRIED_INGREDIENT,
    price: 190,
  },
  {
    name: 'Amandes effilées',
    description: 'Amandes effilées grillées',
    type: IngredientType.DRIED_INGREDIENT,
    price: 170,
  },
  {
    name: 'Arôme vanille',
    description: 'Arôme naturel de vanille',
    type: IngredientType.LIQUID_FLAVORING,
    price: 150,
  },
  {
    name: 'Arôme fruits rouges',
    description: 'Arôme naturel de fruits rouges',
    type: IngredientType.LIQUID_FLAVORING,
    price: 140,
  },
  {
    name: 'Arôme caramel',
    description: 'Arôme naturel de caramel',
    type: IngredientType.LIQUID_FLAVORING,
    price: 140,
  },
  {
    name: 'Arôme pêche',
    description: 'Arôme naturel de pêche',
    type: IngredientType.LIQUID_FLAVORING,
    price: 140,
  },
  {
    name: 'Arôme fruit de la passion',
    description: 'Arôme naturel de fruit de la passion',
    type: IngredientType.LIQUID_FLAVORING,
    price: 160,
  },
  {
    name: 'Arôme pain d’épices',
    description: 'Arôme naturel de pain d’épices',
    type: IngredientType.LIQUID_FLAVORING,
    price: 150,
  },
  {
    name: 'Arôme noisette',
    description: 'Arôme naturel de noisette',
    type: IngredientType.LIQUID_FLAVORING,
    price: 150,
  },
  {
    name: 'Arôme marron glacé',
    description: 'Arôme naturel de marron glacé',
    type: IngredientType.LIQUID_FLAVORING,
    price: 170,
  },
  {
    name: 'Arôme miel',
    description: 'Arôme naturel de miel',
    type: IngredientType.LIQUID_FLAVORING,
    price: 140,
  },
  {
    name: 'Huile essentielle de bergamote',
    description: 'Bergamote de Calabre',
    type: IngredientType.ESSENTIAL_OIL,
    price: 200,
  },
  {
    name: 'Huile essentielle de menthe poivrée',
    description: 'Menthe poivrée de France',
    type: IngredientType.ESSENTIAL_OIL,
    price: 180,
  },
  {
    name: 'Huile essentielle de citron',
    description: 'Citron de Sicile',
    type: IngredientType.ESSENTIAL_OIL,
    price: 170,
  },
  {
    name: 'Huile essentielle de lavande',
    description: 'Lavande fine de Provence',
    type: IngredientType.ESSENTIAL_OIL,
    price: 210,
  },
];

const ingredients = [
  ...bases.map((base) => ({
    name: base.ingredient,
    description: base.description,
    type: IngredientType.BASE,
    price: Math.round(base.pricePer100g * 0.4),
  })),
  ...flavorIngredients,
];

// Générateur pseudo-aléatoire à graine fixe (mulberry32)
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(51);

// Prix psychologique en ,90
function roundPrice(cents: number): number {
  return Math.max(190, Math.round(cents / 100) * 100 - 10);
}

function buildFormats(pricePer100g: number) {
  const price = (packaging: Packaging, quantity: number) => {
    const factor = {
      [Packaging.BAG]: 1,
      [Packaging.BOX]: 1.1,
      [Packaging.TIN]: 1.2,
    }[packaging];
    const container = packaging === Packaging.TIN ? 250 : 0;
    return roundPrice((pricePer100g * quantity * factor) / 100 + container);
  };
  // ~12 % des formats en rupture de stock
  const stock = () => (random() < 0.12 ? 0 : 1 + Math.floor(random() * 120));

  const formats = [{ packaging: Packaging.BAG, quantity: 50 }];
  if (random() < 0.4) formats.push({ packaging: Packaging.BAG, quantity: 100 });
  if (random() < 0.25)
    formats.push({ packaging: Packaging.BAG, quantity: 250 });
  if (random() < 0.8) formats.push({ packaging: Packaging.BOX, quantity: 100 });
  if (random() < 0.45)
    formats.push({ packaging: Packaging.TIN, quantity: 150 });

  return formats.map((format) => ({
    ...format,
    price: price(format.packaging, format.quantity),
    stock: stock(),
  }));
}

// Une boisson très caféinée n'est pas proposée le soir
function momentFor(
  base: TeaBase,
  wanted: ConsumptionMoment,
): ConsumptionMoment {
  if (
    wanted === ConsumptionMoment.EVENING &&
    base.caffeine === CaffeineLevel.HIGH
  ) {
    return ConsumptionMoment.SNACK;
  }
  return wanted;
}

function buildProducts() {
  const result = [];
  for (const base of bases) {
    const natureMoment =
      base.caffeine === CaffeineLevel.NONE
        ? ConsumptionMoment.EVENING
        : ConsumptionMoment.MORNING;
    result.push({
      name: `${base.label} Nature`,
      description: `${base.description}, pur et sans arôme`,
      origin: base.origin,
      typeTea: base.typeTea,
      howMuchCaffeine: base.caffeine,
      moment: natureMoment,
      ingredients: [base.ingredient],
      formats: buildFormats(base.pricePer100g),
    });

    for (const profile of flavorProfiles) {
      if (!profile.teaTypes.includes(base.typeTea)) continue;
      // On ne garde qu'une partie des combinaisons pour un catalogue crédible
      if (random() > 0.6) continue;
      result.push({
        name: `${base.label} ${profile.label}`,
        description: `${base.ingredient} ${profile.phrase}`,
        origin: base.origin,
        typeTea: base.typeTea,
        howMuchCaffeine: base.caffeine,
        moment: momentFor(base, profile.moment),
        ingredients: [base.ingredient, ...profile.ingredients],
        formats: buildFormats(
          base.pricePer100g + 60 * profile.ingredients.length,
        ),
      });
    }
  }
  return result;
}

const products = buildProducts();

type SeedProduct = (typeof products)[number];

const cheapestPrice = (product: SeedProduct) =>
  Math.min(...product.formats.map((format) => format.price));

// Box thématiques : sélection de produits selon un critère, prix remisé de 15 %
const boxDefinitions: {
  name: string;
  description: string;
  size: number;
  filter: (product: SeedProduct) => boolean;
}[] = [
  {
    name: 'Box Découverte',
    description: 'Un thé de chaque famille pour faire le tour de la maison',
    size: 6,
    filter: (product) => product.name.endsWith('Nature'),
  },
  {
    name: 'Box Thés Noirs',
    description: 'Le meilleur de nos thés noirs',
    size: 5,
    filter: (product) => product.typeTea === 'noir',
  },
  {
    name: 'Box Thés Verts',
    description: 'Sélection de thés verts de Chine et du Japon',
    size: 5,
    filter: (product) => product.typeTea === 'vert',
  },
  {
    name: 'Box Thés Blancs',
    description: 'Des thés blancs délicats et floraux',
    size: 4,
    filter: (product) => product.typeTea === 'blanc',
  },
  {
    name: 'Box Oolong',
    description: 'Les oolongs de Chine et de Taïwan',
    size: 3,
    filter: (product) => product.typeTea === 'oolong',
  },
  {
    name: 'Box Soirée Sans Théine',
    description: 'Infusions et rooibos pour le soir',
    size: 5,
    filter: (product) =>
      product.howMuchCaffeine === CaffeineLevel.NONE &&
      product.moment === ConsumptionMoment.EVENING,
  },
  {
    name: 'Box Réveil Tonique',
    description: 'Des thés corsés pour bien démarrer la journée',
    size: 4,
    filter: (product) =>
      product.howMuchCaffeine === CaffeineLevel.HIGH &&
      product.moment === ConsumptionMoment.MORNING,
  },
  {
    name: 'Box Hiver Cocooning',
    description: 'Des recettes épicées et gourmandes pour l’hiver',
    size: 5,
    filter: (product) =>
      /Chaï|Pomme Cannelle|Marron Glacé|Caramel/.test(product.name),
  },
  {
    name: 'Box Fruitée',
    description: 'Fruits rouges, pêche et fruits tropicaux',
    size: 5,
    filter: (product) =>
      /Fruits Rouges|Pêche|Tropical|Hibiscus/.test(product.name),
  },
  {
    name: 'Box Florale',
    description: 'Jasmin, rose et lavande',
    size: 4,
    filter: (product) => /Jasmin|Rose|Lavande/.test(product.name),
  },
  {
    name: 'Box Agrumes',
    description: 'Bergamote, citron et orange',
    size: 4,
    filter: (product) => /Bergamote|Agrumes|Citronnelle/.test(product.name),
  },
  {
    name: 'Box Goûter',
    description: 'Pour accompagner le goûter',
    size: 4,
    filter: (product) => product.moment === ConsumptionMoment.SNACK,
  },
];

const boxes = boxDefinitions.map((definition) => {
  const selection = products
    .filter(definition.filter)
    .slice(0, definition.size);
  return {
    name: definition.name,
    description: definition.description,
    price: roundPrice(
      selection.reduce((sum, product) => sum + cheapestPrice(product), 0) *
        0.85,
    ),
    products: selection.map((product) => product.name),
  };
});

// Image de démo : pastille colorée avec l'initiale du produit, en data URI base64
function placeholderImage(name: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" rx="24" fill="${color}"/><text x="100" y="128" font-size="96" font-family="sans-serif" fill="#fff" text-anchor="middle">${name[0]}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

const colorByTeaType: Record<string, string> = {
  noir: '#5b3a29',
  vert: '#4f7942',
  blanc: '#b8a88a',
  oolong: '#8a6d1f',
  'pu-erh': '#3b2a20',
  rooibos: '#b5482c',
  maté: '#6b8e23',
  infusion: '#9b6fa8',
};

async function seed() {
  // eslint-disable-next-line no-process-env -- garde-fou : le seed vide les tables du catalogue
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed interdit en production');
  }

  await dataSource.initialize();

  await dataSource.transaction(async (manager) => {
    await manager.query(
      'TRUNCATE "box_products", "product_ingredients", "product_formats", "boxes", "products", "ingredients"',
    );

    const savedIngredients = await manager.save(
      ingredients.map((data) => manager.create(Ingredient, data)),
    );
    const ingredientByName = new Map(savedIngredients.map((i) => [i.name, i]));

    const savedProducts = await manager.save(
      products.map((data) =>
        manager.create(Product, {
          ...data,
          formats: data.formats.map((format) =>
            manager.create(ProductFormat, format),
          ),
          image: placeholderImage(data.name, colorByTeaType[data.typeTea]),
          ingredients: data.ingredients.map((name) =>
            ingredientByName.get(name)!,
          ),
        }),
      ),
    );
    const productByName = new Map(savedProducts.map((p) => [p.name, p]));

    await manager.save(
      boxes.map((data) =>
        manager.create(Box, {
          ...data,
          products: data.products.map((name) => productByName.get(name)!),
        }),
      ),
    );
  });

  console.log(
    `Seed OK : ${ingredients.length} ingrédients, ${products.length} produits (${products.reduce((n, p) => n + p.formats.length, 0)} formats), ${boxes.length} box`,
  );
  await dataSource.destroy();
}

seed().catch(async (error) => {
  console.error(error);
  if (dataSource.isInitialized) await dataSource.destroy();
  process.exit(1);
});
