-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'user');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('movie', 'tv', 'documentary', 'variety');

-- AlterTable
ALTER TABLE "Series" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Series" ALTER COLUMN "type" TYPE "MediaType" USING ("type"::"MediaType");
ALTER TABLE "Series" ALTER COLUMN "type" SET DEFAULT 'tv';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::"Role");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'user';
