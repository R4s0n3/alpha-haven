import type { PrismaClient } from "@prisma/client";

import { addInventoryAmount } from "@/server/repositories/inventoryRepository";

type PassiveRhoonsBuilding = {
  id: string;
  amount: number;
  level: number;
  lastRhoonsTime: Date;
  building: {
    price: number;
    productionRate: number;
  };
};

export function getPassiveRhoonsPerSecond(
  userBuilding: Pick<PassiveRhoonsBuilding, "amount" | "level" | "building">,
) {
  const baseValue = Math.max(
    1,
    Math.floor(Math.sqrt(Math.max(1, userBuilding.building.price)) / 50),
  );
  const levelMultiplier = 1 + (Math.max(1, userBuilding.level) - 1) * 0.22;

  return Math.max(
    1,
    Math.floor(
      baseValue *
        Math.max(1, userBuilding.amount) *
        levelMultiplier *
        Math.max(1, userBuilding.building.productionRate),
    ),
  );
}

function getRhoonsCycles(userBuilding: PassiveRhoonsBuilding, now: Date) {
  const durationMs = 1000;
  const elapsedMs = Math.max(
    0,
    now.getTime() - userBuilding.lastRhoonsTime.getTime(),
  );

  return {
    cycles: Math.floor(elapsedMs / durationMs),
    durationMs,
  };
}

export async function syncPassiveRhoonsForUser(
  db: PrismaClient,
  userId: string,
  now = new Date(),
) {
  const [rhoonsMaterial, userBuildingRows] = await Promise.all([
    db.material.findFirst({
      where: {
        name: "Rhoons",
      },
      select: {
        id: true,
      },
    }),
    db.userBuilding.findMany({
      where: {
        userId,
        amount: {
          gt: 0,
        },
      },
      select: {
        id: true,
        amount: true,
        level: true,
        lastRhoonsTime: true,
        building: {
          select: {
            price: true,
            productionRate: true,
          },
        },
      },
    }),
  ]);

  if (!rhoonsMaterial) {
    return 0;
  }

  const readyBuildings = userBuildingRows
    .map((userBuilding) => {
      const { cycles, durationMs } = getRhoonsCycles(userBuilding, now);

      return {
        userBuilding,
        cycles,
        durationMs,
        rhoons: getPassiveRhoonsPerSecond(userBuilding) * cycles,
      };
    })
    .filter((entry) => entry.cycles > 0 && entry.rhoons > 0);

  if (readyBuildings.length === 0) {
    return 0;
  }

  const totalRhoons = readyBuildings.reduce(
    (total, entry) => total + entry.rhoons,
    0,
  );

  await db.$transaction(async (tx) => {
    await addInventoryAmount(tx, userId, rhoonsMaterial.id, totalRhoons);

    for (const entry of readyBuildings) {
      const lastRhoonsTime = new Date(
        entry.userBuilding.lastRhoonsTime.getTime() +
          entry.cycles * entry.durationMs,
      );

      await tx.userBuilding.update({
        where: {
          id: entry.userBuilding.id,
        },
        data: {
          lastRhoonsTime,
        },
      });
    }
  });

  return totalRhoons;
}

export async function getPassiveRhoonsPerSecondForUser(
  db: PrismaClient,
  userId: string,
) {
  const userBuildingRows = await db.userBuilding.findMany({
    where: {
      userId,
      amount: {
        gt: 0,
      },
    },
    select: {
      amount: true,
      level: true,
      building: {
        select: {
          price: true,
          productionRate: true,
        },
      },
    },
  });

  return userBuildingRows.reduce(
    (total, row) =>
      total +
      getPassiveRhoonsPerSecond({
        amount: row.amount,
        level: row.level,
        building: row.building,
      }),
    0,
  );
}
