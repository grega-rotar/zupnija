import { contentStore } from "@/lib/content/read";
import { oldSacramentPath } from "@/lib/sacraments/tabs";

/**
 * The sacrament subpages and the enquiry form are gone (ZUP-11): every old
 * /zakramenti/<slug> moves permanently (301) to its tab, e.g.
 * /zakramenti/pogreb → /zakramenti#pogreb, so links and search results keep
 * working. A slug renamed in the editor is found by its old document's kind;
 * anything else (/zakramenti/povprasevanje too) goes to /zakramenti.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = (await contentStore()).rows.find((r) => r.type === "sacrament" && r.data.slug?.current === slug)?.data;
  // A relative Location keeps the visitor's host (behind Traefik the request URL is the container's).
  return new Response(null, { status: 301, headers: { Location: oldSacramentPath(slug, doc?.kind) } });
}
