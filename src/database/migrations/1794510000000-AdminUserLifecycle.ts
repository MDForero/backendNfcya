import { MigrationInterface, QueryRunner } from 'typeorm';

/** Auditoría de alta de administradores y borrado de usuarios. */
export class AdminUserLifecycle1794510000000 implements MigrationInterface {
  name = 'AdminUserLifecycle1794510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'USER_CREATED'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'USER_DELETED'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL no permite quitar valores de un enum: se recrea sin ellos.
    await queryRunner.query(
      `DELETE FROM "audit_logs" WHERE "action" IN ('USER_CREATED', 'USER_DELETED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_action_old" AS ENUM('ROLE_CHANGED', 'ORGANIZATION_CHANGED', 'USER_SUSPENDED', 'USER_REACTIVATED', 'PROFILE_SUSPENDED', 'PROFILE_REACTIVATED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ALTER COLUMN "action" TYPE "public"."audit_action_old" USING "action"::"text"::"public"."audit_action_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."audit_action"`);
    await queryRunner.query(
      `ALTER TYPE "public"."audit_action_old" RENAME TO "audit_action"`,
    );
  }
}
