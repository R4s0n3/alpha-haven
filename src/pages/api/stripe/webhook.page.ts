import { createHmac, timingSafeEqual } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";

import { env } from "@/env.mjs";
import { fulfillBloonCheckoutSession } from "@/server/api/routers/shop";
import { db } from "@/server/db";

export const config = {
  api: {
    bodyParser: false,
  },
};

type StripeCheckoutCompletedEvent = {
  type: string;
  data: {
    object: {
      id?: string;
      client_reference_id?: string | null;
      metadata?: Record<string, string | undefined> | null;
      payment_status?: string | null;
    };
  };
};

async function readRawBody(req: NextApiRequest) {
  const chunks: Buffer[] = [];
  const stream = req as AsyncIterable<Buffer | string>;

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function getStripeSignatureValue(signatureHeader: string, key: string) {
  return signatureHeader
    .split(",")
    .map((part) => part.split("=") as [string, string | undefined])
    .filter(
      (entry): entry is [string, string] =>
        entry[0] === key && Boolean(entry[1]),
    )
    .map(([, value]) => value);
}

function verifyStripeSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  webhookSecret: string,
) {
  if (!signatureHeader) {
    return false;
  }

  const timestamp = getStripeSignatureValue(signatureHeader, "t")[0];
  const signatures = getStripeSignatureValue(signatureHeader, "v1");

  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const expectedSignature = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBody.toString("utf8")}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  return signatures.some((signature) => {
    const signatureBuffer = Buffer.from(signature, "hex");

    return (
      signatureBuffer.length === expectedBuffer.length &&
      timingSafeEqual(signatureBuffer, expectedBuffer)
    );
  });
}

export default async function stripeWebhookHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    return res.status(500).json({ error: "Stripe webhook is not configured." });
  }

  const rawBody = await readRawBody(req);
  const stripeSignatureHeader = Array.isArray(req.headers["stripe-signature"])
    ? req.headers["stripe-signature"][0]
    : req.headers["stripe-signature"];

  if (!verifyStripeSignature(rawBody, stripeSignatureHeader, webhookSecret)) {
    return res.status(400).json({ error: "Invalid Stripe signature." });
  }

  const event = JSON.parse(
    rawBody.toString("utf8"),
  ) as StripeCheckoutCompletedEvent;

  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;

  if (session.payment_status !== "paid") {
    return res.status(200).json({ received: true, paid: false });
  }

  const stripeSessionId = session.id;
  const userId = session.metadata?.userId ?? session.client_reference_id;
  const packageId = session.metadata?.packageId;

  if (!stripeSessionId || !userId || !packageId) {
    return res.status(400).json({ error: "Missing checkout metadata." });
  }

  const granted = await db.$transaction((tx) =>
    fulfillBloonCheckoutSession({
      db: tx,
      stripeSessionId,
      userId,
      packageId,
    }),
  );

  return res.status(200).json({ received: true, granted });
}
