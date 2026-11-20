import { MigrationInterface, QueryRunner } from 'typeorm';

// US-015 : synonymes des ingrédients, utilisés par les recherches
export class AddIngredientAliases1795651200000 implements MigrationInterface {
  name = 'AddIngredientAliases1795651200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ingredients" ADD "aliases" text array NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ingredients" DROP COLUMN "aliases"`);
  }
}
