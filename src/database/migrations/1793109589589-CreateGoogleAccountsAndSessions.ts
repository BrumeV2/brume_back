import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGoogleAccountsAndSessions1793109589589 implements MigrationInterface {
  name = 'CreateGoogleAccountsAndSessions1793109589589';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "auth_rate_limits" ("key_hash" character varying(64) NOT NULL, "attempts" integer NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_da5b7dbb871b85e911395474cb4" PRIMARY KEY ("key_hash"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6999cc71407e03c02512aeedd7" ON "auth_rate_limits"  ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "oauth_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "state_hash" character varying(64) NOT NULL, "browser_hash" character varying(64) NOT NULL, "nonce" character varying(43) NOT NULL, "code_verifier" character varying(43) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_cc8962d50db2851bcd5ee9406ba" UNIQUE ("state_hash"), CONSTRAINT "PK_33112be2a9a40ec3da4842c954e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cf1fe8c13ca0817c2d399a2d71" ON "oauth_transactions"  ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_role" AS ENUM('CUSTOMER', 'ADMIN')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."account_status" AS ENUM('ACTIVE', 'BLOCKED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "utilisateurs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "google_sub" character varying(255) NOT NULL, "email" character varying(254) NOT NULL, "prenom" character varying(100), "nom" character varying(100), "telephone" character varying(30), "role" "public"."user_role" NOT NULL DEFAULT 'CUSTOMER', "statut" "public"."account_status" NOT NULL DEFAULT 'ACTIVE', "email_verifie_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_3149be6deeee0a1b1dd01588585" UNIQUE ("google_sub"), CONSTRAINT "UQ_6b14325a486fe68d16aa889e4dc" UNIQUE ("email"), CONSTRAINT "PK_d3c39b551c51a0bdc76e07b9197" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "utilisateur_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_abaa9e068cdd390bc5210f79884" UNIQUE ("token_hash"), CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2fbffece01059ab997be0649c6" ON "sessions"  ("utilisateur_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9cfe37d28c3b229a350e086d94" ON "sessions"  ("expires_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD CONSTRAINT "FK_2fbffece01059ab997be0649c69" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sessions" DROP CONSTRAINT "FK_2fbffece01059ab997be0649c69"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9cfe37d28c3b229a350e086d94"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2fbffece01059ab997be0649c6"`,
    );
    await queryRunner.query(`DROP TABLE "sessions"`);
    await queryRunner.query(`DROP TABLE "utilisateurs"`);
    await queryRunner.query(`DROP TYPE "public"."account_status"`);
    await queryRunner.query(`DROP TYPE "public"."user_role"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cf1fe8c13ca0817c2d399a2d71"`,
    );
    await queryRunner.query(`DROP TABLE "oauth_transactions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6999cc71407e03c02512aeedd7"`,
    );
    await queryRunner.query(`DROP TABLE "auth_rate_limits"`);
  }
}
