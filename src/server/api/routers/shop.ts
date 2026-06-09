import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { StripePurchaseStatus } from "@/server/dbEnums";
import { ensurePlayerState } from "@/server/gameContent";
import {
  addInventoryAmount,
  spendInventoryAmount,
} from "@/server/repositories/inventoryRepository";
import {
  findStripePurchaseBySession,
  isUniqueConstraintError,
  markStripePurchaseCompleted,
  recordCheckoutSessionIfMissing,
} from "@/server/repositories/stripePurchaseRepository";
import { env } from "@/env.mjs";

const BLOONS_MATERIAL_NAME = "Bloons";

const bloonPackages = [
  {
    id: "bloons-starter",
    name: "Starter Bloons",
    bloons: 25,
    priceLabel: "0,99 EUR",
    priceCents: 99,
    bonusLabel: null,
  },
  {
    id: "bloons-pouch",
    name: "Bloons Pouch",
    bloons: 90,
    priceLabel: "2,99 EUR",
    priceCents: 299,
    bonusLabel: "+20% bonus",
  },
  {
    id: "bloons-crate",
    name: "Bloons Crate",
    bloons: 220,
    priceLabel: "5,99 EUR",
    priceCents: 599,
    bonusLabel: "+45% bonus",
  },
  {
    id: "bloons-vault",
    name: "Bloons Vault",
    bloons: 520,
    priceLabel: "11,99 EUR",
    priceCents: 1199,
    bonusLabel: "+70% bonus",
  },
  {
    id: "bloons-orbital-bank",
    name: "Orbital Bank",
    bloons: 1250,
    priceLabel: "24,99 EUR",
    priceCents: 2499,
    bonusLabel: "Best value",
  },
] as const;

const materialExchangeOffers = [
  {
    id: "rhoons-cache",
    materialName: "Rhoons",
    amount: 30000,
    costBloons: 2,
  },
  {
    id: "dust-crate",
    materialName: "Dust",
    amount: 1000,
    costBloons: 1,
  },
  {
    id: "h3-cells",
    materialName: "H3",
    amount: 1000,
    costBloons: 2,
  },
  {
    id: "concrete-stack",
    materialName: "Concrete",
    amount: 1000,
    costBloons: 3,
  },
  {
    id: "metal-bundle",
    materialName: "Metal",
    amount: 1000,
    costBloons: 4,
  },
  {
    id: "zaza-pods",
    materialName: "Zaza",
    amount: 100,
    costBloons: 5,
  },
] as const;

type BloonPackageId = (typeof bloonPackages)[number]["id"];

type StripeCheckoutResponse = {
  id?: string;
  url?: string | null;
  error?: {
    message?: string;
  };
};

function getBloonPackage(packageId: string) {
  return bloonPackages.find((bloonPackage) => bloonPackage.id === packageId);
}

function getStripeSecretKey() {
  const secretKey = env.STRIPE_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Stripe secret key is not configured.",
    });
  }

  return secretKey;
}

function appendCheckoutSessionParams(
  params: URLSearchParams,
  userId: string,
  bloonPackage: (typeof bloonPackages)[number],
) {
  const successUrl = `${env.NEXTAUTH_URL}/game/port?payment=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${env.NEXTAUTH_URL}/game/port?payment=cancelled`;

  params.append("mode", "payment");
  params.append("payment_method_types[0]", "card");
  params.append("success_url", successUrl);
  params.append("cancel_url", cancelUrl);
  params.append("client_reference_id", userId);
  params.append("line_items[0][quantity]", "1");
  params.append("line_items[0][price_data][currency]", "eur");
  params.append(
    "line_items[0][price_data][unit_amount]",
    String(bloonPackage.priceCents),
  );
  params.append(
    "line_items[0][price_data][product_data][name]",
    bloonPackage.name,
  );
  params.append(
    "line_items[0][price_data][product_data][description]",
    `${bloonPackage.bloons} Bloons for Space Haven`,
  );
  params.append("metadata[userId]", userId);
  params.append("metadata[packageId]", bloonPackage.id);
  params.append("payment_intent_data[metadata][userId]", userId);
  params.append("payment_intent_data[metadata][packageId]", bloonPackage.id);
}

async function createStripeCheckoutSession(
  userId: string,
  bloonPackage: (typeof bloonPackages)[number],
) {
  const params = new URLSearchParams();
  appendCheckoutSessionParams(params, userId, bloonPackage);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const payload = (await response.json()) as StripeCheckoutResponse;

  if (!response.ok || !payload.id || !payload.url) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        payload.error?.message ??
        "Stripe Checkout session could not be created.",
    });
  }

  return {
    sessionId: payload.id,
    checkoutUrl: payload.url,
  };
}

async function recordStripeCheckoutSession(
  db: Prisma.TransactionClient | PrismaClient,
  stripeSessionId: string,
  userId: string,
  bloonPackage: (typeof bloonPackages)[number],
) {
  await recordCheckoutSessionIfMissing(db, {
    stripeSessionId,
    userId,
    packageId: bloonPackage.id,
    bloons: bloonPackage.bloons,
    priceCents: bloonPackage.priceCents,
  });
}

