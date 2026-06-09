import type { PrismaClient } from "@prisma/client";

import { MAX_ROCKET_UPGRADE } from "@/server/gameBalance";

type GameDb = Pick<
  PrismaClient,
  | "building"
  | "cargo"
  | "location"
  | "material"
  | "materialType"
  | "rarity"
  | "rocket"
  | "rocketType"
  | "userBuilding"
  | "userRocket"
>;

type ProducerBlueprint = {
  name: string;
  input?: {
    material: string;
    amount: number;
  }[];
  output: string;
  outputAmount: number;
  price: number;
  productionRate: number;
  productionDuration: number;
  maxAmount: number;
  image?: string;
};

type RocketBlueprint = {
  name: string;
  speed: number;
  health: number;
  imageFileName: string;
  price: number;
  type: "SMALL" | "MEDIUM" | "LARGE";
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  fuelCapacity: number;
  cargoCapacity: number;
};

type MaterialBlueprint = {
  name: string;
  type: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  weight: number;
  image?: string;
};

const materialBlueprints: MaterialBlueprint[] = [
  {
    name: "Rhoons",
    type: "CURRENCY",
    rarity: "COMMON",
    weight: 1,
    image: "/assets/game/materials/rhoon.png",
  },
  {
    name: "Dust",
    type: "RAW",
    rarity: "COMMON",
    weight: 45,
    image: "/assets/game/materials/dust.png",
  },
  {
    name: "H3",
    type: "FUEL",
    rarity: "COMMON",
    weight: 80,
    image: "/assets/game/materials/h3.png",
  },
  {
    name: "Concrete",
    type: "REFINED",
    rarity: "COMMON",
    weight: 140,
    image: "/assets/game/materials/concrete.png",
  },
  {
    name: "Metal",
    type: "REFINED",
    rarity: "RARE",
    weight: 280,
    image: "/assets/game/materials/iron.png",
  },
  {
    name: "Zaza",
    type: "SPECIAL",
    rarity: "EPIC",
    weight: 520,
    image: "/assets/game/materials/zaza.png",
  },
  {
    name: "Bloons",
    type: "PREMIUM",
    rarity: "LEGENDARY",
    weight: 1200,
    image: "/assets/game/materials/bloons.png",
  },
];

const producerBlueprints: ProducerBlueprint[] = [
  {
    name: "Dust Collector",
    output: "Dust",
    outputAmount: 8,
    price: 2500,
    productionRate: 1,
    productionDuration: 35,
    maxAmount: 6,
    image: "/assets/game/buildings/dust_collector.png",
  },
  {
    name: "Fuel Generator",
    input: [
      {
        material: "Dust",
        amount: 5,
      },
    ],
    output: "H3",
    outputAmount: 2,
    price: 6500,
    productionRate: 1,
    productionDuration: 90,
    maxAmount: 5,
    image: "/assets/game/buildings/fuel_generator.png",
  },
  {
    name: "Concrete Press",
    input: [
      {
        material: "Dust",
        amount: 9,
      },
    ],
    output: "Concrete",
    outputAmount: 3,
    price: 16000,
    productionRate: 1,
    productionDuration: 150,
    maxAmount: 4,
    image: "/assets/game/materials/concrete.png",
  },
  {
    name: "Metal Foundry",
    input: [
      {
        material: "Dust",
        amount: 14,
      },
      {
        material: "Concrete",
        amount: 2,
      },
    ],
    output: "Metal",
    outputAmount: 2,
    price: 32000,
    productionRate: 1,
    productionDuration: 240,
    maxAmount: 3,
    image: "/assets/game/materials/iron.png",
  },
  {
    name: "Bloon Loom",
    input: [
      {
        material: "Dust",
        amount: 22,
      },
      {
        material: "H3",
        amount: 10,
      },
      {
        material: "Metal",
        amount: 5,
      },
      {
        material: "Zaza",
        amount: 2,
      },
    ],
    output: "Bloons",
    outputAmount: 1,
    price: 90000,
    productionRate: 1,
    productionDuration: 1200,
    maxAmount: 2,
    image: "/assets/game/materials/bloons.png",
  },
  {
    name: "Zaza Grow Pod",
    input: [
      {
        material: "Dust",
        amount: 9,
      },
      {
        material: "H3",
        amount: 3,
      },
    ],
    output: "Zaza",
    outputAmount: 1,
    price: 45000,
    productionRate: 1,
    productionDuration: 420,
    maxAmount: 3,
    image: "/assets/game/materials/zaza.png",
  },
];

