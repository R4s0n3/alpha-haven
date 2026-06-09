import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import { StripePurchaseStatus } from "@/server/dbEnums";

type StripePurchaseDb = Prisma.TransactionClient | PrismaClient;

type StripePurchaseDetails = {
  stripeSessionId: string;
  userId: string;
  packageId: string;
  bloons: number;
  priceCents: number;
};

export function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function recordCheckoutSessionIfMissing(
  db: StripePurchaseDb,
  details: StripePurchaseDetails,
) {
  const existingPurchase = await db.stripePurchase.findUnique({
    where: {
      stripeSessionId: details.stripeSessionId,
    },
    select: {
      stripeSessionId: true,
    },
  });

  if (existingPurchase) {
    return;
  }

  try {
    await db.stripePurchase.create({
      data: {
        stripeSessionId: details.stripeSessionId,
        userId: details.userId,
        packageId: details.packageId,
        bloons: details.bloons,
        priceCents: details.priceCents,
        status: StripePurchaseStatus.OPEN,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return;
    }

    throw error;
  }
}

export async function findStripePurchaseBySession(
  db: StripePurchaseDb,
  stripeSessionId: string,
) {
  return db.stripePurchase.findUnique({
    where: {
      stripeSessionId,
    },
    select: {
      status: true,
    },
  });
}

export async function markStripePurchaseCompleted(
  db: StripePurchaseDb,
  stripeSessionId: string,
  grantedAt: Date,
) {
  return db.stripePurchase.update({
    where: {
      stripeSessionId,
    },
    data: {
      status: StripePurchaseStatus.COMPLETED,
      grantedAt,
    },
  });
}
