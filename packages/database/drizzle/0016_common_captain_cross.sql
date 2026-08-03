CREATE TYPE "public"."product_action_kind" AS ENUM('capability', 'http');--> statement-breakpoint
CREATE TYPE "public"."product_content_type" AS ENUM('doc', 'snippet', 'website', 'faq');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'live');--> statement-breakpoint
CREATE TABLE "product_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"kind" "product_action_kind" NOT NULL,
	"config" jsonb NOT NULL,
	"share_as_capability" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"type" "product_content_type" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"source_url" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"logo_url" text,
	"brand_color" text DEFAULT '#156DFC' NOT NULL,
	"greeting" text DEFAULT '' NOT NULL,
	"public_key" text NOT NULL,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_public_key_unique" UNIQUE("public_key")
);
--> statement-breakpoint
ALTER TABLE "product_actions" ADD CONSTRAINT "product_actions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_content" ADD CONSTRAINT "product_content_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_actions_product_id_idx" ON "product_actions" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_content_product_id_idx" ON "product_content" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_owner_id_idx" ON "products" USING btree ("owner_id");