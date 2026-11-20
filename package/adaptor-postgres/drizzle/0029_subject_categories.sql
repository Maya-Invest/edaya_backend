CREATE TABLE "subject_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "subject_categories_school_id_idx" ON "subject_categories" USING btree ("school_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "subject_categories_school_name_uidx" ON "subject_categories" USING btree ("school_id","name");
--> statement-breakpoint
INSERT INTO "subject_categories" ("id", "school_id", "name", "created_at")
SELECT "schools"."id" || ':subject-category:' || defaults.slug,
	"schools"."id",
	defaults.name,
	now()
FROM "schools"
CROSS JOIN (VALUES
	('Scientifique', 'scientifique'),
	('Littéraire', 'litteraire'),
	('Langues', 'langues'),
	('Sciences humaines', 'sciences-humaines'),
	('Sport', 'sport'),
	('Arts', 'arts')
) AS defaults(name, slug);
--> statement-breakpoint
INSERT INTO "subject_categories" ("id", "school_id", "name", "created_at")
SELECT DISTINCT "subjects"."school_id" || ':subject-category:extra:' || md5("subjects"."category"),
	"subjects"."school_id",
	"subjects"."category",
	now()
FROM "subjects"
WHERE NOT EXISTS (
	SELECT 1
	FROM "subject_categories" existing
	WHERE existing."school_id" = "subjects"."school_id"
		AND existing."name" = "subjects"."category"
);
--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "category_id" text;
--> statement-breakpoint
UPDATE "subjects"
SET "category_id" = "subject_categories"."id"
FROM "subject_categories"
WHERE "subject_categories"."school_id" = "subjects"."school_id"
	AND "subject_categories"."name" = "subjects"."category";
--> statement-breakpoint
ALTER TABLE "subjects" ALTER COLUMN "category_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "subjects" DROP COLUMN "category";
--> statement-breakpoint
CREATE INDEX "subjects_category_id_idx" ON "subjects" USING btree ("category_id");
