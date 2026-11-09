-- Groups (ZUP-13, ZUP-23, ZUP-25): the 16 groups in the agreed order, each with its icon; nine new
-- groups whose pages say "vsebina" until the parish priest sends their text (ZUP-22); the Verouk card
-- leads to /verouk; ŽPS without "Pridružite se" (its sessions under "Seje"); the prayer-request form on
-- the prayer group's page. Data only, no schema change.
--
-- Runs only on a database whose content is already imported (it has groups). On an empty database
-- the container's `import-sanity-content --if-empty` must still see an empty `content` table, so
-- nothing is inserted there; the editor adds groups by hand in that case.
-- updated_at moves, so a later import treats these rows as edited in the editor and keeps them.
UPDATE "content" SET
  "data" = "data" || jsonb_build_object('order', v.ord, 'icon', v.icon) || v.extra,
  "sort" = v.ord,
  "updated_at" = now()
FROM (VALUES
  ('zupnijski-pastoralni-svet', 1, 'zupnijski-pastoralni-svet', '{"hideJoin": true, "meetingsTitle": "Seje"}'::jsonb),
  ('zupnijska-karitas', 2, 'zupnijska-karitas', '{}'::jsonb),
  ('molitvena-skupina', 3, 'molitvena-skupina', '{"prayerRequests": true, "prayerIntro": "vsebina", "prayerEmail": "zupirnice@gmail.com"}'::jsonb),
  ('prva-zakonska-skupina', 4, 'zakonska-skupina', '{}'::jsonb),
  ('druga-zakonska-skupina', 5, 'zakonska-skupina', '{}'::jsonb),
  ('mladinska-skupina', 6, 'mladinska-skupina', '{}'::jsonb),
  ('odrasli-pevski-zbor', 12, 'odrasli-pevski-zbor', '{}'::jsonb)
) AS v(slug, ord, icon, extra)
WHERE "content"."type" = 'parishGroup' AND "content"."slug" = v.slug;
--> statement-breakpoint
INSERT INTO "content" ("id", "type", "slug", "data", "published", "sort", "created_at", "updated_at")
SELECT
  'group-' || v.slug,
  'parishGroup',
  v.slug,
  jsonb_build_object(
    '_id', 'group-' || v.slug,
    '_type', 'parishGroup',
    'title', v.title,
    'slug', jsonb_build_object('_type', 'slug', 'current', v.slug),
    'icon', v.icon,
    'order', v.ord
  ) || CASE WHEN v.href IS NULL THEN jsonb_build_object('description', jsonb_build_array(jsonb_build_object(
    '_key', 'vsebina',
    '_type', 'block',
    'style', 'normal',
    'markDefs', '[]'::jsonb,
    'children', jsonb_build_array(jsonb_build_object('_key', 'vsebina0', '_type', 'span', 'marks', '[]'::jsonb, 'text', 'vsebina'))
  ))) ELSE jsonb_build_object('href', v.href) END,
  true,
  v.ord,
  now(),
  now() + interval '1 millisecond'
FROM (VALUES
  ('ministranti', 'Ministranti', 7, 'ministranti', NULL),
  ('bralci-bozje-besede', 'Bralci Božje besede', 8, 'bralci-bozje-besede', NULL),
  ('pritrkovalci', 'Pritrkovalci', 9, 'pritrkovalci', NULL),
  ('mladinski-pevski-zbor', 'Mladinski pevski zbor', 10, 'mladinski-pevski-zbor', NULL),
  ('otroski-pevski-zbor', 'Otroški pevski zbor', 11, 'otroski-pevski-zbor', NULL),
  ('krasilci', 'Krasilci', 13, 'krasilci', NULL),
  ('oratorijski-animatorji', 'Oratorijski animatorji', 14, 'oratorijski-animatorji', NULL),
  ('verouk', 'Verouk', 15, 'verouk', '/verouk'),
  ('oratorij', 'Oratorij', 16, 'oratorij', NULL)
) AS v(slug, title, ord, icon, href)
WHERE EXISTS (SELECT 1 FROM "content" WHERE "type" = 'parishGroup')
  AND NOT EXISTS (SELECT 1 FROM "content" c WHERE c."type" = 'parishGroup' AND c."slug" = v.slug)
ON CONFLICT ("id") DO NOTHING;