const launchPadBlueprint = {
  name: "Launch Pad",
  price: 12000,
  productionRate: 1,
  productionDuration: 60,
  maxAmount: 4,
  image: "/landing_pad.png",
};

const rocketBlueprints: RocketBlueprint[] = [
  {
    name: "Luminous",
    speed: 2380,
    health: 66,
    imageFileName: "luminous.jpg",
    price: 115000,
    type: "SMALL",
    rarity: "COMMON",
    fuelCapacity: 2750,
    cargoCapacity: 130,
  },
  {
    name: "Meteor",
    speed: 2220,
    health: 72,
    imageFileName: "meteor.jpg",
    price: 125000,
    type: "SMALL",
    rarity: "COMMON",
    fuelCapacity: 2500,
    cargoCapacity: 165,
  },
  {
    name: "Ethereal",
    speed: 2320,
    health: 76,
    imageFileName: "ethereal.jpg",
    price: 350000,
    type: "MEDIUM",
    rarity: "COMMON",
    fuelCapacity: 4300,
    cargoCapacity: 335,
  },
  {
    name: "Mirage",
    speed: 2550,
    health: 79,
    imageFileName: "mirage.jpg",
    price: 455000,
    type: "MEDIUM",
    rarity: "COMMON",
    fuelCapacity: 4500,
    cargoCapacity: 325,
  },
  {
    name: "Pinnacle",
    speed: 2600,
    health: 77,
    imageFileName: "pinnacle.jpg",
    price: 430000,
    type: "MEDIUM",
    rarity: "COMMON",
    fuelCapacity: 4250,
    cargoCapacity: 345,
  },
  {
    name: "Nimbus",
    speed: 2650,
    health: 74,
    imageFileName: "nimbus.jpg",
    price: 410000,
    type: "MEDIUM",
    rarity: "COMMON",
    fuelCapacity: 4100,
    cargoCapacity: 310,
  },
  {
    name: "Stratus",
    speed: 2700,
    health: 76,
    imageFileName: "stratus.jpg",
    price: 390000,
    type: "MEDIUM",
    rarity: "COMMON",
    fuelCapacity: 3950,
    cargoCapacity: 300,
  },
  {
    name: "Nebulous",
    speed: 1960,
    health: 86,
    imageFileName: "nebulous.jpg",
    price: 280000,
    type: "SMALL",
    rarity: "EPIC",
    fuelCapacity: 3650,
    cargoCapacity: 255,
  },
  {
    name: "Zenith",
    speed: 2100,
    health: 85,
    imageFileName: "zenith.jpg",
    price: 620000,
    type: "MEDIUM",
    rarity: "EPIC",
    fuelCapacity: 5700,
    cargoCapacity: 490,
  },
  {
    name: "Hyperion",
    speed: 2130,
    health: 81,
    imageFileName: "hyperion.jpg",
    price: 650000,
    type: "MEDIUM",
    rarity: "EPIC",
    fuelCapacity: 5600,
    cargoCapacity: 470,
  },
  {
    name: "Polaris",
    speed: 2150,
    health: 82,
    imageFileName: "polaris.jpg",
    price: 640000,
    type: "MEDIUM",
    rarity: "EPIC",
    fuelCapacity: 5500,
    cargoCapacity: 480,
  },
  {
    name: "Odyssey",
    speed: 2480,
    health: 70,
    imageFileName: "odyssey.jpg",
    price: 240000,
    type: "SMALL",
    rarity: "EPIC",
    fuelCapacity: 3150,
    cargoCapacity: 205,
  },
  {
    name: "Andromeda",
    speed: 2615,
    health: 83,
    imageFileName: "andromeda.jpg",
    price: 700000,
    type: "MEDIUM",
    rarity: "EPIC",
    fuelCapacity: 5900,
    cargoCapacity: 505,
  },
  {
    name: "Goliath",
    speed: 2800,
    health: 75,
    imageFileName: "goliath.jpg",
    price: 1250000,
    type: "LARGE",
    rarity: "EPIC",
    fuelCapacity: 7500,
    cargoCapacity: 690,
  },
  {
    name: "Excalibur",
    speed: 2875,
    health: 71,
    imageFileName: "excalibur.jpg",
    price: 1040000,
    type: "LARGE",
    rarity: "EPIC",
    fuelCapacity: 6400,
    cargoCapacity: 545,
  },
  {
    name: "Phantom",
    speed: 2900,
    health: 73,
    imageFileName: "phantom.jpg",
    price: 1070000,
    type: "LARGE",
    rarity: "EPIC",
    fuelCapacity: 6300,
    cargoCapacity: 560,
  },
  {
    name: "Quasar",
    speed: 2050,
    health: 92,
    imageFileName: "quasar.jpg",
    price: 380000,
    type: "SMALL",
    rarity: "LEGENDARY",
    fuelCapacity: 3850,
    cargoCapacity: 285,
  },
  {
    name: "Horizon",
    speed: 2000,
    health: 90,
    imageFileName: "horizon.jpg",
    price: 780000,
    type: "MEDIUM",
    rarity: "LEGENDARY",
    fuelCapacity: 6100,
    cargoCapacity: 540,
  },
  {
    name: "Helios",
    speed: 2600,
    health: 67,
    imageFileName: "helios.jpg",
    price: 340000,
    type: "SMALL",
    rarity: "LEGENDARY",
    fuelCapacity: 3450,
    cargoCapacity: 185,
  },
  {
    name: "Colossus",
    speed: 2400,
    health: 92,
    imageFileName: "colossus.jpg",
    price: 1600000,
    type: "LARGE",
    rarity: "LEGENDARY",
    fuelCapacity: 9300,
    cargoCapacity: 820,
  },
  {
    name: "Celestial",
    speed: 2425,
    health: 88,
    imageFileName: "celestial.jpg",
    price: 1450000,
    type: "LARGE",
    rarity: "LEGENDARY",
    fuelCapacity: 8650,
    cargoCapacity: 780,
  },
  {
    name: "Specter",
    speed: 2435,
    health: 87,
    imageFileName: "specter.jpg",
    price: 1350000,
    type: "LARGE",
    rarity: "LEGENDARY",
    fuelCapacity: 8400,
    cargoCapacity: 730,
  },
  {
    name: "Tornado",
    speed: 2450,
    health: 89,
    imageFileName: "tornado.jpg",
    price: 1500000,
    type: "LARGE",
    rarity: "LEGENDARY",
    fuelCapacity: 9000,
    cargoCapacity: 790,
  },
  {
    name: "Stellar",
    speed: 2915,
    health: 95,
    imageFileName: "stellar.jpg",
    price: 1420000,
    type: "LARGE",
    rarity: "LEGENDARY",
    fuelCapacity: 8300,
    cargoCapacity: 735,
  },
  {
    name: "Infinity",
    speed: 2300,
    health: 68,
    imageFileName: "infinity.jpg",
    price: 205000,
    type: "SMALL",
    rarity: "RARE",
    fuelCapacity: 3100,
    cargoCapacity: 175,
  },
  {
    name: "Cosmos",
    speed: 2400,
    health: 68,
    imageFileName: "cosmos.jpg",
    price: 185000,
    type: "SMALL",
    rarity: "RARE",
    fuelCapacity: 2950,
    cargoCapacity: 165,
  },
  {
    name: "Vortex",
    speed: 2450,
    health: 66,
    imageFileName: "vortex.jpg",
    price: 170000,
    type: "SMALL",
    rarity: "RARE",
    fuelCapacity: 2850,
    cargoCapacity: 145,
  },
  {
    name: "Cirrus",
    speed: 2500,
    health: 78,
    imageFileName: "cirrus.jpg",
    price: 520000,
    type: "MEDIUM",
    rarity: "RARE",
    fuelCapacity: 4800,
    cargoCapacity: 370,
  },
  {
    name: "Trident",
    speed: 2925,
    health: 72,
    imageFileName: "trident.jpg",
    price: 980000,
    type: "LARGE",
    rarity: "RARE",
    fuelCapacity: 6150,
    cargoCapacity: 520,
  },
  {
    name: "Titan",
    speed: 2950,
    health: 70,
    imageFileName: "titan.jpg",
    price: 900000,
    type: "LARGE",
    rarity: "RARE",
    fuelCapacity: 5900,
    cargoCapacity: 500,
  },
];

