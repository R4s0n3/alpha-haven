import type { Prisma, PrismaClient } from "@prisma/client";

import type { UserTradeStatus } from "@/server/dbEnums";

type TradeDb = Prisma.TransactionClient | PrismaClient;

const tradeMaterialInclude = {
  requestedMaterial: true,
  rewardMaterial: true,
} as const;

export function findTradeForUser(db: TradeDb, userId: string, tradeId: string) {
  return db.userTrade.findFirst({
    where: {
      id: tradeId,
      userId,
    },
    include: tradeMaterialInclude,
  });
}

export function findTradesForStatusSync(
  db: TradeDb,
  userId: string,
  statuses: readonly UserTradeStatus[],
) {
  return db.userTrade.findMany({
    where: {
      userId,
      status: {
        in: [...statuses],
      },
    },
    include: tradeMaterialInclude,
    orderBy: {
      updatedAt: "asc",
    },
  });
}

export function setTradeStatusIfCurrent(
  db: TradeDb,
  {
    tradeId,
    userId,
    currentStatus,
    nextStatus,
    data,
  }: {
    tradeId: string;
    userId: string;
    currentStatus: UserTradeStatus;
    nextStatus: UserTradeStatus;
    data?: Prisma.UserTradeUpdateManyMutationInput;
  },
) {
  return db.userTrade.updateMany({
    where: {
      id: tradeId,
      userId,
      status: currentStatus,
    },
    data: {
      ...data,
      status: nextStatus,
    },
  });
}

export function createRepeatedTrade(
  db: TradeDb,
  data: Prisma.UserTradeUncheckedCreateInput,
) {
  return db.userTrade.create({
    data,
  });
}
