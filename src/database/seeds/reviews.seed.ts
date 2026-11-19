import { ProfileProduct } from '../../modules/products/entities/profile-product.entity';
import { Product } from '../../modules/products/entities/product.entity';
import { ProfileProductType } from '../../modules/products/enums/profile-product-type.enum';
import { Profile } from '../../modules/users/entities/profile.entity';
import { User } from '../../modules/users/entities/user.entity';
import dataSource from '../data-source';

// Jeu de données de dev pour profile_products : clients fictifs, favoris, créations et avis.
// À lancer après `npm run seed` (catalogue). Rejouable : les clients @brume.test sont
// supprimés puis recréés (leurs profils et liens partent en cascade).
// Volontairement, une partie du catalogue n'a aucun avis et certains avis n'ont pas de note,
// pour vérifier le tri par note (produits sans note en dernier) et les égalités.

const TEST_EMAIL_DOMAIN = 'brume.test';

const customers = [
  ['Camille', 'Martin', 'Lyon'],
  ['Louis', 'Bernard', 'Paris'],
  ['Inès', 'Dubois', 'Nantes'],
  ['Hugo', 'Thomas', 'Lille'],
  ['Léa', 'Robert', 'Bordeaux'],
  ['Nathan', 'Petit', 'Rennes'],
  ['Chloé', 'Durand', 'Toulouse'],
  ['Arthur', 'Leroy', 'Strasbourg'],
  ['Manon', 'Moreau', 'Marseille'],
  ['Jules', 'Simon', 'Nice'],
] as const;

const comments: Record<number, string[]> = {
  1: ['Pas du tout à mon goût.', 'Très décevant, trop amer.'],
  2: ['Bof, arômes trop discrets.', 'Correct sans plus.'],
  3: ['Agréable mais sans surprise.', 'Bon thé du quotidien.'],
  4: ['Très bon, je recommande.', 'Belle découverte, bien équilibré.'],
  5: ['Un coup de cœur !', 'Excellent, déjà recommandé deux fois.'],
};

// Générateur pseudo-aléatoire à graine fixe (mulberry32), comme le seed du catalogue
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(17);
const pick = <T>(items: readonly T[]): T =>
  items[Math.floor(random() * items.length)];

async function seed() {
  // eslint-disable-next-line no-process-env -- garde-fou : le seed supprime des comptes
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed interdit en production');
  }

  await dataSource.initialize();

  const counts = await dataSource.transaction(async (manager) => {
    await manager
      .createQueryBuilder()
      .delete()
      .from(User)
      .where('email LIKE :domain', { domain: `%@${TEST_EMAIL_DOMAIN}` })
      .execute();

    const products = await manager.find(Product, { order: { name: 'ASC' } });
    if (!products.length)
      throw new Error('Catalogue vide : lancer `npm run seed` avant.');

    const profiles: Profile[] = [];
    for (const [index, [firstName, lastName, city]] of customers.entries()) {
      const user = await manager.save(
        manager.create(User, {
          googleSub: `seed-${index + 1}`,
          email: `client${index + 1}@${TEST_EMAIL_DOMAIN}`,
          emailVerifiedAt: new Date(),
        }),
      );
      profiles.push(
        await manager.save(
          manager.create(Profile, {
            userId: user.id,
            firstName,
            lastName,
            city,
          }),
        ),
      );
    }

    // Chaque produit a une « qualité » de base ; ~40 % du catalogue reste sans avis
    const links: Partial<ProfileProduct>[] = [];
    for (const product of products) {
      const quality = 1 + Math.floor(random() * 5);
      const reviewed = random() >= 0.4;
      for (const profile of profiles) {
        if (reviewed && random() < 0.45) {
          const note = Math.min(
            5,
            Math.max(1, quality + Math.round((random() - 0.5) * 2)),
          );
          // ~10 % d'avis sans note (texte seul) : ignorés par la moyenne
          const withoutNote = random() < 0.1;
          links.push({
            profile,
            product,
            type: ProfileProductType.REVIEW,
            note: withoutNote ? null : note,
            review: withoutNote || random() < 0.7 ? pick(comments[note]) : null,
          });
        }
        if (random() < 0.06)
          links.push({ profile, product, type: ProfileProductType.FAVORITE });
        if (random() < 0.01)
          links.push({ profile, product, type: ProfileProductType.CREATION });
      }
    }
    await manager.save(
      links.map((link) => manager.create(ProfileProduct, link)),
    );

    const byType = (type: ProfileProductType) =>
      links.filter((link) => link.type === type).length;
    const reviewedProducts = new Set(
      links
        .filter((link) => link.type === ProfileProductType.REVIEW && link.note)
        .map((link) => link.product!.id),
    ).size;
    return {
      profiles: profiles.length,
      reviews: byType(ProfileProductType.REVIEW),
      favorites: byType(ProfileProductType.FAVORITE),
      creations: byType(ProfileProductType.CREATION),
      reviewedProducts,
      products: products.length,
    };
  });

  console.log(
    `Seed OK : ${counts.profiles} clients, ${counts.reviews} avis, ${counts.favorites} favoris, ${counts.creations} créations ; ${counts.reviewedProducts}/${counts.products} produits notés`,
  );
  await dataSource.destroy();
}

seed().catch(async (error) => {
  console.error(error);
  if (dataSource.isInitialized) await dataSource.destroy();
  process.exit(1);
});
