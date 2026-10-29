import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductImage1793267737316 implements MigrationInterface {
  name = 'AddProductImage1793267737316';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ADD "image" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "image"`);
  }
}
