import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceAddressesWithProfiles1793280000000 implements MigrationInterface {
  name = 'ReplaceAddressesWithProfiles1793280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "adresses" CASCADE`);

    await queryRunner.query(
      `CREATE TABLE "profils" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "utilisateur_id" uuid NOT NULL,
        "prenom" character varying(100),
        "nom" character varying(100),
        "telephone" character varying(30),
        "adresse" character varying(255),
        "code_postal" character varying(20),
        "ville" character varying(100),
        "points_fidelite" integer NOT NULL DEFAULT 0,
        "do_newsletter" boolean NOT NULL DEFAULT false,
        CONSTRAINT "UQ_profils_utilisateur_id" UNIQUE ("utilisateur_id"),
        CONSTRAINT "CHK_profils_points_fidelite" CHECK ("points_fidelite" >= 0),
        CONSTRAINT "PK_profils_id" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_profils_utilisateur_id" ON "profils" ("utilisateur_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "profils" ADD CONSTRAINT "FK_profils_utilisateur_id" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `INSERT INTO "profils" ("id", "utilisateur_id", "prenom", "nom", "telephone", "points_fidelite", "do_newsletter")
       SELECT uuid_generate_v4(), u."id", u."prenom", u."nom", u."telephone", 0, false
       FROM "utilisateurs" u
       WHERE NOT EXISTS (SELECT 1 FROM "profils" p WHERE p."utilisateur_id" = u."id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "utilisateurs" DROP COLUMN IF EXISTS "prenom"`,
    );
    await queryRunner.query(
      `ALTER TABLE "utilisateurs" DROP COLUMN IF EXISTS "nom"`,
    );
    await queryRunner.query(
      `ALTER TABLE "utilisateurs" DROP COLUMN IF EXISTS "telephone"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "utilisateurs" ADD COLUMN "prenom" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "utilisateurs" ADD COLUMN "nom" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "utilisateurs" ADD COLUMN "telephone" character varying(30)`,
    );

    await queryRunner.query(
      `UPDATE "utilisateurs" u
       SET "prenom" = p."prenom", "nom" = p."nom", "telephone" = p."telephone"
       FROM "profils" p
       WHERE p."utilisateur_id" = u."id"`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "profils" CASCADE`);

    await queryRunner.query(
      `CREATE TABLE "adresses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "utilisateur_id" uuid NOT NULL,
        "prenom" character varying(100) NOT NULL,
        "nom" character varying(100) NOT NULL,
        "ligne1" character varying(200) NOT NULL,
        "ligne2" character varying(200),
        "code_postal" character varying(5) NOT NULL,
        "ville" character varying(100) NOT NULL,
        "pays" character(2) NOT NULL,
        "telephone" character varying(20) NOT NULL,
        "libelle" character varying(50),
        "est_defaut" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_adresses_id" PRIMARY KEY ("id")
      )`,
    );
  }
}