export const MAX_ROCKET_FUEL_CAPACITY = Math.max(
  ...rocketBlueprints.map((rocket) =>
    Math.floor(rocket.fuelCapacity * (1 + (MAX_ROCKET_UPGRADE - 1) * 0.08)),
  ),
);

let gameContentPromise: Promise<void> | null = null;
const playerStatePromises = new Map<string, Promise<void>>();

export async function ensureGameContent(db: GameDb) {
  gameContentPromise ??= ensureGameContentInternal(db).catch((error) => {
    gameContentPromise = null;
    throw error;
  });

  return gameContentPromise;
}

async function ensureGameContentInternal(db: GameDb) {
  await ensureMaterialCatalog(db);

  const materials = await db.material.findMany();
  const materialByName = new Map(
    materials.map((material) => [material.name, material]),
  );

  await ensureRocketCatalog(db);

  for (const blueprint of producerBlueprints) {
    const existingBuilding = await db.building.findFirst({
      where: {
        name: blueprint.name,
      },
    });

    const outputMaterial = materialByName.get(blueprint.output);

    if (!outputMaterial) {
      continue;
    }

    if (existingBuilding) {
      for (const input of blueprint.input ?? []) {
        const inputMaterial = materialByName.get(input.material);

        if (!inputMaterial) {
          continue;
        }

        const existingInput = await db.cargo.findFirst({
          where: {
            materialId: inputMaterial.id,
            buildingInput: {
              some: {
                id: existingBuilding.id,
              },
            },
          },
        });

        if (existingInput) {
          if (existingInput.amount !== input.amount) {
            await db.cargo.update({
              where: {
                id: existingInput.id,
              },
              data: {
                amount: input.amount,
              },
            });
          }
        } else {
          await db.building.update({
            where: {
              id: existingBuilding.id,
            },
            data: {
              reqInput: {
                create: {
                  amount: input.amount,
                  material: {
                    connect: {
                      id: inputMaterial.id,
                    },
                  },
                },
              },
            },
          });
        }
      }

      await db.building.update({
        where: {
          id: existingBuilding.id,
        },
        data: {
          image: existingBuilding.image ?? blueprint.image,
          price: blueprint.price,
          productionRate: blueprint.productionRate,
          productionDuration: blueprint.productionDuration,
          maxAmount: blueprint.maxAmount,
        },
      });

      const hasOutput = await db.building.findFirst({
        where: {
          id: existingBuilding.id,
          recOutput: {
            some: {
              materialId: outputMaterial.id,
            },
          },
        },
      });

      if (hasOutput) {
        const existingOutput = await db.cargo.findFirst({
          where: {
            materialId: outputMaterial.id,
            buildingOutput: {
              some: {
                id: existingBuilding.id,
              },
            },
          },
        });

        if (
          existingOutput &&
          existingOutput.amount !== blueprint.outputAmount
        ) {
          await db.cargo.update({
            where: {
              id: existingOutput.id,
            },
            data: {
              amount: blueprint.outputAmount,
            },
          });
        }
      } else {
        await db.building.update({
          where: {
            id: existingBuilding.id,
          },
          data: {
            recOutput: {
              create: {
                amount: blueprint.outputAmount,
                material: {
                  connect: {
                    id: outputMaterial.id,
                  },
                },
              },
            },
          },
        });
      }

      continue;
    }

    await db.building.create({
      data: {
        name: blueprint.name,
        image: blueprint.image,
        price: blueprint.price,
        productionRate: blueprint.productionRate,
        productionDuration: blueprint.productionDuration,
        maxAmount: blueprint.maxAmount,
        reqInput: blueprint.input
          ? {
              create: blueprint.input
                .map((input) => {
                  const inputMaterial = materialByName.get(input.material);

                  if (!inputMaterial) {
                    return null;
                  }

                  return {
                    amount: input.amount,
                    material: {
                      connect: {
                        id: inputMaterial.id,
                      },
                    },
                  };
                })
                .filter((input): input is NonNullable<typeof input> =>
                  Boolean(input),
                ),
            }
          : undefined,
        recOutput: {
          create: {
            amount: blueprint.outputAmount,
            material: {
              connect: {
                id: outputMaterial.id,
              },
            },
          },
        },
      },
    });
  }

  const existingLaunchPad = await db.building.findFirst({
    where: {
      name: launchPadBlueprint.name,
    },
  });

  if (existingLaunchPad) {
    await db.building.update({
      where: {
        id: existingLaunchPad.id,
      },
      data: {
        image: existingLaunchPad.image ?? launchPadBlueprint.image,
        maxAmount: launchPadBlueprint.maxAmount,
        price: launchPadBlueprint.price,
        productionRate: launchPadBlueprint.productionRate,
        productionDuration: launchPadBlueprint.productionDuration,
      },
    });
  } else {
    await db.building.create({
      data: launchPadBlueprint,
    });
  }
}

