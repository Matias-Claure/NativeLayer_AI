ALTER TABLE "merchants" ADD COLUMN "shopify_admin_token" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "billing_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "billing_charge_id" text;