import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { UserTradeStatus } from "@/server/dbEnums";
import { syncPlayerGameState } from "@/server/gameEngine";
import { ensurePlayerState } from "@/server/gameContent";
import { getPassiveRhoonsPerSecondForUser } from "@/server/passiveRhoons";

const INVENTORY_MATERIAL_ORDER = [
  "Dust",
  "H3",
  "Concrete",
  "Metal",
  "Zaza",
  "Bloons",
] as const;

export const userRouter = createTRPCRouter({
  getLocations: protectedProcedure.query(async ({ ctx }) => {
    const { session, db } = ctx;
    await ensurePlayerState(db, session.user.id);

    return db.user.findFirst({
      where: {
        id: session.user.id,
      },
      select: {
        locations: true,
      },
    });
  }),

  getInventory: protectedProcedure.query(async ({ ctx }) => {
    const { session, db } = ctx;
    await syncPlayerGameState(db, session.user.id);

    const [user, rhoons, rhoonsPerSecond] = await Promise.all([
      db.user.findFirst({
        where: {
          id: session.user.id,
        },
        include: {
          cargo: {
            where: {
              amount: {
                gt: 0,
              },
              material: {
                name: {
                  not: "Rhoons",
                },
              },
            },
            select: {
              material: true,
              amount: true,
            },
          },
        },
      }),
      db.cargo.findFirst({
        where: {
          userId: session.user.id,
          questId: null,
          rocketId: null,
          material: {
            name: "Rhoons",
          },
        },
        select: {
          material: true,
          amount: true,
        },
      }),
      getPassiveRhoonsPerSecondForUser(db, session.user.id),
    ]);

    return {
      ...user,
      cargo: [...(user?.cargo ?? [])].sort((first, second) => {
        const firstIndex = INVENTORY_MATERIAL_ORDER.indexOf(
          first.material.name as (typeof INVENTORY_MATERIAL_ORDER)[number],
        );
        const secondIndex = INVENTORY_MATERIAL_ORDER.indexOf(
          second.material.name as (typeof INVENTORY_MATERIAL_ORDER)[number],
        );

        return (
          (firstIndex === -1 ? Number.MAX_SAFE_INTEGER : firstIndex) -
            (secondIndex === -1 ? Number.MAX_SAFE_INTEGER : secondIndex) ||
          first.material.name.localeCompare(second.material.name)
        );
      }),
      rhoons,
      rhoonsPerSecond,
    };
  }),

  getBuildings: protectedProcedure.query(async ({ ctx }) => {
    const { session, db } = ctx;
    await ensurePlayerState(db, session.user.id);

    return db.user.findFirst({
      where: {
        id: session.user.id,
      },
      include: {
        ownedBuildings: {
          select: {
            building: true,
          },
        },
      },
    });
  }),

  getOverview: protectedProcedure.query(async ({ ctx }) => {
    const { session, db } = ctx;
    await syncPlayerGameState(db, session.user.id);

    const [user, buildings, rockets, tradeCounts] = await Promise.all([
      db.user.findFirst({
        where: {
          id: session.user.id,
        },
        select: {
          id: true,
          name: true,
          image: true,
          level: true,
          experiencePoints: true,
          cargo: {
            where: {
              amount: {
                gt: 0,
              },
            },
            include: {
              material: true,
            },
            orderBy: {
              amount: "desc",
            },
          },
        },
      }),
      db.userBuilding.findMany({
        where: {
          userId: session.user.id,
        },
        include: {
          building: true,
        },
      }),
      db.userRocket.findMany({
        where: {
          userId: session.user.id,
        },
        include: {
          rocket: true,
        },
      }),
      db.userTrade.groupBy({
        by: ["status"],
        where: {
          userId: session.user.id,
        },
        _count: {
          _all: true,
        },
      }),
    ]);
    const tradeCountByStatus = new Map(
      tradeCounts.map((entry) => [entry.status, entry._count._all]),
    );
    const productionPower = buildings.reduce(
      (total, ownedBuilding) =>
        total +
        ownedBuilding.amount *
          ownedBuilding.level *
          ownedBuilding.building.productionRate,
      0,
    );

    return {
      user,
      buildingCount: buildings.reduce(
        (total, building) => total + building.amount,
        0,
      ),
      buildingTypes: buildings.length,
      rocketCount: rockets.length,
      bestRocketSpeed: rockets.reduce(
        (bestSpeed, ownedRocket) =>
          Math.max(bestSpeed, ownedRocket.rocket.speed),
        0,
      ),
      productionPower,
      activeTrades:
        (tradeCountByStatus.get(UserTradeStatus.LOADING) ?? 0) +
        (tradeCountByStatus.get(UserTradeStatus.READY_TO_LAUNCH) ?? 0) +
        (tradeCountByStatus.get(UserTradeStatus.IN_ROUTE) ?? 0),
      completedTrades: tradeCountByStatus.get(UserTradeStatus.COMPLETED) ?? 0,
      expiredTrades: tradeCountByStatus.get(UserTradeStatus.EXPIRED) ?? 0,
    };
  }),
});
