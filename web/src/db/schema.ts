/**
 * Postgres schema for the parish editor (admin.<domain>) and the public data
 * it publishes. Spec: specs/features/editor/admin-editor.md.
 *
 * Auth tables follow Better Auth's expected shape (user/session/account/
 * verification); parish-specific user fields live on `user` as extra columns.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  time,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const created = () => ts("created_at").notNull().defaultNow();
const updated = () => ts("updated_at").notNull().defaultNow();

// ── Auth (Better Auth) ──────────────────────────────────────────────────────
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: created(),
  updatedAt: updated(),
  // parish fields
  title: text("title").notNull().default("Sodelavec"), // "Župnik", "Tajnica", …
  short: text("short").notNull().default(""), // avatar initials, "BJ"
  isOwner: boolean("is_owner").notNull().default(false),
  requiresApproval: boolean("requires_approval").notNull().default(true),
  bigText: boolean("big_text").notNull().default(false),
  invitedAt: ts("invited_at"),
  disabledAt: ts("disabled_at"),
  lastSeenAt: ts("last_seen_at"),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: ts("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: created(),
  updatedAt: updated(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: ts("access_token_expires_at"),
  refreshTokenExpiresAt: ts("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: created(),
  updatedAt: updated(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: created(),
  updatedAt: updated(),
});

// ── Access ──────────────────────────────────────────────────────────────────
export const sectionEnum = pgEnum("section", ["mase", "oznanila", "dogodki", "verouk"]);

export const userSections = pgTable(
  "user_sections",
  {
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    section: sectionEnum("section").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.section] })],
);

// ── Churches and Masses ─────────────────────────────────────────────────────
export const churches = pgTable("churches", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  position: integer("position").notNull().default(0),
});

export const massTypeEnum = pgEnum("mass_type", ["regular", "sunday", "family", "children", "youth", "evening"]);

/** Regular weekly schedule. weekdays: 0 = Sunday … 6 = Saturday. */
export const massScheduleEntries = pgTable("mass_schedule_entries", {
  id: serial("id").primaryKey(),
  weekdays: integer("weekdays").array().notNull(),
  time: time("time").notNull(),
  churchId: integer("church_id").notNull().references(() => churches.id),
  type: massTypeEnum("type").notNull().default("regular"),
  note: text("note"),
  validFrom: date("valid_from"),
  validUntil: date("valid_until"),
});

/** A day where the regular schedule does not apply (feasts, priest away …). */
export const massDayOverrides = pgTable("mass_day_overrides", {
  date: date("date").primaryKey(),
  replacesSchedule: boolean("replaces_schedule").notNull().default(true),
  label: text("label"),
});

export const massStatusEnum = pgEnum("mass_status", ["scheduled", "cancelled"]);

export const masses = pgTable(
  "masses",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    time: time("time").notNull(),
    churchId: integer("church_id").notNull().references(() => churches.id),
    type: massTypeEnum("type").notNull().default("regular"),
    status: massStatusEnum("status").notNull().default("scheduled"),
    cancelReason: text("cancel_reason"),
    note: text("note"),
    /** "schedule" rows may be regenerated while never edited; "manual" never. */
    source: text("source").notNull().default("schedule"),
    editedAt: ts("edited_at"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("masses_date_time_church").on(t.date, t.time, t.churchId), index("masses_date").on(t.date)],
);

export const intentionKindEnum = pgEnum("intention_kind", ["deceased", "thanksgiving", "other"]);

export const intentions = pgTable(
  "intentions",
  {
    id: serial("id").primaryKey(),
    massId: integer("mass_id").notNull().references(() => masses.id, { onDelete: "cascade" }),
    kind: intentionKindEnum("kind").notNull().default("deceased"),
    text: text("text").notNull(),
    position: integer("position").notNull().default(0),
    movedFromMassId: integer("moved_from_mass_id").references(() => masses.id, { onDelete: "set null" }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("intentions_mass").on(t.massId)],
);

// ── Events ──────────────────────────────────────────────────────────────────
export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    date: date("date").notNull(),
    time: time("time").notNull(),
    place: text("place").notNull(),
    description: text("description").notNull().default(""),
    onFrontPage: boolean("on_front_page").notNull().default(false),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("events_date").on(t.date)],
);

// ── Verouk ──────────────────────────────────────────────────────────────────
export const catechesisGroups = pgTable("catechesis_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // "4.–6. razred"
  weekday: integer("weekday").notNull(), // 0 = Sunday
  time: time("time").notNull(),
  place: text("place").notNull(),
  kids: integer("kids").notNull().default(0),
  position: integer("position").notNull().default(0),
});

export const catechesisCancellations = pgTable(
  "catechesis_cancellations",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id").notNull().references(() => catechesisGroups.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    message: text("message").notNull().default(""),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("catechesis_cancellation_group_date").on(t.groupId, t.date)],
);

// ── Uploads and bulletins ───────────────────────────────────────────────────
export const uploads = pgTable("uploads", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  path: text("path").notNull(), // relative to UPLOAD_DIR
  sha256: text("sha256").notNull(),
  uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: created(),
});

export const bulletinStatusEnum = pgEnum("bulletin_status", [
  "reading",
  "draft",
  "unreadable",
  "ai_busy",
  "pending",
  "published",
]);

export const bulletins = pgTable("bulletins", {
  id: serial("id").primaryKey(),
  weekStart: date("week_start").notNull().unique(), // a Monday
  status: bulletinStatusEnum("status").notNull(),
  uploadId: integer("upload_id").references(() => uploads.id, { onDelete: "set null" }),
  /** BulletinDraft (src/lib/bulletin/types.ts) while reading/draft/pending. */
  draft: jsonb("draft"),
  error: text("error"),
  publishedAt: ts("published_at"),
  publishedBy: text("published_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: created(),
  updatedAt: updated(),
});

export const bulletinNotices = pgTable("bulletin_notices", {
  id: serial("id").primaryKey(),
  bulletinId: integer("bulletin_id").notNull().references(() => bulletins.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  text: text("text").notNull(),
});

// ── Change requests and history ─────────────────────────────────────────────
export const changeStatusEnum = pgEnum("change_status", ["pending", "approved", "rejected"]);

/** A helper's change waiting for the owner. `action` names an engine action. */
export const changeRequests = pgTable(
  "change_requests",
  {
    id: serial("id").primaryKey(),
    section: sectionEnum("section").notNull(),
    action: text("action").notNull(),
    payload: jsonb("payload").notNull(),
    label: text("label").notNull(),
    status: changeStatusEnum("status").notNull().default("pending"),
    createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "cascade" }),
    decidedBy: text("decided_by").references(() => user.id, { onDelete: "set null" }),
    decidedAt: ts("decided_at"),
    error: text("error"),
    createdAt: created(),
  },
  (t) => [index("change_requests_status").on(t.status)],
);

/** One row per applied change. `changes` is RowChange[] (src/lib/admin/engine.ts). */
export const history = pgTable(
  "history",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    section: text("section").notNull(), // a Section or "ljudje"
    action: text("action").notNull(),
    label: text("label").notNull(),
    note: text("note"),
    changes: jsonb("changes").notNull(),
    undoneAt: ts("undone_at"),
    createdAt: ts("created_at").notNull().default(sql`now()`),
  },
  (t) => [index("history_created").on(t.createdAt)],
);
