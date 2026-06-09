import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { setBuildingAutoRoute } from "@/server/repositories/buildingRepository";
import {
  getClaimableOutputsForCycles,
  getClaimCycles,
  getInputRequirements,
  getInventoryMap,
  getProductionCycles,
  getProductionMultiplier,
} from "@/server/buildingProduction";
import {
  AUTO_ROUTE_UNLOCK_LEVEL,
  MAX_BUILDING_LEVEL,
  getBuildingUpgradeCost,
} from "@/server/gameBalance";
import { ensureGameContent, ensurePlayerState } from "@/server/gameContent";
import { getPassiveRhoonsPerSecond } from "@/server/passiveRhoons";
import { syncPlayerGameState } from "@/server/gameEngine";

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

export const buildingRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const { db } = ctx;
    await ensureGameContent(db);

    return db.building.findMany({
      include: {
        reqInput: {
          include: {
            material: true,
          },
        },
        recOutput: {
          include: {
            material: true,
          },
        },
      },
      orderBy: {
        price: "asc",
      },
    });
  }),

  getUserBuildings: protectedProcedure.query(async ({ ctx }) => {
    const { session, db } = ctx;
    await ensurePlayerState(db, session.user.id);

    const now = new Date();
    await syncPlayerGameState(db, session.user.id, now);

    const [userBuildings, inventory] = await Promise.all([
      db.userBuilding.findMany({
        where: {
          userId: session.user.id,
        },
        include: {
          output: {
            select: {
              material: true,
              amount: true,
            },
          },
          input: {
            select: {
              material: true,
              amount: true,
            },
          },
          building: {
            include: {
              reqInput: {
                select: {
                  amount: true,
                  materialId: true,
                  material: true,
                },
              },
              recOutput: {
                select: {
                  amount: true,
                  materialId: true,
                  material: true,
                },
              },
            },
          },
        },
        orderBy: {
          purchasedAt: "asc",
        },
      }),
      db.cargo.findMany({
        where: {
          userId: session.user.id,
          questId: null,
          rocketId: null,
        },
        select: {
          materialId: true,
          amount: true,
        },
      }),
    ]);
    const inventoryByMaterialId = getInventoryMap(inventory);

    return userBuildings.map((userBuilding) => {
      const { cycles, durationMs } = getProductionCycles(userBuilding, now);
      const claimCycles = getClaimCycles(
        userBuilding,
        inventoryByMaterialId,
        cycles,
      );
      const inputRequirements = getInputRequirements(
        userBuilding,
        userBuilding.building.reqInput.length > 0
          ? Math.max(1, claimCycles)
          : 1,
      );
      const secondsUntilNext =
        cycles > 0
          ? 0
          : Math.max(
              0,
              Math.ceil(
                (durationMs -
                  (now.getTime() - userBuilding.lastProductionTime.getTime())) /
                  1000,
              ),
            );

      return {
        ...userBuilding,
        claimable: getClaimableOutputsForCycles(
          userBuilding,
          claimCycles,
        ).filter((output) => output.amount > 0),
        inputRequirements: inputRequirements.map((input) => ({
          ...input,
          available: inventoryByMaterialId.get(input.materialId) ?? 0,
        })),
        isInputBlocked:
          cycles > 0 &&
          userBuilding.building.reqInput.length > 0 &&
          claimCycles === 0,
        productionMultiplier: getProductionMultiplier(userBuilding),
        rhoonsPerSecond: getPassiveRhoonsPerSecond(userBuilding),
        nextUpgradeCost:
          userBuilding.level >= MAX_BUILDING_LEVEL
            ? null
            : getBuildingUpgradeCost(
                userBuilding.building.price,
                userBuilding.level,
              ),
        maxLevel: MAX_BUILDING_LEVEL,
        autoRouteEnabled: userBuilding.autoRouteEnabled,
        autoRouteUnlockLevel: AUTO_ROUTE_UNLOCK_LEVEL,
        canUseAutoRoute:
          userBuilding.building.name === "Launch Pad" &&
          userBuilding.level >= AUTO_ROUTE_UNLOCK_LEVEL,
        secondsUntilNext,
      };
    });
  }),

  purchaseBuilding: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { session, db } = ctx;
      const { id } = input;
      await ensurePlayerState(db, session.user.id);

      const existingBuilding = await db.building.findFirst({
        where: {
          id,
        },
      });

      if (!existingBuilding) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Building not found.",
        });
      }

      await syncPlayerGameState(db, session.user.id);

      await db.$transaction(async (tx) => {
        await spendRhoons(tx, session.user.id, existingBuilding.price);

        const existingUserBuilding = await tx.userBuilding.findFirst({
          where: {
            userId: session.user.id,
            buildingId: existingBuilding.id,
          },
        });

        if (existingUserBuilding) {
          if (existingUserBuilding.amount >= existingBuilding.maxAmount) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Building limit reached.",
            });
          }

          await tx.userBuilding.update({
            where: {
              id: existingUserBuilding.id,
            },
            data: {
              amount: existingUserBuilding.amount + 1,
            },
          });
          return;
        }

        await tx.userBuilding.create({
          data: {
            user: {
              connect: {
                id: session.user.id,
              },
            },
            building: {
              connect: {
                id: existingBuilding.id,
              },
            },
            amount: 1,
          },
        });
      });

      return {
        status: 201,
        message: "Building purchased.",
      };
    }),

  upgradeBuilding: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { session, db } = ctx;
      await ensurePlayerState(db, session.user.id);

      const userBuilding = await db.userBuilding.findFirst({
        where: {
          id: input.id,
          userId: session.user.id,
        },
        include: {
          building: true,
        },
      });

      if (!userBuilding) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Building not found.",
        });
      }

      if (userBuilding.level >= MAX_BUILDING_LEVEL) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Building is already fully upgraded.",
        });
      }

      const cost = getBuildingUpgradeCost(
        userBuilding.building.price,
        userBuilding.level,
      );

      await syncPlayerGameState(db, session.user.id);

      await db.$transaction(async (tx) => {
        await spendRhoons(tx, session.user.id, cost);
        await tx.userBuilding.update({
          where: {
            id: userBuilding.id,
          },
          data: {
            level: userBuilding.level + 1,
          },
        });
      });

      return {
        status: 200,
        message: "Building upgraded.",
      };
    }),

  toggleAutoRoute: protectedProcedure
    .input(z.object({ id: z.string(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { session, db } = ctx;
      await ensurePlayerState(db, session.user.id);

      const userBuilding = await db.userBuilding.findFirst({
        where: {
          id: input.id,
          userId: session.user.id,
        },
        include: {
          building: true,
        },
      });

      if (!userBuilding) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Building not found.",
        });
      }

      if (userBuilding.building.name !== "Launch Pad") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Auto route is only available on Launch Pads.",
        });
      }

      if (userBuilding.level < AUTO_ROUTE_UNLOCK_LEVEL) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Auto route unlocks at Launch Pad level ${AUTO_ROUTE_UNLOCK_LEVEL}.`,
        });
      }

      const result = await setBuildingAutoRoute(
        db,
        session.user.id,
        userBuilding.id,
        input.enabled,
      );

      if (result.count === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Building auto route state changed before it could be updated.",
        });
      }

      return {
        status: 200,
        message: input.enabled ? "Auto route enabled." : "Auto route disabled.",
      };
    }),
});
