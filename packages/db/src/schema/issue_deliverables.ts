import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";
import { agents } from "./agents.js";

export const issueDeliverables = pgTable(
  "issue_deliverables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    kind: text("kind").notNull().default("file"), // file, link, note, summary
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    producerId: uuid("producer_id").references(() => agents.id, { onDelete: "set null" }), // Optional, the agent that produced this
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIssueIdx: index("issue_deliverables_company_issue_idx").on(table.companyId, table.issueId),
  }),
);
