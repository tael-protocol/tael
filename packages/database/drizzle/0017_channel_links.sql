CREATE TABLE "channel_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"agent_id" uuid,
	"channel" text NOT NULL,
	"external_user_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_links" ADD CONSTRAINT "channel_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "channel_links" ADD CONSTRAINT "channel_links_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "channel_links" ADD CONSTRAINT "channel_links_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "channel_links_channel_ext_product_uidx" ON "channel_links" USING btree ("channel","external_user_id","product_id");
--> statement-breakpoint
CREATE INDEX "channel_links_user_id_idx" ON "channel_links" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "channel_links_product_id_idx" ON "channel_links" USING btree ("product_id");
