import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductFormats1793268987419 implements MigrationInterface {
  name = 'AddProductFormats1793268987419';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."product_formats_packaging_enum" AS ENUM('box', 'bag', 'tin')`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_formats" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "packaging" "public"."product_formats_packaging_enum" NOT NULL, "quantity" integer NOT NULL, "price" integer NOT NULL, "stock" integer NOT NULL DEFAULT '0', "productId" uuid NOT NULL, CONSTRAINT "UQ_b9b5ec42752bbbc7ac4e510532e" UNIQUE ("productId", "packaging", "quantity"), CONSTRAINT "PK_c3b3ffb50cf150a6e4f7aee436a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "price"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "quantity"`);
    await queryRunner.query(
      `ALTER TABLE "product_formats" ADD CONSTRAINT "FK_2651d041151e34243d78f30aefd" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_formats" DROP CONSTRAINT "FK_2651d041151e34243d78f30aefd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "quantity" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "price" integer NOT NULL`,
    );
    await queryRunner.query(`DROP TABLE "product_formats"`);
    await queryRunner.query(
      `DROP TYPE "public"."product_formats_packaging_enum"`,
    );
  }
}