async function grantBloonsForCheckoutSession(
  db: Prisma.TransactionClient,
  stripeSessionId: string,
  userId: string,
  packageId: BloonPackageId,
) {
  const bloonPackage = getBloonPackage(packageId);

  if (!bloonPackage) {
    throw new Error(`Unknown Bloons package: ${packageId}`);
  }

  const [existingPurchase, bloonsMaterial] = await Promise.all([
    findStripePurchaseBySession(db, stripeSessionId),
    db.material.findFirst({
      where: {
        name: BLOONS_MATERIAL_NAME,
      },
    }),
  ]);

  if (existingPurchase?.status === StripePurchaseStatus.COMPLETED) {
    return false;
  }

  if (!bloonsMaterial) {
    throw new Error("Bloons material not found.");
  }

  const now = new Date();

  if (existingPurchase) {
    await markStripePurchaseCompleted(db, stripeSessionId, now);
  } else {
    try {
      await db.stripePurchase.create({
        data: {
          stripeSessionId,
          userId,
          packageId: bloonPackage.id,
          bloons: bloonPackage.bloons,
          priceCents: bloonPackage.priceCents,
          status: StripePurchaseStatus.COMPLETED,
          grantedAt: now,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const purchase = await findStripePurchaseBySession(db, stripeSessionId);

      if (purchase?.status === StripePurchaseStatus.COMPLETED) {
        return false;
      }

      await markStripePurchaseCompleted(db, stripeSessionId, now);
    }
  }

  await addInventoryAmount(db, userId, bloonsMaterial.id, bloonPackage.bloons);

  return true;
}

export async function fulfillBloonCheckoutSession({
  db,
  stripeSessionId,
  userId,
  packageId,
}: {
  db: Prisma.TransactionClient;
  stripeSessionId: string;
  userId: string;
  packageId: string;
}) {
  return grantBloonsForCheckoutSession(
    db,
    stripeSessionId,
    userId,
    packageId as BloonPackageId,
  );
}

export const shopRouter = createTRPCRouter({
  getBloonPackages: protectedProcedure.query(async ({ ctx }) => {
    const { db, session } = ctx;
    await ensurePlayerState(db, session.user.id);

    const bloonsMaterial = await db.material.findFirst({
      where: {
        name: BLOONS_MATERIAL_NAME,
      },
    });

    if (!bloonsMaterial) {
      return [];
    }

    return bloonPackages.map((bloonPackage) => ({
      ...bloonPackage,
      material: bloonsMaterial,
    }));
  }),

  getMaterialOffers: protectedProcedure.query(async ({ ctx }) => {
    const { db, session } = ctx;
    await ensurePlayerState(db, session.user.id);

    const materials = await db.material.findMany();
    const materialByName = new Map(
      materials.map((material) => [material.name, material]),
    );
    const bloonsMaterial = materialByName.get(BLOONS_MATERIAL_NAME);

    if (!bloonsMaterial) {
      return [];
    }

    return materialExchangeOffers
      .map((offer) => {
        const material = materialByName.get(offer.materialName);

        if (!material) {
          return null;
        }

        return {
          ...offer,
          material,
          costMaterial: bloonsMaterial,
        };
      })
      .filter((offer): offer is NonNullable<typeof offer> => offer !== null);
  }),

  createBloonCheckoutSession: protectedProcedure
    .input(z.object({ packageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      await ensurePlayerState(db, session.user.id);

      const bloonPackage = getBloonPackage(input.packageId);

      if (!bloonPackage) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bloons package not found.",
        });
      }

      const checkoutSession = await createStripeCheckoutSession(
        session.user.id,
        bloonPackage,
      );

      await recordStripeCheckoutSession(
        db,
        checkoutSession.sessionId,
        session.user.id,
        bloonPackage,
      );

      return checkoutSession;
    }),

  exchangeMaterial: protectedProcedure
    .input(z.object({ offerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      await ensurePlayerState(db, session.user.id);

      const offer = materialExchangeOffers.find(
        (exchangeOffer) => exchangeOffer.id === input.offerId,
      );

      if (!offer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Shop offer not found.",
        });
      }

      const [targetMaterial, bloonsMaterial] = await Promise.all([
        db.material.findFirst({
          where: {
            name: offer.materialName,
          },
        }),
        db.material.findFirst({
          where: {
            name: BLOONS_MATERIAL_NAME,
          },
        }),
      ]);

      if (!targetMaterial || !bloonsMaterial) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Shop material not found.",
        });
      }

      await db.$transaction(async (tx) => {
        await spendInventoryAmount(
          tx,
          session.user.id,
          bloonsMaterial.id,
          offer.costBloons,
          {
            materialName: BLOONS_MATERIAL_NAME,
          },
        );
        await addInventoryAmount(
          tx,
          session.user.id,
          targetMaterial.id,
          offer.amount,
        );
      });

      return {
        status: 200,
        message: `Exchanged ${offer.costBloons} Bloons for ${offer.amount} ${offer.materialName}.`,
      };
    }),
});
