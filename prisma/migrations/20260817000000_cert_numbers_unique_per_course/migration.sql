-- DropIndex
DROP INDEX "CertificateNumberAllocation_number_key";

-- DropIndex
DROP INDEX "Certificate_number_key";

-- CreateIndex
CREATE UNIQUE INDEX "CertificateNumberAllocation_courseId_number_key" ON "CertificateNumberAllocation"("courseId", "number");

-- CreateIndex
CREATE INDEX "Certificate_number_idx" ON "Certificate"("number");
