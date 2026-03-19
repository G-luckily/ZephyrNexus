CREATE TABLE "issue_deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"kind" text DEFAULT 'file' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"producer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_deliverables" ADD CONSTRAINT "issue_deliverables_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_deliverables" ADD CONSTRAINT "issue_deliverables_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_deliverables" ADD CONSTRAINT "issue_deliverables_producer_id_agents_id_fk" FOREIGN KEY ("producer_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_deliverables_company_issue_idx" ON "issue_deliverables" USING btree ("company_id","issue_id");