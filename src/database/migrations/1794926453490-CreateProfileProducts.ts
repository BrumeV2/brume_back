import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProfileProducts1794926453490 implements MigrationInterface {
  name = 'CreateProfileProducts1794926453490';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."profile_products_type_enum" AS ENUM('favorite', 'creation', 'review')`,
    );
    await queryRunner.query(
      `CREATE TABLE "profile_products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "type" "public"."profile_products_type_enum" NOT NULL, "note" integer, "review" text, "profileId" uuid NOT NULL, "productId" uuid NOT NULL, CONSTRAINT "UQ_fb676de6038ad935f74a450b567" UNIQUE ("profileId", "productId", "type"), CONSTRAINT "CHK_70df2130d777812a9011e6f72d" CHECK ("type" = 'review' OR ("note" IS NULL AND "review" IS NULL)), CONSTRAINT "CHK_dec06357eea27a5186571fca56" CHECK ("note" IS NULL OR "note" BETWEEN 1 AND 5), CONSTRAINT "PK_214756757405d13d1fae1b07e81" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_514ae0372f875178698fe81a66" ON "profile_products"  ("productId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "profile_products" ADD CONSTRAINT "FK_ea9bf44b25a8bd95d8033ca40a3" FOREIGN KEY ("profileId") REFERENCES "profils"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "profile_products" ADD CONSTRAINT "FK_514ae0372f875178698fe81a66f" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profile_products" DROP CONSTRAINT "FK_514ae0372f875178698fe81a66f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "profile_products" DROP CONSTRAINT "FK_ea9bf44b25a8bd95d8033ca40a3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_514ae0372f875178698fe81a66"`,
    );
    await queryRunner.query(`DROP TABLE "profile_products"`);
    await queryRunner.query(`DROP TYPE "public"."profile_products_type_enum"`);
  }
}
