const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const { loadEnvConfig } = require("@next/env");

process.env.NODE_ENV = "test";
loadEnvConfig(process.cwd());

const { appRouter } = require("../src/server/api/root");
const { db } = require("../src/server/db");
const {
  MAX_ROCKET_CARGO_CAPACITY,
  MAX_ROCKET_FUEL_CAPACITY,
} = require("../src/server/gameContent");
const {
  addInventoryAmount,
} = require("../src/server/repositories/inventoryRepository");

async function deleteSmokeUser(userId) {
  await db.$transaction(async (tx) => {
    await tx.userTrade.deleteMany({ where: { userId } });
    await tx.userPortAutoRoute.deleteMany({ where: { userId } });
    await tx.userRocket.deleteMany({ where: { userId } });
    await tx.userBuilding.deleteMany({ where: { userId } });
    await tx.cargo.deleteMany({ where: { userId } });
    await tx.location.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.friendship.deleteMany({
      where: {
        OR: [{ requesterId: userId }, { adderId: userId }],
      },
    });
    await tx.user.deleteMany({ where: { id: userId } });
  });
}

async function getCargoAmount(userId, materialId) {
  const cargo = await db.cargo.findFirst({
    where: {
      userId,
      materialId,
      questId: null,
      rocketId: null,
    },
    select: {
      amount: true,
    },
  });

  return cargo?.amount ?? 0;
}

function assertNoNegativeCargo(rows) {
  const negativeRows = rows.filter((row) => row.amount < 0);

  assert.equal(
    negativeRows.length,
    0,
    `Inventory should never contain negative cargo: ${negativeRows
      .map((row) => `${row.material.name}=${row.amount}`)
      .join(", ")}`,
  );
}

async function main() {
  const userId = `smoke-${randomUUID()}`;
  const email = `${userId}@space-haven.local`;
  const session = {
    user: {
      id: userId,
      name: "Smoke Pilot",
      email,
      image: null,
    },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
  const caller = appRouter.createCaller({ session, db });

  try {
    await deleteSmokeUser(userId);
    await db.user.create({
      data: {
        id: userId,
        name: session.user.name,
        email,
      },
    });

    const initialInventory = await caller.user.getInventory();
    assert.ok(
      initialInventory.rhoons?.amount >= 12000,
      "New players should receive starter Rhoons.",
    );

    const buildings = await caller.building.getUserBuildings();
    const buildingNames = new Set(
      buildings.map((userBuilding) => userBuilding.building.name),
    );
    assert.ok(
      buildingNames.has("Dust Collector"),
      "Starter state should include a Dust Collector.",
    );
    assert.ok(
      buildingNames.has("Fuel Generator"),
      "Starter state should include a Fuel Generator.",
    );
    assert.ok(
      buildingNames.has("Launch Pad"),
      "Starter state should include a Launch Pad.",
    );

    const launchOptions = await caller.fleet.getLaunchOptions();
    assert.ok(
      launchOptions.length > 0,
      "Starter state should include an owned rocket.",
    );

    const portAutoRoutes = await caller.quest.getPortAutoRoutes();
    assert.equal(portAutoRoutes.length, 1, "Starter port should have one pad.");
    assert.equal(
      portAutoRoutes[0]?.canUseAutoRoute,
      false,
      "Starter auto-route should stay locked until Launch Pad upgrades.",
    );

    const materials = await db.material.findMany();
    await db.$transaction(async (tx) => {
      for (const material of materials) {
        if (material.name === "Rhoons") {
          continue;
        }

        await addInventoryAmount(tx, userId, material.id, 100_000);
      }
    });

    const offers = await caller.quest.getOffers({
      includeAllForeignPlanets: true,
    });
    assert.ok(
      offers.every((offer) => offer.fuelRequired <= MAX_ROCKET_FUEL_CAPACITY),
      "Quest fuel demands should stay within the best rocket's max fuel capacity.",
    );
    assert.ok(
      offers.every((offer) => offer.requestedAmount <= MAX_ROCKET_CARGO_CAPACITY),
      "Quest cargo demands should stay within the best rocket's max cargo capacity.",
    );
    assert.ok(
      offers.every((offer) => offer.rewardAmount <= MAX_ROCKET_CARGO_CAPACITY),
      "Quest awards should stay within the best rocket's max cargo capacity.",
    );
    const offer = offers.find((candidate) => candidate.eligibleRockets.length);
    assert.ok(offer, "A funded player with an idle rocket should see offers.");

    const selectedRocketId =
      offer.recommendedRocketId ?? offer.eligibleRockets[0]?.id;
    assert.ok(selectedRocketId, "An eligible offer should include a rocket.");

    const rewardBefore = await getCargoAmount(userId, offer.rewardMaterial.id);
    const accepted = await caller.quest.acceptTrade({
      offerId: offer.id,
      rocketId: selectedRocketId,
      portSlot: 1,
    });
    assert.equal(accepted.status, 201, "Accepting a route should succeed.");

    const loadingTrades = await caller.quest.getActiveTrades();
    const loadingTrade = loadingTrades.find(
      (trade) => trade.id === accepted.tradeId,
    );
    assert.ok(loadingTrade, "Accepted route should be visible as active.");
    assert.equal(loadingTrade.status, "LOADING");
    assert.ok(loadingTrade.requestedAmount > 0);
    assert.ok(loadingTrade.fuelRequired > 0);
    assert.ok(loadingTrade.loadSeconds > 0);

    await db.userTrade.update({
      where: {
        id: accepted.tradeId,
      },
      data: {
        loadedAt: new Date(Date.now() - 1000),
      },
    });

    const readyTrades = await caller.quest.getActiveTrades();
    const readyTrade = readyTrades.find((trade) => trade.id === accepted.tradeId);
    assert.ok(readyTrade, "Loaded route should remain active.");
    assert.equal(readyTrade.status, "READY_TO_LAUNCH");
    assert.equal(readyTrade.cargoLoaded, readyTrade.requestedAmount);
    assert.equal(readyTrade.fuelLoaded, readyTrade.fuelRequired);

    const launched = await caller.quest.launchTrade({
      tradeId: accepted.tradeId,
    });
    assert.equal(launched.status, 200, "Launching a ready route should work.");

    await db.userTrade.update({
      where: {
        id: accepted.tradeId,
      },
      data: {
        arrivesAt: new Date(Date.now() - 1000),
      },
    });

    await caller.quest.getActiveTrades();
    const completedTrades = await caller.quest.getCompletedTrades();
    const completedTrade = completedTrades.find(
      (trade) => trade.id === accepted.tradeId,
    );
    assert.ok(completedTrade, "Arrived route should complete automatically.");

    const rewardAfter = await getCargoAmount(userId, readyTrade.rewardMaterial.id);
    assert.ok(
      rewardAfter >= rewardBefore + readyTrade.rewardAmount,
      "Completed route should grant its reward exactly once or more if passive sync added inventory.",
    );

    const finalCargo = await db.cargo.findMany({
      where: {
        userId,
      },
      include: {
        material: true,
      },
    });
    assertNoNegativeCargo(finalCargo);

    console.log(
      `Gameplay smoke passed: accepted, loaded, launched, completed, and rewarded route ${accepted.tradeId}.`,
    );
  } finally {
    await deleteSmokeUser(userId);
    await db.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
