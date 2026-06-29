-- CreateIndex
CREATE UNIQUE INDEX "PerformanceEntry_sessionId_exerciseId_setNumber_key" ON "PerformanceEntry"("sessionId", "exerciseId", "setNumber");
