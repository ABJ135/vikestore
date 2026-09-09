@"
ALTER TABLE "Admin" ADD COLUMN "notifyLowStock" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Admin" ADD COLUMN "notifyNewOrder" BOOLEAN NOT NULL DEFAULT true;
"@ | Out-File -Encoding utf8 prisma\migrations\20260910000000_add_admin_notification_fields\migration.sql