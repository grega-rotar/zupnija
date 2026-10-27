/** The upload flow's view of a bulletin (serialisable, shared by the page and the actions). */
import "server-only";
import type { BulletinView } from "@/lib/bulletin/service";
import type { BulletinStatus, ReadableDraft } from "@/lib/bulletin/types";

export type FlowBulletin = {
  id: number;
  weekStart: string;
  status: BulletinStatus;
  error: string | null;
  upload: { id: number; filename: string; mime: string; size: number } | null;
  draft: ReadableDraft | null;
};

export function toFlow(b: BulletinView): FlowBulletin {
  return { id: b.id, weekStart: b.weekStart, status: b.status, error: b.error, upload: b.upload, draft: b.readableDraft };
}