async function ensureMaterialCatalog(db: GameDb) {
  const [existingRarities, existingMaterialTypes] = await Promise.all([
    db.rarity.findMany(),
    db.materialType.findMany(),
  ]);
  const rarityByName = new Map(
    existingRarities.map((rarity) => [rarity.name.toUpperCase(), rarity]),
  );
  const materialTypeByName = new Map(
    existingMaterialTypes.map((type) => [type.name.toUpperCase(), type]),
  );

  for (const rarityName of new Set(
    materialBlueprints.map((material) => material.rarity),
  )) {
    if (!rarityByName.has(rarityName)) {
      const rarity = await db.rarity.create({
        data: {
          name: rarityName,
        },
      });
      rarityByName.set(rarityName, rarity);
    }
  }

  for (const typeName of new Set(
    materialBlueprints.map((material) => material.type),
  )) {
    if (!materialTypeByName.has(typeName)) {
      const materialType = await db.materialType.create({
        data: {
          name: typeName,
        },
      });
      materialTypeByName.set(typeName, materialType);
    }
  }

  for (const blueprint of materialBlueprints) {
    const rarity = rarityByName.get(blueprint.rarity);
    const materialType = materialTypeByName.get(blueprint.type);

    if (!rarity || !materialType) {
      continue;
    }

    const existingMaterial = await db.material.findFirst({
      where: {
        name: blueprint.name,
      },
    });

    if (existingMaterial) {
      await db.material.update({
        where: {
          id: existingMaterial.id,
        },
        data: {
          image: existingMaterial.image ?? blueprint.image,
          materialId: materialType.id,
          rarityId: rarity.id,
          weight: blueprint.weight,
        },
      });
      continue;
    }

    await db.material.create({
      data: {
        name: blueprint.name,
        image: blueprint.image,
        materialId: materialType.id,
        rarityId: rarity.id,
        weight: blueprint.weight,
      },
    });
  }
}

