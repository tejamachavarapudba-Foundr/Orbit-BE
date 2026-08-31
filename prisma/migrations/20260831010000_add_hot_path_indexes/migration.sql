-- Profile: main /profiles list sorts by createdAt with no filter; role is
-- used for relational filters (e.g. notifying all investors/advisors).
CREATE INDEX "Profile_createdAt_idx" ON "Profile"("createdAt");
CREATE INDEX "Profile_role_idx" ON "Profile"("role");

-- Project: main /projects list sorts by createdAt with no filter.
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- Job: "my jobs"/"my analytics" filter by posterId and sort by createdAt.
CREATE INDEX "Job_posterId_createdAt_idx" ON "Job"("posterId", "createdAt");

-- Notification: every list is `WHERE userId = ? ORDER BY createdAt DESC` —
-- widen the existing userId-only index to a composite covering the sort too.
DROP INDEX "Notification_userId_idx";
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
