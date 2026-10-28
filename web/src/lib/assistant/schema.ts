/**
 * The assistant's reply: {reply, proposals[]}. The model's output is parsed
 * with these schemas; the client's confirm call is parsed with them again,
 * because a proposal coming back from the browser is untrusted.
 */
import { z } from "zod";
import { SECTIONS } from "@/lib/admin/sections";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}$/);
const optText = z.string().trim().max(500).optional();
const sections = z.array(z.enum(SECTIONS)).max(SECTIONS.length);

export const proposalSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("add_intention"),
    massId: z.number().int(),
    text: z.string().trim().min(1).max(200),
    kind: z.enum(["deceased", "thanksgiving", "other"]),
    /** true when the person did not say what kind of intention it is. */
    kindIsGuess: z.boolean().default(false),
  }),
  z.object({ type: z.literal("remove_intention"), intentionId: z.number().int() }),
  z.object({ type: z.literal("cancel_mass"), massId: z.number().int(), reason: optText }),
  z.object({ type: z.literal("restore_mass"), massId: z.number().int() }),
  z.object({ type: z.literal("cancel_lesson"), groupId: z.number().int(), date, message: optText }),
  z.object({ type: z.literal("restore_lesson"), groupId: z.number().int(), date }),
  z.object({
    type: z.literal("event"),
    title: z.string().trim().min(1).max(200),
    date,
    time,
    place: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
  }),
  /** Only the fields that change; the rest is kept from the event as it is when confirming. */
  z.object({
    type: z.literal("edit_event"),
    id: z.number().int(),
    title: z.string().trim().min(1).max(200).optional(),
    date: date.optional(),
    time: time.optional(),
    place: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
  }),
  z.object({ type: z.literal("delete_event"), id: z.number().int() }),
  z.object({ type: z.literal("open_upload") }),
  z.object({
    type: z.literal("invite_person"),
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().max(200),
    title: z.string().trim().max(60).optional(),
    sections,
    requiresApproval: z.boolean().default(true),
  }),
  z.object({ type: z.literal("update_access"), userId: z.string().min(1).max(100), sections, requiresApproval: z.boolean() }),
  z.object({ type: z.literal("approve_change"), changeRequestId: z.number().int() }),
  z.object({ type: z.literal("reject_change"), changeRequestId: z.number().int() }),
]);
export type Proposal = z.output<typeof proposalSchema>;

/** The strict reply shape (documented in the prompt). */
export const replySchema = z.object({ reply: z.string(), proposals: z.array(proposalSchema) });
export type AssistantReply = z.output<typeof replySchema>;

/** What ask.ts parses: one bad proposal drops that proposal, not the whole reply. */
export const looseReplySchema = z.object({
  reply: z.string().trim().min(1),
  proposals: z.array(z.unknown()).default([]),
});

export const messageSchema = z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) });
export type AssistantMessage = z.output<typeof messageSchema>;
export const messagesSchema = z.array(messageSchema).min(1).max(60);
