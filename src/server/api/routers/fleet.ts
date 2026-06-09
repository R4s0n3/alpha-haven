import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { syncPlayerGameState } from "@/server/gameEngine";
import { ensurePlayerState } from "@/server/gameContent";
import {
  MAX_ROCKET_UPGRADE,
  getRocketUpgradeCost,
} from "@/server/gameBalance";

function getRocketStats(
  rocket: {
    speed: number;
    cargoCapacity: number;
    fuelCapacity: number;
  },
  upgrade: number,
) {
  const safeUpgrade = Math.max(1, upgrade);
  const upgradeIndex = safeUpgrade - 1;

  return {
    speed: Math.floor(rocket.speed * (1 + upgradeIndex * 0.045)),
    cargoCapacity: Math.floor(rocket.cargoCapacity * (1 + upgradeIndex * 0.09)),
    fuelCapacity: Math.floor(rocket.fuelCapacity * (1 + upgradeIndex * 0.08)),
  };
}

async function spendRhoons(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
) {
  const rhoons = await tx.cargo.findFirst({
    where: {
      userId,
      questId: null,
      rocketId: null,
      material: {
        name: "Rhoons",
      },
    },
  });

  if (!rhoons || rhoons.amount < amount) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Not enough Rhoons.",
    });
  }

  await tx.cargo.update({
    where: {
      id: rhoons.id,
    },
    data: {
      amount: rhoons.amount - amount,
    },
  });
}

export const fleetRouter = createTRPCRouter({
  getFleet: protectedProcedure.query(async ({ ctx }) => {
    const { db, session } = ctx;
    await ensurePlayerState(db, session.user.id);

    const [rockets, ownedRockets] = await Promise.all([
      db.rocket.findMany({
        orderBy: {
          price: "asc",
        },
      }),
      db.userRocket.findMany({
        where: {
          userId: session.user.id,
        },
      }),
    ]);
    const ownershipByRocketId = new Map(
      ownedRockets.map((ownedRocket) => [ownedRocket.rocketId, ownedRocket]),
    );

    return rockets.map((rocket) => {
      const ownedRocket = ownershipByRocketId.get(rocket.id);
      const upgrade = ownedRocket?.upgrade ?? 1;
      const effectiveStats = getRocketStats(rocket, upgrade);

      return {
        id: rocket.id,
        name: rocket.name,
        image: rocket.image,
        price: rocket.price,
        owned: Boolean(ownedRocket),
        ownedRocketId: ownedRocket?.id ?? null,
        upgrade,
        maxUpgrade: MAX_ROCKET_UPGRADE,
        nextUpgradeCost:
          ownedRocket && upgrade < MAX_ROCKET_UPGRADE
            ? getRocketUpgradeCost(rocket.price, upgrade)
            : null,
        baseSpeed: rocket.speed,
        baseCargoCapacity: rocket.cargoCapacity,
        baseFuelCapacity: rocket.fuelCapacity,
        ...effectiveStats,
      };
    });
  }),

  getLaunchOptions: protectedProcedure.query(async ({ ctx }) => {
    const { db, session } = ctx;
    await ensurePlayerState(db, session.user.id);

    const ownedRockets = await db.userRocket.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        rocket: true,
      },
      orderBy: {
        purchasedAt: "asc",
      },
    });

    return ownedRockets.map((ownedRocket) => {
      const stats = getRocketStats(ownedRocket.rocket, ownedRocket.upgrade);

      return {
        id: ownedRocket.rocket.id,
        name: ownedRocket.rocket.name,
        image: ownedRocket.rocket.image,
        upgrade: ownedRocket.upgrade,
        owned: true,
        ...stats,
      };
    });
  }),

  purchaseRocket: protectedProcedure
    .input(z.object({ rocketId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      await ensurePlayerState(db, session.user.id);

      const rocket = await db.rocket.findFirst({
        where: {
          id: input.rocketId,
        },
      });

      if (!rocket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rocket not found.",
        });
      }

      const existingOwnedRocket = await db.userRocket.findFirst({
        where: {
          userId: session.user.id,
          rocketId: rocket.id,
        },
      });

      if (existingOwnedRocket) {
        return {
          status: 200,
          message: "Rocket already owned.",
        };
      }

      await syncPlayerGameState(db, session.user.id);

      await db.$transaction(async (tx) => {
        await spendRhoons(tx, session.user.id, rocket.price);
        await tx.userRocket.create({
          data: {
            user: {
              connect: {
                id: session.user.id,
              },
            },
            rocket: {
              connect: {
                id: rocket.id,
              },
            },
          },
        });
      });

      return {
        status: 201,
        message: "Rocket purchased.",
      };
    }),

  upgradeRocket: protectedProcedure
    .input(z.object({ rocketId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      await ensurePlayerState(db, session.user.id);

      const ownedRocket = await db.userRocket.findFirst({
        where: {
          userId: session.user.id,
          rocketId: input.rocketId,
        },
        include: {
          rocket: true,
        },
      });

      if (!ownedRocket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rocket not owned.",
        });
      }

      if (ownedRocket.upgrade >= MAX_ROCKET_UPGRADE) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Rocket is already fully upgraded.",
        });
      }

      const cost = getRocketUpgradeCost(
        ownedRocket.rocket.price,
        ownedRocket.upgrade,
      );

      await syncPlayerGameState(db, session.user.id);

      await db.$transaction(async (tx) => {
        await spendRhoons(tx, session.user.id, cost);
        await tx.userRocket.update({
          where: {
            id: ownedRocket.id,
          },
          data: {
            upgrade: ownedRocket.upgrade + 1,
          },
        });
      });

      return {
        status: 200,
        message: "Rocket upgraded.",
      };
    }),
});

export { getRocketStats };
