import 'dotenv/config';
import { DataSource } from 'typeorm';
import { getDatabaseConfig } from '../../config/database.config';
import { Packaging } from '../../modules/products/enums/packaging.enum';

const db = getDatabaseConfig();

const dataSource = new DataSource({
  type: 'postgres',
  host: db.host,
  port: db.port,
  username: db.user,
  password: db.password,
  database: db.name,
});

// Correspondance des variantes de test du front
const MOCK_VARIANTS = [
  // Produit 1 : Matcha
  {
    id: 'b0000000-0000-4000-8000-000000000101',
    packaging: Packaging.BOX,
    quantity: 50,
    price: 2400,
    stock: 40,
  },
  {
    id: 'b0000000-0000-4000-8000-000000000102',
    packaging: Packaging.BOX,
    quantity: 100,
    price: 4200,
    stock: 40,
  },
  {
    id: 'b0000000-0000-4000-8000-000000000103',
    packaging: Packaging.BAG,
    quantity: 100,
    price: 3600,
    stock: 3,
  },
  // Produit 2 : Sencha
  {
    id: 'b0000000-0000-4000-8000-000000000201',
    packaging: Packaging.BOX,
    quantity: 50,
    price: 1500,
    stock: 40,
  },
  {
    id: 'b0000000-0000-4000-8000-000000000202',
    packaging: Packaging.BOX,
    quantity: 100,
    price: 2600,
    stock: 40,
  },
  // Produit 3 : Long Jing
  {
    id: 'b0000000-0000-4000-8000-000000000301',
    packaging: Packaging.BOX,
    quantity: 50,
    price: 2600,
    stock: 3,
  },
  {
    id: 'b0000000-0000-4000-8000-000000000302',
    packaging: Packaging.BOX,
    quantity: 100,
    price: 4600,
    stock: 0,
  },
  // Produit 4 : Genmaicha
  {
    id: 'b0000000-0000-4000-8000-000000000401',
    packaging: Packaging.BOX,
    quantity: 100,
    price: 1300,
    stock: 40,
  },
  {
    id: 'b0000000-0000-4000-8000-000000000402',
    packaging: Packaging.BAG,
    quantity: 200,
    price: 2200,
    stock: 40,
  },
  // Produit 5 : Darjeeling
  {
    id: 'b0000000-0000-4000-8000-000000000501',
    packaging: Packaging.BOX,
    quantity: 50,
    price: 2200,
    stock: 40,
  },
  {
    id: 'b0000000-0000-4000-8000-000000000502',
    packaging: Packaging.BOX,
    quantity: 100,
    price: 3900,
    stock: 40,
  },
  // Produit 6 : Chaï
  {
    id: 'b0000000-0000-4000-8000-000000000601',
    packaging: Packaging.BOX,
    quantity: 100,
    price: 1500,
    stock: 40,
  },
  {
    id: 'b0000000-0000-4000-8000-000000000602',
    packaging: Packaging.BAG,
    quantity: 250,
    price: 3200,
    stock: 40,
  },
];

async function seedMockVariants() {
  await dataSource.initialize();
  const products = await dataSource.query<{ id: string }[]>(
    'SELECT id FROM products LIMIT $1',
    [MOCK_VARIANTS.length],
  );
  if (!products.length) {
    console.error('Aucun produit en base pour rattacher les variantes.');
    await dataSource.destroy();
    return;
  }

  for (let i = 0; i < MOCK_VARIANTS.length; i++) {
    const v = MOCK_VARIANTS[i];
    const productId = products[i % products.length].id;
    await dataSource.query(
      'DELETE FROM product_formats WHERE "productId" = $1 AND packaging = $2 AND quantity = $3',
      [productId, v.packaging, v.quantity],
    );
    await dataSource.query(
      `INSERT INTO product_formats ("id", "productId", "packaging", "quantity", "price", "stock", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT ("id") DO UPDATE SET "stock" = EXCLUDED."stock", "price" = EXCLUDED."price"`,
      [v.id, productId, v.packaging, v.quantity, v.price, v.stock],
    );
  }

  console.log(
    `${MOCK_VARIANTS.length} variantes de test synchronisées avec succès.`,
  );
  await dataSource.destroy();
}

seedMockVariants().catch((err) => {
  console.error(err);
  process.exit(1);
});
