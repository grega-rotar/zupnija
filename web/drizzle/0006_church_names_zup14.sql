-- ZUP-15: one name per church wherever the site shows it (cards, church
-- pages, Mass schedules). The display name is `shortName` in the content
-- documents and `short_name` in the churches table; the formal `name` stays.
-- Only the names as imported are changed, never one the editor has changed.
UPDATE "content" SET "data" = jsonb_set("data", '{shortName}', '"Cerkev Marije Vnebovzete"'), "updated_at" = now()
  WHERE "id" = 'church-marijino-vnebovzetje' AND "data"->>'shortName' = 'Marijina cerkev';--> statement-breakpoint
UPDATE "content" SET "data" = jsonb_set("data", '{shortName}', '"Cerkev sv. Križa"'), "updated_at" = now()
  WHERE "id" = 'church-sv-kriz' AND "data"->>'shortName' = 'Sv. Križ';--> statement-breakpoint
UPDATE "content" SET "data" = jsonb_set("data", '{shortName}', '"Cerkev sv. Tomaža"'), "updated_at" = now()
  WHERE "id" = 'church-sv-tomaz' AND "data"->>'shortName' = 'Sv. Tomaž';--> statement-breakpoint
UPDATE "churches" SET "short_name" = 'Cerkev Marije Vnebovzete' WHERE "slug" = 'marijino-vnebovzetje' AND "short_name" = 'Marijina cerkev';--> statement-breakpoint
UPDATE "churches" SET "short_name" = 'Cerkev sv. Križa' WHERE "slug" = 'sv-kriz' AND "short_name" = 'Sv. Križ';--> statement-breakpoint
UPDATE "churches" SET "short_name" = 'Cerkev sv. Tomaža' WHERE "slug" = 'sv-tomaz' AND "short_name" = 'Sv. Tomaž';
