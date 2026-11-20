import { MigrationInterface, QueryRunner } from 'typeorm';

// US-014 : recherche insensible aux accents et exclusion des produits non publiés
export class AddProductSearch1795564800000 implements MigrationInterface {
  name = 'AddProductSearch1795564800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // unaccent est une extension « trusted » (PostgreSQL ≥ 13) livrée avec l'image officielle
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);
    // Les produits existants restent visibles
    await queryRunner.query(
      `ALTER TABLE "products" ADD "published" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "published"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS unaccent`);
  }
}
