import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAddresses1793261709905 implements MigrationInterface {
  name = 'CreateAddresses1793261709905';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "adresses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "utilisateur_id" uuid NOT NULL, "label" character varying(50), "first_name" character varying(100) NOT NULL, "last_name" character varying(100) NOT NULL, "line1" character varying(200) NOT NULL, "line2" character varying(200), "postal_code" character varying(5) NOT NULL, "city" character varying(100) NOT NULL, "country" character(2) NOT NULL, "phone" character varying(20) NOT NULL, "is_default" boolean NOT NULL DEFAULT false, CONSTRAINT "CHK_address_zone" CHECK ("country" = 'FR' AND "postal_code" ~ '^(0[1-9]|[1-8][0-9]|9[0-5])[0-9]{3}$' AND "postal_code" NOT LIKE '20%'), CONSTRAINT "PK_2787c84f7433e390ff8961d552d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_55eb3a69eef6c55305d00bd523" ON "adresses"  ("utilisateur_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_address_default_user" ON "adresses"  ("utilisateur_id") WHERE "is_default" = true`,
    );
    await queryRunner.query(
      `ALTER TABLE "adresses" ADD CONSTRAINT "FK_55eb3a69eef6c55305d00bd523a" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "adresses" DROP CONSTRAINT "FK_55eb3a69eef6c55305d00bd523a"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_address_default_user"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_55eb3a69eef6c55305d00bd523"`,
    );
    await queryRunner.query(`DROP TABLE "adresses"`);
  }
}
