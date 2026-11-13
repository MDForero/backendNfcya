import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProfilesMvp1794247996513 implements MigrationInterface {
  name = 'ProfilesMvp1794247996513';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."link_type" AS ENUM('WEBSITE', 'INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'WHATSAPP', 'YOUTUBE', 'TIKTOK', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "profile_links" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "profile_id" uuid NOT NULL, "label" character varying(60) NOT NULL, "url" character varying(2048) NOT NULL, "type" "public"."link_type" NOT NULL DEFAULT 'OTHER', "sort_order" integer NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c32e8b4c7ed79e0b9c61014f7f6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_profile_links_profile_order" ON "profile_links"  ("profile_id", "sort_order") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."profile_theme" AS ENUM('DEFAULT', 'DARK', 'OCEAN', 'SUNSET', 'FOREST')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."profile_status" AS ENUM('DRAFT', 'PUBLISHED', 'SUSPENDED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "owner_user_id" uuid NOT NULL, "slug" character varying(40) NOT NULL, "display_name" character varying(120) NOT NULL, "headline" character varying(160), "bio" character varying(1000), "avatar_url" character varying(2048), "cover_url" character varying(2048), "phone" character varying(30), "email" character varying(254), "website" character varying(2048), "location_label" character varying(120), "show_email" boolean NOT NULL DEFAULT false, "show_phone" boolean NOT NULL DEFAULT false, "leads_enabled" boolean NOT NULL DEFAULT false, "theme" "public"."profile_theme" NOT NULL DEFAULT 'DEFAULT', "status" "public"."profile_status" NOT NULL DEFAULT 'DRAFT', "published_at" TIMESTAMP WITH TIME ZONE, "suspended_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8e520eb4da7dc01d0e190447c8e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_profiles_owner" ON "profiles"  ("owner_user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_profiles_slug" ON "profiles"  ("slug") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_profiles_status" ON "profiles"  ("status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."lead_source" AS ENUM('PROFILE', 'NFC', 'QR')`,
    );
    await queryRunner.query(
      `CREATE TABLE "leads" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "profile_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "email" character varying(254), "phone" character varying(30), "message" character varying(1000), "consent_accepted" boolean NOT NULL, "source" "public"."lead_source" NOT NULL DEFAULT 'PROFILE', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_leads_contact" CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL), CONSTRAINT "CHK_leads_consent" CHECK ("consent_accepted" = true), CONSTRAINT "PK_cd102ed7a9a4ca7d4d8bfeba406" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_leads_profile_created" ON "leads"  ("profile_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."identifier_kind" AS ENUM('NFC', 'QR')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."identifier_status" AS ENUM('ACTIVE', 'INACTIVE', 'REVOKED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "profile_identifiers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "profile_id" uuid NOT NULL, "kind" "public"."identifier_kind" NOT NULL, "label" character varying(60), "public_code" character varying(32) NOT NULL, "status" "public"."identifier_status" NOT NULL DEFAULT 'ACTIVE', "revoked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3d1faa3cf860c78c94f4e205eee" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_profile_identifiers_profile" ON "profile_identifiers"  ("profile_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_profile_identifiers_code" ON "profile_identifiers"  ("public_code") `,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."audit_action" ADD VALUE 'PROFILE_SUSPENDED'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."audit_action" ADD VALUE 'PROFILE_REACTIVATED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "profile_links" ADD CONSTRAINT "FK_91652eb8aa51ec36557c62bfb2b" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD CONSTRAINT "FK_61b727eb6bc22e4b90dd684028c" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ADD CONSTRAINT "FK_e4e6182b948811885ee2a90d589" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "profile_identifiers" ADD CONSTRAINT "FK_a399da67124b31b137c91416e2f" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profile_identifiers" DROP CONSTRAINT "FK_a399da67124b31b137c91416e2f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leads" DROP CONSTRAINT "FK_e4e6182b948811885ee2a90d589"`,
    );
    await queryRunner.query(
      `ALTER TABLE "profiles" DROP CONSTRAINT "FK_61b727eb6bc22e4b90dd684028c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "profile_links" DROP CONSTRAINT "FK_91652eb8aa51ec36557c62bfb2b"`,
    );
    // Las auditorías de perfiles no caben en el enum anterior.
    await queryRunner.query(
      `DELETE FROM "audit_logs" WHERE "action" IN ('PROFILE_SUSPENDED', 'PROFILE_REACTIVATED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_action_old" AS ENUM('ROLE_CHANGED', 'ORGANIZATION_CHANGED', 'USER_SUSPENDED', 'USER_REACTIVATED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ALTER COLUMN "action" TYPE "public"."audit_action_old" USING "action"::"text"::"public"."audit_action_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."audit_action"`);
    await queryRunner.query(
      `ALTER TYPE "public"."audit_action_old" RENAME TO "audit_action"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_profile_identifiers_code"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_profile_identifiers_profile"`,
    );
    await queryRunner.query(`DROP TABLE "profile_identifiers"`);
    await queryRunner.query(`DROP TYPE "public"."identifier_status"`);
    await queryRunner.query(`DROP TYPE "public"."identifier_kind"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_leads_profile_created"`);
    await queryRunner.query(`DROP TABLE "leads"`);
    await queryRunner.query(`DROP TYPE "public"."lead_source"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_profiles_status"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_profiles_slug"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_profiles_owner"`);
    await queryRunner.query(`DROP TABLE "profiles"`);
    await queryRunner.query(`DROP TYPE "public"."profile_status"`);
    await queryRunner.query(`DROP TYPE "public"."profile_theme"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_profile_links_profile_order"`,
    );
    await queryRunner.query(`DROP TABLE "profile_links"`);
    await queryRunner.query(`DROP TYPE "public"."link_type"`);
  }
}
