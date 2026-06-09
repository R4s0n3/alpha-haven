import { TRPCError } from "@trpc/server";
import type { Prisma, PrismaClient } from "@prisma/client";

type InventoryDb = Prisma.TransactionClient | PrismaClient;

type SpendInventoryOptions = {
  materialName?: string;
  insufficientMessage?: string;
};

function getInsufficientInventoryError(message: string) {
  return new TRPCError({
    code: "BAD_REQUEST",
    message,
  });
}

export async function addInventoryAmount(
  db: InventoryDb,
  userId: string,
  materialId: string,
  amount: number,
) {
  if (amount <= 0) {
    return;
  }

  const existingCargo = await db.cargo.findFirst({
    where: {
      userId,
      materialId,
      questId: null,
      rocketId: null,
    },
  });

  if (existingCargo) {
    await db.cargo.update({
      where: {
        id: existingCargo.id,
      },
      data: {
        amount: {
          increment: amount,
        },
      },
    });
    return;
  }

  await db.cargo.create({
    data: {
      user: {
        connect: {
          id: userId,
        },
      },
      material: {
        connect: {
          id: materialId,
        },
      },
      amount,
    },
  });
}

export async function spendInventoryAmount(
  db: InventoryDb,
  userId: string,
  materialId: string,
  amount: number,
  options: SpendInventoryOptions = {},
) {
  if (amount <= 0) {
    return;
  }

  const materialName = options.materialName ?? "material";
  const existingCargo = await db.cargo.findFirst({
    where: {
      userId,
      materialId,
      questId: null,
      rocketId: null,
    },
  });

  if (!existingCargo || existingCargo.amount < amount) {
    throw getInsufficientInventoryError(
      options.insufficientMessage ?? `Not enough ${materialName}.`,
    );
  }

  await db.cargo.update({
    where: {
      id: existingCargo.id,
    },
    data: {
      amount: {
        decrement: amount,
      },
    },
  });
}

export async function reserveInventoryAmount(
  db: InventoryDb,
  userId: string,
  materialId: string,
  materialName: string,
  amount: number,
) {
  await spendInventoryAmount(db, userId, materialId, amount, {
    materialName,
    insufficientMessage: `Need ${amount} ${materialName}.`,
  });
}
