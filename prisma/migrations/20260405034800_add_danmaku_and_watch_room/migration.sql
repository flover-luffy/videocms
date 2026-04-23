-- CreateTable: Danmaku（弹幕）
CREATE TABLE "Danmaku" (
    "id" SERIAL NOT NULL,
    "text" VARCHAR(200) NOT NULL,
    "time" DOUBLE PRECISION NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#FFFFFF',
    "type" INTEGER NOT NULL DEFAULT 0,
    "fontSize" INTEGER NOT NULL DEFAULT 25,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "episodeId" INTEGER NOT NULL,
    "userId" INTEGER,

    CONSTRAINT "Danmaku_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WatchRoom（一起看房间）
CREATE TABLE "WatchRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '一起看',
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "currentTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hostId" INTEGER NOT NULL,
    "seriesId" INTEGER NOT NULL,
    "episodeId" INTEGER NOT NULL,

    CONSTRAINT "WatchRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WatchRoomMember（一起看房间成员）
CREATE TABLE "WatchRoomMember" (
    "id" SERIAL NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roomId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "WatchRoomMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Danmaku_episodeId_time_idx" ON "Danmaku"("episodeId", "time");
CREATE INDEX "Danmaku_userId_idx" ON "Danmaku"("userId");

CREATE INDEX "WatchRoom_hostId_idx" ON "WatchRoom"("hostId");
CREATE INDEX "WatchRoom_status_idx" ON "WatchRoom"("status");

CREATE UNIQUE INDEX "WatchRoomMember_roomId_userId_key" ON "WatchRoomMember"("roomId", "userId");
CREATE INDEX "WatchRoomMember_userId_idx" ON "WatchRoomMember"("userId");

-- AddForeignKey
ALTER TABLE "Danmaku" ADD CONSTRAINT "Danmaku_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Danmaku" ADD CONSTRAINT "Danmaku_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WatchRoom" ADD CONSTRAINT "WatchRoom_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchRoom" ADD CONSTRAINT "WatchRoom_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchRoom" ADD CONSTRAINT "WatchRoom_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WatchRoomMember" ADD CONSTRAINT "WatchRoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "WatchRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchRoomMember" ADD CONSTRAINT "WatchRoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
