import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitIdentity1791842887450 implements MigrationInterface {
  name = 'InitIdentity1791842887450';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."audit_action" AS ENUM('ROLE_CHANGED', 'ORGANIZATION_CHANGED', 'USER_SUSPENDED', 'USER_REACTIVATED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor_id" uuid NOT NULL, "target_user_id" uuid NOT NULL, "action" "public"."audit_action" NOT NULL, "before" jsonb, "after" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_target" ON "audit_logs"  ("target_user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "login_attempts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(254) NOT NULL, "ip" character varying(64), "succeeded" boolean NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_070e613c8f768b1a70742705c5b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_login_attempts_email_created" ON "login_attempts"  ("email", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "organizations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(160) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_identities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "provider" character varying(32) NOT NULL, "provider_user_id" character varying(255) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e23bff04e9c3e7b785e442b262c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_identities_user" ON "user_identities"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_user_identities_provider_subject" ON "user_identities"  ("provider", "provider_user_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_role" AS ENUM('SUPER_ADMIN', 'SOPORTE', 'EMPRESA', 'CLIENTE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_status" AS ENUM('ACTIVA', 'SUSPENDIDA')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(254) NOT NULL, "name" character varying(120) NOT NULL, "password_hash" character varying, "email_verified_at" TIMESTAMP WITH TIME ZONE, "role" "public"."user_role" NOT NULL DEFAULT 'CLIENTE', "status" "public"."user_status" NOT NULL DEFAULT 'ACTIVA', "organization_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_users_empresa_has_org" CHECK ("role" <> 'EMPRESA' OR "organization_id" IS NOT NULL), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_email" ON "users"  ("email") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."one_time_token_type" AS ENUM('VERIFY_EMAIL', 'RESET_PASSWORD')`,
    );
    await queryRunner.query(
      `CREATE TABLE "one_time_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "type" "public"."one_time_token_type" NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8e470cc9ffc1b2afa054304db17" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_one_time_tokens_user" ON "one_time_tokens"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_one_time_tokens_hash" ON "one_time_tokens"  ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "family_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "replaced_by_id" uuid, "user_agent" character varying(512), "ip" character varying(64), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_user" ON "refresh_tokens"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_refresh_tokens_hash" ON "refresh_tokens"  ("token_hash") `,
    );
    await queryRunner.query(
      `ALTER TABLE "user_identities" ADD CONSTRAINT "FK_bf5fe01eb8cad7114b4c371cdc7" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_21a659804ed7bf61eb91688dea7" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "one_time_tokens" ADD CONSTRAINT "FK_0dc2deee64e514ad6f7e69504e1" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "one_time_tokens" DROP CONSTRAINT "FK_0dc2deee64e514ad6f7e69504e1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_21a659804ed7bf61eb91688dea7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_identities" DROP CONSTRAINT "FK_bf5fe01eb8cad7114b4c371cdc7"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_refresh_tokens_hash"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_refresh_tokens_user"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_one_time_tokens_hash"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_one_time_tokens_user"`);
    await queryRunner.query(`DROP TABLE "one_time_tokens"`);
    await queryRunner.query(`DROP TYPE "public"."one_time_token_type"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_users_email"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."user_status"`);
    await queryRunner.query(`DROP TYPE "public"."user_role"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_user_identities_provider_subject"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_user_identities_user"`);
    await queryRunner.query(`DROP TABLE "user_identities"`);
    await queryRunner.query(`DROP TABLE "organizations"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_login_attempts_email_created"`,
    );
    await queryRunner.query(`DROP TABLE "login_attempts"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_target"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TYPE "public"."audit_action"`);
  }
}
