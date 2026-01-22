-- CreateIndex
CREATE INDEX "UserCourses_userId_idx" ON "UserCourses"("userId");

-- CreateIndex
CREATE INDEX "UserLessonProgress_userId_idx" ON "UserLessonProgress"("userId");

-- CreateIndex
CREATE INDEX "UserQuizProgress_userId_idx" ON "UserQuizProgress"("userId");
