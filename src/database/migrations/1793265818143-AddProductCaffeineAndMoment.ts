import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductCaffeineAndMoment1793265818143 implements MigrationInterface {
  name = 'AddProductCaffeineAndMoment1793265818143';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."products_howmuchcaffeine_enum" AS ENUM('none', 'low', 'medium', 'high')`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "howMuchCaffeine" "public"."products_howmuchcaffeine_enum" NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."products_moment_enum" AS ENUM('morning', 'noon', 'snack', 'evening')`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "moment" "public"."products_moment_enum" NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "moment"`);
    await queryRunner.query(`DROP TYPE "public"."products_moment_enum"`);
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "howMuchCaffeine"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."products_howmuchcaffeine_enum"`,
    );
  }
}
