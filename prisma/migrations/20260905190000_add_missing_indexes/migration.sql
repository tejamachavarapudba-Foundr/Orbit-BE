-- Performance audit: indexes on fields used for filter/sort/join/auth that
-- were missing (see schema.prisma comments at each model for the specific
-- query each one serves).

CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_isBanned_idx" ON "User"("isBanned");
CREATE INDEX "User_isOrbitOwned_idx" ON "User"("isOrbitOwned");

CREATE INDEX "Project_name_idx" ON "Project"("name");

CREATE INDEX "SavedStartup_projectId_idx" ON "SavedStartup"("projectId");
CREATE INDEX "StartupView_projectId_idx" ON "StartupView"("projectId");

CREATE INDEX "Conversation_userAId_idx" ON "Conversation"("userAId");
CREATE INDEX "Conversation_userBId_idx" ON "Conversation"("userBId");

CREATE INDEX "Event_isPrivate_createdAt_idx" ON "Event"("isPrivate", "createdAt");

CREATE INDEX "JobApplication_applicantId_idx" ON "JobApplication"("applicantId");
