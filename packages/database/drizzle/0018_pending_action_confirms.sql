CREATE TABLE "pending_action_confirms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"product_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"external_user_id" text,
	"params" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pending_action_confirms" ADD CONSTRAINT "pending_action_confirms_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pending_action_confirms" ADD CONSTRAINT "pending_action_confirms_action_id_product_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."product_actions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "pending_action_confirms_token_uidx" ON "pending_action_confirms" USING btree ("token");
--> statement-breakpoint
CREATE INDEX "pending_action_confirms_product_id_idx" ON "pending_action_confirms" USING btree ("product_id");
--> statement-breakpoint
CREATE INDEX "pending_action_confirms_expires_at_idx" ON "pending_action_confirms" USING btree ("expires_at");
