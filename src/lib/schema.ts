import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  email: text('email').notNull(),
  role: text('role').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const leads = sqliteTable('leads', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  company: text('company').notNull(),
  source: text('source').notNull(),
  service: text('service').notNull(),
  state: text('state').notNull(),
  lifecycle: text('lifecycle').notNull(),
  urgency: text('urgency').notNull(),
  assigneeUserId: text('assignee_user_id').references(() => users.id),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  receivedAt: text('received_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastContactAt: text('last_contact_at'),
  lastActivityAt: text('last_activity_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  firstResponseDueAt: text('first_response_due_at'),
  inboundPayloadJson: text('inbound_payload_json'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  authorUserId: text('author_user_id').references(() => users.id),
  authorName: text('author_name').notNull(),
  type: text('type').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const communications = sqliteTable('communications', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  channel: text('channel').notNull(),
  direction: text('direction').notNull(),
  actorName: text('actor_name').notNull(),
  subject: text('subject'),
  summary: text('summary').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const activities = sqliteTable('activities', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  type: text('type').notNull(),
  label: text('label').notNull(),
  detail: text('detail').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const inboundEvents = sqliteTable('inbound_events', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  source: text('source').notNull(),
  actionable: integer('actionable', { mode: 'boolean' }).notNull(),
  status: text('status').notNull(),
  leadId: text('lead_id').references(() => leads.id),
  payloadJson: text('payload_json').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const outboundJobs = sqliteTable('outbound_jobs', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  channel: text('channel').notNull(),
  status: text('status').notNull(),
  provider: text('provider').notNull(),
  toAddress: text('to_address').notNull(),
  subject: text('subject'),
  body: text('body').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type LeadRow = typeof leads.$inferSelect;
export type UserRow = typeof users.$inferSelect;
