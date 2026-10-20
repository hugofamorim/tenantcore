-- CreateEnum
CREATE TYPE "EmailActionPurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

-- CreateTable
CREATE TABLE "EmailAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "EmailActionPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailAction_tokenHash_key" ON "EmailAction"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailAction_userId_purpose_createdAt_idx" ON "EmailAction"("userId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "EmailAction_expiresAt_idx" ON "EmailAction"("expiresAt");

-- AddForeignKey
ALTER TABLE "EmailAction" ADD CONSTRAINT "EmailAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
