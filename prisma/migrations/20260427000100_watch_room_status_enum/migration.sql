CREATE TYPE "WatchRoomStatus" AS ENUM ('waiting', 'playing', 'paused', 'closed');

ALTER TABLE "WatchRoom"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "WatchRoomStatus" USING "status"::"WatchRoomStatus",
  ALTER COLUMN "status" SET DEFAULT 'waiting';
