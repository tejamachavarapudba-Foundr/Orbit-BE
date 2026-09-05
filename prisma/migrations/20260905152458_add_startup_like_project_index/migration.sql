-- StartupLike: every project list/detail view counts likes via
-- _count: { likedBy: true } (projects.service.ts), a projectId-only lookup
-- that the existing userId_projectId compound index (userId leading)
-- doesn't serve well.
CREATE INDEX "StartupLike_projectId_idx" ON "StartupLike"("projectId");
