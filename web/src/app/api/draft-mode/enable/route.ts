import { defineEnableDraftMode } from "next-sanity/draft-mode";
import { client } from "@/sanity/client";
import { readToken } from "@/sanity/token";

/** Called by the Studio's Presentation tool to start a draft preview. */
export const { GET } = defineEnableDraftMode({
  client: client.withConfig({ token: readToken }),
});