function getRocketImagePath(imageFileName: string) {
  const imageBaseName = imageFileName.replace(/\.[^.]+$/, "");

  return `/assets/game/rockets/${imageBaseName}.png`;
}

async function ensureRocketCatalog(db: GameDb) {
  const [existingRarities, existingRocketTypes] = await Promise.all([
    db.rarity.findMany(),
    db.rocketType.findMany(),
  ]);
  const rarityByName = new Map(
    existingRarities.map((rarity) => [rarity.name.toUpperCase(), rarity]),
  );
  const rocketTypeByName = new Map(
    existingRocketTypes.map((type) => [type.name.toUpperCase(), type]),
  );

  for (const rarityName of new Set(
    rocketBlueprints.map((rocket) => rocket.rarity),
  )) {
    if (!rarityByName.has(rarityName)) {
      const rarity = await db.rarity.create({
        data: {
          name: rarityName,
        },
      });
      rarityByName.set(rarityName, rarity);
    }
  }

  for (const typeName of new Set(
    rocketBlueprints.map((rocket) => rocket.type),
  )) {
    if (!rocketTypeByName.has(typeName)) {
      const rocketType = await db.rocketType.create({
        data: {
          name: typeName,
        },
      });
      rocketTypeByName.set(typeName, rocketType);
    }
  }

  for (const blueprint of rocketBlueprints) {
    const rarity = rarityByName.get(blueprint.rarity);
    const rocketType = rocketTypeByName.get(blueprint.type);

    if (!rarity || !rocketType) {
      continue;
    }

    const image = getRocketImagePath(blueprint.imageFileName);
    const existingRocket = await db.rocket.findFirst({
      where: {
        name: blueprint.name,
      },
    });

    if (existingRocket) {
      await db.rocket.update({
        where: {
          id: existingRocket.id,
        },
        data: {
          speed: blueprint.speed,
          health: blueprint.health,
          image,
          price: blueprint.price,
          rocketId: rocketType.id,
          rarityId: rarity.id,
          fuelCapacity: blueprint.fuelCapacity,
          cargoCapacity: blueprint.cargoCapacity,
          status: "AVAILABLE",
        },
      });
      continue;
    }

    await db.rocket.create({
      data: {
        name: blueprint.name,
        speed: blueprint.speed,
        health: blueprint.health,
        image,
        price: blueprint.price,
        rocketId: rocketType.id,
        rarityId: rarity.id,
        fuelCapacity: blueprint.fuelCapacity,
        cargoCapacity: blueprint.cargoCapacity,
        status: "AVAILABLE",
      },
    });
  }
}

