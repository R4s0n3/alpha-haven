import type { PrismaClient } from "@prisma/client";

import { syncBuildingProductionForUser } from "@/server/buildingProduction";
import { ensurePlayerState } from "@/server/gameContent";
import { syncPassiveRhoonsForUser } from "@/server/passiveRhoons";

export async function syncPlayerGameState(
  db: PrismaClient,
  userId: string,
  now = new Date(),
) {
  await ensurePlayerState(db, userId);

  const rhoonsCollected = await syncPassiveRhoonsForUser(db, userId, now);
  const production = await syncBuildingProductionForUser(db, userId, now);

  return {
    now,
    rhoonsCollected,
    production,
  };
}
