import type { Prisma, PrismaClient } from "@prisma/client";

type BuildingDb = Prisma.TransactionClient | PrismaClient;

export function getOwnedBuildingsForProduction(db: BuildingDb, userId: string) {
  return db.userBuilding.findMany({
    where: {
      userId,
      amount: {
        gt: 0,
      },
    },
    orderBy: {
      purchasedAt: "asc",
    },
    include: {
      building: {
        include: {
          reqInput: {
            include: {
              material: true,
            },
          },
          recOutput: true,
        },
      },
    },
  });
}

export function setBuildingAutoRoute(
  db: BuildingDb,
  userId: string,
  userBuildingId: string,
  enabled: boolean,
) {
  return db.userBuilding.updateMany({
    where: {
      id: userBuildingId,
      userId,
    },
    data: {
      autoRouteEnabled: enabled,
    },
  });
}

export function getAutoRouteState(db: BuildingDb, userId: string) {
  return db.userBuilding.findMany({
    where: {
      userId,
    },
    select: {
      buildingId: true,
      autoRouteEnabled: true,
    },
  });
}