export async function ensurePlayerState(db: GameDb, userId: string) {
  const existingPromise = playerStatePromises.get(userId);

  if (existingPromise) {
    return existingPromise;
  }

  const promise = ensurePlayerStateInternal(db, userId).catch((error) => {
    playerStatePromises.delete(userId);
    throw error;
  });
  playerStatePromises.set(userId, promise);

  return promise;
}

async function ensurePlayerStateInternal(db: GameDb, userId: string) {
  await ensureGameContent(db);

  const [
    materials,
    existingCargo,
    existingBuildings,
    existingRockets,
    existingLocations,
  ] = await Promise.all([
    db.material.findMany(),
    db.cargo.findMany({
      where: {
        userId,
        questId: null,
        rocketId: null,
      },
    }),
    db.userBuilding.findMany({
      where: {
        userId,
      },
    }),
    db.userRocket.findMany({
      where: {
        userId,
      },
    }),
    db.location.findMany({
      where: {
        userId,
      },
    }),
  ]);
  const existingCargoByMaterialId = new Map(
    existingCargo.map((cargo) => [cargo.materialId, cargo]),
  );
  const existingCargoCount = existingCargo.length;
  const starterAmounts = new Map([
    ["Rhoons", 12000],
    ["Dust", 80],
    ["H3", 20],
    ["Concrete", 8],
    ["Metal", 4],
    ["Bloons", 2],
    ["Zaza", 1],
  ]);

  for (const material of materials) {
    if (existingCargoByMaterialId.has(material.id)) {
      continue;
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
            id: material.id,
          },
        },
        amount:
          existingCargoCount === 0 ? starterAmounts.get(material.name) ?? 0 : 0,
      },
    });
  }

  const existingBuildingById = new Map(
    existingBuildings.map((userBuilding) => [
      userBuilding.buildingId,
      userBuilding,
    ]),
  );
  const starterBuildings = await db.building.findMany({
    where: {
      name: {
        in: ["Dust Collector", "Fuel Generator", "Launch Pad"],
      },
    },
  });

  for (const building of starterBuildings) {
    const existingUserBuilding = existingBuildingById.get(building.id);

    if (existingUserBuilding) {
      if (existingUserBuilding.amount <= 0) {
        await db.userBuilding.update({
          where: {
            id: existingUserBuilding.id,
          },
          data: {
            amount: 1,
          },
        });
      }

      continue;
    }

    await db.userBuilding.create({
      data: {
        user: {
          connect: {
            id: userId,
          },
        },
        building: {
          connect: {
            id: building.id,
          },
        },
        amount: 1,
      },
    });
  }

  if (existingRockets.length === 0) {
    const starterRocket = await db.rocket.findFirst({
      orderBy: {
        price: "asc",
      },
    });

    if (starterRocket) {
      await db.userRocket.create({
        data: {
          user: {
            connect: {
              id: userId,
            },
          },
          rocket: {
            connect: {
              id: starterRocket.id,
            },
          },
        },
      });
    }
  }

  if (existingLocations.length === 0) {
    await db.location.create({
      data: {
        userId,
        name: "Alpha Haven",
        texture: "redy.png",
        xLoc: -34,
        yLoc: 12,
        zLoc: -44,
      },
    });
  }
}
