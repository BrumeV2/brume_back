import { MigrationInterface, QueryRunner } from 'typeorm';

// US-080 : référence unique des formats (SKU) et audit de création des produits
export class AddProductCreation1795737600000 implements MigrationInterface {
  name = 'AddProductCreation1795737600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Valeur par défaut volatile : chaque format existant reçoit une référence distincte.
    // L'API de création impose une référence saisie ; ce défaut ne sert qu'aux données
    // antérieures et aux insertions techniques (seeds).
    await queryRunner.query(
      `ALTER TABLE "product_formats" ADD "sku" character varying(40) NOT NULL DEFAULT ('F-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)))`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_formats" ADD CONSTRAINT "UQ_product_formats_sku" UNIQUE ("sku")`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_formats" ADD CONSTRAINT "CHK_product_formats_sku" CHECK ("sku" ~ '^[A-Z0-9-]{2,40}$')`,
    );
    // Auteur de la création ; conservé à NULL si le compte est supprimé
    await queryRunner.query(`ALTER TABLE "products" ADD "createdById" uuid`);
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_products_created_by" FOREIGN KEY ("createdById") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_products_created_by"`,
    );
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "createdById"`);
    await queryRunner.query(
      `ALTER TABLE "product_formats" DROP CONSTRAINT "CHK_product_formats_sku"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_formats" DROP CONSTRAINT "UQ_product_formats_sku"`,
    );
    await queryRunner.query(`ALTER TABLE "product_formats" DROP COLUMN "sku"`);
  }
}
