import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@zephyr-nexus/db";
import { notifications } from "@zephyr-nexus/db";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export default function createNotificationsRouter(db: Db) {
  const router = Router();

  router.get("/companies/:companyId/notifications", async (req, res) => {
    const companyId = req.params.companyId as string;
    try {
      assertCompanyAccess(req, companyId);
    } catch {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const actor = getActorInfo(req);
    const userId = actor.actorId; // might be clerk user id or "local-board"
    if (!userId) {
      res.json([]);
      return;
    }

    const rows = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.companyId, companyId), eq(notifications.userId, userId)))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    res.json(rows);
  });

  router.post("/notifications/:id/read", async (req, res) => {
    const id = req.params.id as string;
    const actor = getActorInfo(req);
    const userId = actor.actorId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const updated = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning()
      .then(rows => rows[0] ?? null);

    if (!updated) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    res.json(updated);
  });

  return router;
}
