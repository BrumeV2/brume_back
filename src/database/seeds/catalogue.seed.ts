import { Box } from '../../modules/products/entities/box.entity';
import { Ingredient } from '../../modules/products/entities/ingredient.entity';
import { Product } from '../../modules/products/entities/product.entity';
import { CaffeineLevel } from '../../modules/products/enums/caffeine-level.enum';
import { ConsumptionMoment } from '../../modules/products/enums/consumption-moment.enum';
import { IngredientType } from '../../modules/products/enums/ingredient-type.enum';
import dataSource from '../data-source';

// Jeu de données de dev : vide le catalogue puis le remplit (prix en centimes)
const ingredients = [
  {
    name: 'Thé vert Sencha',
    description: 'Thé vert japonais, notes herbacées et iodées',
    type: IngredientType.BASE,
    price: 450,
  },
  {
    name: 'Thé noir Assam',
    description: 'Thé noir indien corsé et malté',
    type: IngredientType.BASE,
    price: 380,
  },
  {
    name: 'Thé blanc Pai Mu Tan',
    description: 'Thé blanc chinois doux et floral',
    type: IngredientType.BASE,
    price: 620,
  },
  {
    name: 'Rooibos',
    description: "Plante d'Afrique du Sud, sans théine",
    type: IngredientType.BASE,
    price: 320,
  },
  {
    name: 'Oolong Tie Guan Yin',
    description: 'Oolong de Chine peu oxydé, notes de fleurs',
    type: IngredientType.BASE,
    price: 750,
  },
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
    name: 'Morceaux de pomme',
    description: 'Dés de pomme séchés',
    type: IngredientType.DRIED_INGREDIENT,
    price: 80,
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
];

const products = [
  {
    name: 'Earl Grey Brume',
    description: 'Thé noir à la bergamote, le classique de la maison',
    price: 890,
    origin: 'Inde',
    typeTea: 'noir',
    quantity: 120,
    howMuchCaffeine: CaffeineLevel.HIGH,
    moment: ConsumptionMoment.MORNING,
    ingredients: ['Thé noir Assam', 'Huile essentielle de bergamote'],
  },
  {
    name: 'Sencha Nature',
    description: 'Thé vert japonais pur',
    price: 990,
    origin: 'Japon',
    typeTea: 'vert',
    quantity: 80,
    howMuchCaffeine: CaffeineLevel.MEDIUM,
    moment: ConsumptionMoment.NOON,
    ingredients: ['Thé vert Sencha'],
  },
  {
    name: 'Jardin de Roses',
    description: 'Thé vert aux pétales de rose et fruits rouges',
    price: 1090,
    origin: 'Japon',
    typeTea: 'vert',
    quantity: 60,
    howMuchCaffeine: CaffeineLevel.MEDIUM,
    moment: ConsumptionMoment.SNACK,
    ingredients: ['Thé vert Sencha', 'Pétales de rose', 'Arôme fruits rouges'],
  },
  {
    name: 'Chaï Épicé',
    description: 'Thé noir, cannelle et gingembre',
    price: 950,
    origin: 'Inde',
    typeTea: 'noir',
    quantity: 75,
    howMuchCaffeine: CaffeineLevel.HIGH,
    moment: ConsumptionMoment.MORNING,
    ingredients: ['Thé noir Assam', 'Cannelle', 'Gingembre'],
  },
  {
    name: 'Rooibos Vanille',
    description: 'Rooibos gourmand à la vanille, sans théine',
    price: 850,
    origin: 'Afrique du Sud',
    typeTea: 'rooibos',
    quantity: 100,
    howMuchCaffeine: CaffeineLevel.NONE,
    moment: ConsumptionMoment.EVENING,
    ingredients: ['Rooibos', 'Arôme vanille'],
  },
  {
    name: 'Pomme d’Hiver',
    description: 'Rooibos, pomme, cannelle et caramel',
    price: 890,
    origin: 'Afrique du Sud',
    typeTea: 'rooibos',
    quantity: 50,
    howMuchCaffeine: CaffeineLevel.NONE,
    moment: ConsumptionMoment.EVENING,
    ingredients: ['Rooibos', 'Morceaux de pomme', 'Cannelle', 'Arôme caramel'],
  },
  {
    name: 'Nuage Blanc',
    description: 'Thé blanc délicat aux écorces d’orange',
    price: 1290,
    origin: 'Chine',
    typeTea: 'blanc',
    quantity: 30,
    howMuchCaffeine: CaffeineLevel.LOW,
    moment: ConsumptionMoment.SNACK,
    ingredients: ['Thé blanc Pai Mu Tan', 'Écorces d’orange'],
  },
  {
    name: 'Oolong Menthe Fraîche',
    description: 'Oolong floral relevé de menthe poivrée',
    price: 1390,
    origin: 'Chine',
    typeTea: 'oolong',
    quantity: 0,
    howMuchCaffeine: CaffeineLevel.MEDIUM,
    moment: ConsumptionMoment.NOON,
    ingredients: ['Oolong Tie Guan Yin', 'Huile essentielle de menthe poivrée'],
  },
];

const boxes = [
  {
    name: 'Box Découverte',
    description: 'Quatre thés pour faire le tour de la maison',
    price: 3290,
    products: [
      'Earl Grey Brume',
      'Sencha Nature',
      'Rooibos Vanille',
      'Nuage Blanc',
    ],
  },
  {
    name: 'Box Hiver Cocooning',
    description: 'Des infusions chaudes et épicées pour l’hiver',
    price: 2490,
    products: ['Chaï Épicé', 'Pomme d’Hiver', 'Rooibos Vanille'],
  },
  {
    name: 'Box Thés Verts',
    description: 'Sélection de thés verts japonais',
    price: 1890,
    products: ['Sencha Nature', 'Jardin de Roses'],
  },
];

// Image de démo : pastille colorée avec l'initiale du produit, en data URI base64
function placeholderImage(name: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" rx="24" fill="${color}"/><text x="100" y="128" font-size="96" font-family="sans-serif" fill="#fff" text-anchor="middle">${name[0]}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

const colorByTeaType: Record<string, string> = {
  noir: '#5b3a29',
  vert: '#4f7942',
  blanc: '#b8a88a',
  rooibos: '#b5482c',
  oolong: '#8a6d1f',
};

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed interdit en production');
  }

  await dataSource.initialize();

  await dataSource.transaction(async (manager) => {
    await manager.query(
      'TRUNCATE "box_products", "product_ingredients", "boxes", "products", "ingredients"',
    );

    const savedIngredients = await manager.save(
      ingredients.map((data) => manager.create(Ingredient, data)),
    );
    const ingredientByName = new Map(savedIngredients.map((i) => [i.name, i]));

    const savedProducts = await manager.save(
      products.map((data) =>
        manager.create(Product, {
          ...data,
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
    `Seed OK : ${ingredients.length} ingrédients, ${products.length} produits, ${boxes.length} box`,
  );
  await dataSource.destroy();
}

seed().catch(async (error) => {
  console.error(error);
  if (dataSource.isInitialized) await dataSource.destroy();
  process.exit(1);
});
