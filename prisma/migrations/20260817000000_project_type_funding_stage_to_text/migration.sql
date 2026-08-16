-- AlterTable: convert projectType and fundingStage from enums to free-form text,
-- matching how `category` already works. Uses ALTER COLUMN ... USING to preserve
-- existing values instead of dropping/recreating the columns.

ALTER TABLE "Project" ALTER COLUMN "projectType" DROP DEFAULT;
ALTER TABLE "Project" ALTER COLUMN "projectType" TYPE TEXT USING "projectType"::TEXT;
ALTER TABLE "Project" ALTER COLUMN "projectType" SET DEFAULT 'other';

ALTER TABLE "Project" ALTER COLUMN "fundingStage" DROP DEFAULT;
ALTER TABLE "Project" ALTER COLUMN "fundingStage" TYPE TEXT USING "fundingStage"::TEXT;
ALTER TABLE "Project" ALTER COLUMN "fundingStage" SET DEFAULT 'bootstrapping';
