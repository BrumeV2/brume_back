import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCatalogue1793263061466 implements MigrationInterface {
  name = 'CreateCatalogue1793263061466';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."ingredients_type_enum" AS ENUM('base', 'dried_ingredient', 'liquid_flavoring', 'essential_oil')`,
    );
    await queryRunner.query(
      `CREATE TABLE "ingredients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying NOT NULL, "description" character varying, "type" "public"."ingredients_type_enum" NOT NULL, "price" integer NOT NULL, CONSTRAINT "PK_9240185c8a5507251c9f15e0649" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying NOT NULL, "description" character varying, "price" integer NOT NULL, "origin" character varying, "typeTea" character varying, "quantity" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "boxes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying NOT NULL, "description" character varying, "price" integer NOT NULL, CONSTRAINT "PK_749574b01e0038dae8464fcb445" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_ingredients" ("productId" uuid NOT NULL, "ingredientId" uuid NOT NULL, CONSTRAINT "PK_48e5271492b738d87ca91625294" PRIMARY KEY ("productId", "ingredientId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0c47e7d54540edb8171ebe4e77" ON "product_ingredients"  ("productId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b40728e717eb031baa2e85371e" ON "product_ingredients"  ("ingredientId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "box_products" ("boxId" uuid NOT NULL, "productId" uuid NOT NULL, CONSTRAINT "PK_76ef7514e31416080d2475256b0" PRIMARY KEY ("boxId", "productId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cdbaa2e4eaa33b39b9e319acda" ON "box_products"  ("boxId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f32b228b03d547524204e04ffd" ON "box_products"  ("productId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "product_ingredients" ADD CONSTRAINT "FK_0c47e7d54540edb8171ebe4e775" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_ingredients" ADD CONSTRAINT "FK_b40728e717eb031baa2e85371ea" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "box_products" ADD CONSTRAINT "FK_cdbaa2e4eaa33b39b9e319acdaa" FOREIGN KEY ("boxId") REFERENCES "boxes"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "box_products" ADD CONSTRAINT "FK_f32b228b03d547524204e04ffdb" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "box_products" DROP CONSTRAINT "FK_f32b228b03d547524204e04ffdb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "box_products" DROP CONSTRAINT "FK_cdbaa2e4eaa33b39b9e319acdaa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_ingredients" DROP CONSTRAINT "FK_b40728e717eb031baa2e85371ea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_ingredients" DROP CONSTRAINT "FK_0c47e7d54540edb8171ebe4e775"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f32b228b03d547524204e04ffd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cdbaa2e4eaa33b39b9e319acda"`,
    );
    await queryRunner.query(`DROP TABLE "box_products"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b40728e717eb031baa2e85371e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0c47e7d54540edb8171ebe4e77"`,
    );
    await queryRunner.query(`DROP TABLE "product_ingredients"`);
    await queryRunner.query(`DROP TABLE "boxes"`);
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(`DROP TABLE "ingredients"`);
    await queryRunner.query(`DROP TYPE "public"."ingredients_type_enum"`);
  }
}
