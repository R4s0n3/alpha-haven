import type { Cargo, PrismaClient } from "@prisma/client";

import {
  addInventoryAmount,
  spendInventoryAmount,
} from "@/server/repositories/inventoryRepository";
import { getOwnedBuildingsForProduction } from "@/server/repositories/buildingRepository";
import { MAX_INPUT_PRODUCTION_SYNC_CYCLES } from "@/server/gameBalance";

export type ProductionBuilding = {
  id: string;
  amount: number;
  level: number;
  lastProductionTime: Date;
  building: {
    productionDuration: number;
    productionRate: number;
    reqInput: (Pick<Cargo, "amount" | "materialId"> & {
      material?: {
        id: string;
        image: string | null;
        name: string;
      };
    })[];
    recOutput: Pick<Cargo, "amount" | "materialId">[];
  };
};

export type InventoryEntry = {
  materialId: string;
  amount: number;
};

export function getProductionCycles(
  userBuilding: Pick<ProductionBuilding, "lastProductionTime" | "building">,
  now = new Date(),
) {
  const durationMs =
    Math.max(1, userBuilding.building.productionDuration) * 1000;
  const elapsedMs = Math.max(
    0,
    now.getTime() - userBuilding.lastProductionTime.getTime(),
  );

  return {
    cycles: Math.floor(elapsedMs / durationMs),
    remainderMs: elapsedMs % durationMs,
    durationMs,
  };
}

export function getProductionMultiplier(
  userBuilding: Pick<ProductionBuilding, "amount" | "level" | "building">,
) {
  const levelMultiplier = 1 + (Math.max(1, userBuilding.level) - 1) * 0.35;

  return Math.max(
    1,
    Math.floor(
      Math.max(1, userBuilding.amount) *
        levelMultiplier *
        Math.max(1, userBuilding.building.productionRate),
    ),
  );
}

export function getInventoryMap(cargo: InventoryEntry[]) {
  return new Map(cargo.map((item) => [item.materialId, item.amount]));
}

export function getInputRequirements(
  userBuilding: ProductionBuilding,
  cycles: number,
) {
  const multiplier = getProductionMultiplier(userBuilding);
  const requirements = new Map<
    string,
    {
      materialId: string;
      material?: {
        id: string;
        image: string | null;
        name: string;
      };
      amountPerCycle: number;
      amount: number;
    }
  >();

  userBuilding.building.reqInput.forEach((input) => {
    const amountPerCycle = input.amount * multiplier;
    const existing = requirements.get(input.materialId);

    if (existing) {
      existing.amountPerCycle += amountPerCycle;
      existing.amount += amountPerCycle * cycles;
      return;
    }

    requirements.set(input.materialId, {
      materialId: input.materialId,
      material: input.material,
      amountPerCycle,
      amount: amountPerCycle * cycles,
    });
  });

  return Array.from(requirements.values());
}

export function getAffordableCycles(
  userBuilding: ProductionBuilding,
  inventoryByMaterialId: Map<string, number>,
  cycles: number,
) {
  if (cycles <= 0 || userBuilding.building.reqInput.length === 0) {
    return cycles;
  }

  return getInputRequirements(userBuilding, 1).reduce(
    (affordableCycles, input) =>
      Math.min(
        affordableCycles,
        Math.floor(
          (inventoryByMaterialId.get(input.materialId) ?? 0) /
            Math.max(1, input.amountPerCycle),
        ),
      ),
    cycles,
  );
}

export function getClaimCycles(
  userBuilding: ProductionBuilding,
  inventoryByMaterialId: Map<string, number>,
  cycles: number,
) {
  if (cycles <= 0) {
    return 0;
  }

  const pendingCycles =
    userBuilding.building.reqInput.length > 0
      ? Math.min(cycles, MAX_INPUT_PRODUCTION_SYNC_CYCLES)
      : cycles;

  return getAffordableCycles(
    userBuilding,
    inventoryByMaterialId,
    pendingCycles,
  );
}

export function getClaimableOutputsForCycles(
  userBuilding: ProductionBuilding,
  cycles: number,
) {
  const multiplier = getProductionMultiplier(userBuilding);

  return userBuilding.building.recOutput.map((output) => ({
    materialId: output.materialId,
    amount: output.amount * multiplier * cycles,
  }));
}

export async function syncBuildingProductionForUser(
  db: PrismaClient,
  userId: string,
  now = new Date(),
) {
  const [userBuildings, inventory] = await Promise.all([
    getOwnedBuildingsForProduction(db, userId),
    db.cargo.findMany({
      where: {
        userId,
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
  const readyBuildings: {
    userBuilding: (typeof userBuildings)[number];
    cycles: number;
    durationMs: number;
    claimable: {
      materialId: string;
      amount: number;
    }[];
    inputRequirements: ReturnType<typeof getInputRequirements>;
  }[] = [];
  let blockedBuildings = 0;

  for (const userBuilding of userBuildings) {
    const { cycles, durationMs } = getProductionCycles(userBuilding, now);
    const claimCycles = getClaimCycles(
      userBuilding,
      inventoryByMaterialId,
      cycles,
    );
    const claimable = getClaimableOutputsForCycles(
      userBuilding,
      claimCycles,
    ).filter((output) => output.amount > 0);

    if (claimCycles <= 0 || claimable.length === 0) {
      if (cycles > 0 && userBuilding.building.reqInput.length > 0) {
        blockedBuildings += 1;
      }

      continue;
    }

    const inputRequirements = getInputRequirements(userBuilding, claimCycles);

    inputRequirements.forEach((inputRequirement) => {
      inventoryByMaterialId.set(
        inputRequirement.materialId,
        (inventoryByMaterialId.get(inputRequirement.materialId) ?? 0) -
          inputRequirement.amount,
      );
    });
    claimable.forEach((output) => {
      inventoryByMaterialId.set(
        output.materialId,
        (inventoryByMaterialId.get(output.materialId) ?? 0) + output.amount,
      );
    });

    readyBuildings.push({
      userBuilding,
      cycles: claimCycles,
      durationMs,
      claimable,
      inputRequirements,
    });
  }

  if (readyBuildings.length === 0) {
    return {
      synced: false,
      buildingsCollected: 0,
      collected: [] as { materialId: string; amount: number }[],
      blockedBuildings,
    };
  }

  const collected = new Map<string, number>();

  await db.$transaction(async (tx) => {
    for (const entry of readyBuildings) {
      for (const inputRequirement of entry.inputRequirements) {
        await spendInventoryAmount(
          tx,
          userId,
          inputRequirement.materialId,
          inputRequirement.amount,
          {
            insufficientMessage:
              "Inventory changed while syncing building production.",
          },
        );
      }

      for (const output of entry.claimable) {
        await addInventoryAmount(tx, userId, output.materialId, output.amount);
        collected.set(
          output.materialId,
          (collected.get(output.materialId) ?? 0) + output.amount,
        );
      }

      await tx.userBuilding.update({
        where: {
          id: entry.userBuilding.id,
        },
        data: {
          lastProductionTime: new Date(
            entry.userBuilding.lastProductionTime.getTime() +
              entry.cycles * entry.durationMs,
          ),
        },
      });
    }
  });

  return {
    synced: true,
    buildingsCollected: readyBuildings.length,
    collected: Array.from(collected.entries()).map(([materialId, amount]) => ({
      materialId,
      amount,
    })),
    blockedBuildings,
  };
}
