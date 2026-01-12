-- CreateTable
CREATE TABLE "PreCertificationQuestion" (
    "id" SERIAL NOT NULL,
    "courseId" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "fieldPlaceholder" TEXT,
    "fieldRequired" BOOLEAN NOT NULL DEFAULT true,
    "fieldPattern" TEXT,
    "fieldMinLength" INTEGER,
    "fieldMaxLength" INTEGER,
    "fieldDropdownOptions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreCertificationQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreCertificationAnswer" (
    "id" SERIAL NOT NULL,
    "questionId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreCertificationAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PreCertificationAnswer_userId_questionId_key" ON "PreCertificationAnswer"("userId", "questionId");

-- AddForeignKey
ALTER TABLE "PreCertificationQuestion" ADD CONSTRAINT "PreCertificationQuestion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCertificationAnswer" ADD CONSTRAINT "PreCertificationAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCertificationAnswer" ADD CONSTRAINT "PreCertificationAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "PreCertificationQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
