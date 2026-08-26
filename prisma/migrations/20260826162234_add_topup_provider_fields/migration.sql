-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "topupProvider" TEXT,
ADD COLUMN     "topupProviderRef" TEXT,
ADD COLUMN     "topupStatus" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_topupProviderRef_key" ON "Order"("topupProviderRef");
