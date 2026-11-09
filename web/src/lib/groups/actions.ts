"use server";

/** The server action behind the prayer-request form on a group's page (ZUP-25). */
import type { FormResult } from "@/lib/forms/public";
import { submitPrayerRequest } from "./prayerRequest";

export async function prayerRequestAction(_prev: FormResult | null, fd: FormData): Promise<FormResult> {
  return submitPrayerRequest(fd);
}
