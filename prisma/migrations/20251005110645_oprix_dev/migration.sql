/*
  Warnings:

  - You are about to drop the column `firstBloodAt` on the `Challenge` table. All the data in the column will be lost.
  - You are about to drop the column `firstBloodUserId` on the `Challenge` table. All the data in the column will be lost.
  - You are about to drop the column `isFirstBlood` on the `Score` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Challenge" DROP CONSTRAINT "Challenge_firstBloodUserId_fkey";

-- AlterTable
ALTER TABLE "Challenge" DROP COLUMN "firstBloodAt",
DROP COLUMN "firstBloodUserId";

-- AlterTable
ALTER TABLE "Score" DROP COLUMN "isFirstBlood";
