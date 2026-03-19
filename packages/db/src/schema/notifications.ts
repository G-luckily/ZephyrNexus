import {
  type AnyPgColumn,
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    userId: text("user_id").notNull(), // using text since user id might come from clerk or local
    title: text("title").notNull(),
    body: text("body").notNull(),
    type: text("type").notNull(),
    relatedIssueId: uuid("related_issue_id").references((): AnyPgColumn => issues.id),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userCompanyIdx: index("notifications_user_company_idx").on(table.userId, table.companyId),
    unreadIdx: index("notifications_unread_idx").on(table.userId, table.companyId, table.readAt),
  })
);
