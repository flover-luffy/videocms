-- 添加安全功能相关的表和字段

-- 1. 为 User 表添加 tokenInvalidatedAt 字段
ALTER TABLE "User" ADD COLUMN "tokenInvalidatedAt" TIMESTAMP(3);

-- 2. 创建 TokenBlacklist 表
CREATE TABLE "TokenBlacklist" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenBlacklist_pkey" PRIMARY KEY ("id")
);

-- 3. 创建 PasswordResetToken 表
CREATE TABLE "PasswordResetToken" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- 4. 创建唯一索引
CREATE UNIQUE INDEX "TokenBlacklist_token_key" ON "TokenBlacklist"("token");
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- 5. 创建普通索引
CREATE INDEX "TokenBlacklist_expiresAt_idx" ON "TokenBlacklist"("expiresAt");
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- 6. 添加外键约束
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
