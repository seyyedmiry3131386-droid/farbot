import { relations } from 'drizzle-orm';
import { bigint, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  role: text('role').default('admin').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  reportId: text('report_id').notNull().unique(),
  userUid: text('user_uid'),
  title: text('title').notNull(),
  text: text('text').notNull(),
  status: text('status').default('جدید').notNull(),
  qualityGrade: text('quality_grade').default('خوب').notNull(),
  quantityNote: text('quantity_note').default('کامل').notNull(),
  newsDomain: jsonb('news_domain').$type<string[]>().default([]).notNull(),
  reporter: jsonb('reporter').$type<Record<string, any>>().default({}).notNull(),
  answers: jsonb('answers').$type<Record<string, any>>().default({}).notNull(),
  extra: jsonb('extra').$type<Record<string, any>>().default({}).notNull(),
  analysis: jsonb('analysis').$type<Record<string, any>>().default({}).notNull(),
  files: jsonb('files').$type<Array<Record<string, any>>>().default([]).notNull(),
  interview: jsonb('interview').$type<Record<string, any>>().default({}).notNull(),
  createdTimestamp: bigint('created_timestamp', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  reports: many(reports),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  author: one(users, {
    fields: [reports.userUid],
    references: [users.uid],
  }),
}));
