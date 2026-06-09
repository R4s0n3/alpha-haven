import Image from "next/image";
import React from "react";
import millify from "millify";
import {
  ArrowLongRightIcon,
  BuildingStorefrontIcon,
  RocketLaunchIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
} from "@heroicons/react/24/solid";

import LoadingSpinner from "@/components/LoadingSpinner";
import MaterialIcon from "@/components/MaterialIcon";
import { api, type RouterOutputs } from "@/utils/api";

type ShopBuilding = NonNullable<RouterOutputs["building"]["getAll"]>[number];
type ShopRocket = RouterOutputs["fleet"]["getFleet"][number];
type ShopMaterialOffer = RouterOutputs["shop"]["getMaterialOffers"][number];
type BloonPackage = RouterOutputs["shop"]["getBloonPackages"][number];
type ShopSection = "exchange" | "buildings" | "rockets";

const Shop = () => {
  const utils = api.useContext();
  const buildings = api.building.getAll.useQuery();
  const userBuildings = api.building.getUserBuildings.useQuery();
  const fleet = api.fleet.getFleet.useQuery();
  const inventory = api.user.getInventory.useQuery(undefined, {
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
  const bloonPackages = api.shop.getBloonPackages.useQuery();
  const materialOffers = api.shop.getMaterialOffers.useQuery();
  const [notice, setNotice] = React.useState<string | null>(null);
  const [activeSection, setActiveSection] =
    React.useState<ShopSection>("exchange");

  const purchaseBuilding = api.building.purchaseBuilding.useMutation({
    onSuccess: (result) => {
      setNotice(result.message);
      void Promise.all([
        utils.building.getUserBuildings.invalidate(),
        utils.user.getInventory.invalidate(),
      ]);
    },
    onError: (error) => setNotice(error.message),
  });
  const exchangeMaterial = api.shop.exchangeMaterial.useMutation({
    onSuccess: (result) => {
      setNotice(result.message);
      void utils.user.getInventory.invalidate();
    },
    onError: (error) => setNotice(error.message),
  });
  const purchaseRocket = api.fleet.purchaseRocket.useMutation({
    onSuccess: (result) => {
      setNotice(result.message);
      void Promise.all([
        utils.fleet.getFleet.invalidate(),
        utils.fleet.getLaunchOptions.invalidate(),
        utils.user.getInventory.invalidate(),
        utils.user.getOverview.invalidate(),
      ]);
    },
    onError: (error) => setNotice(error.message),
  });
  const createBloonCheckoutSession =
    api.shop.createBloonCheckoutSession.useMutation({
      onSuccess: (result) => {
        window.location.assign(result.checkoutUrl);
      },
      onError: (error) => setNotice(error.message),
    });

  const ownedAmountByBuildingId = React.useMemo(() => {
    const map = new Map<string, number>();
    userBuildings.data?.forEach((userBuilding) => {
      map.set(userBuilding.buildingId, userBuilding.amount);
    });
    return map;
  }, [userBuildings.data]);
  const rhoonsBalance = inventory.data?.rhoons?.amount ?? 0;
  const bloonsBalance =
    inventory.data?.cargo.find((cargo) => cargo.material.name === "Bloons")
      ?.amount ?? 0;

  if (
    buildings.isLoading ||
    userBuildings.isLoading ||
    fleet.isLoading ||
    inventory.isLoading ||
    bloonPackages.isLoading ||
    materialOffers.isLoading
  ) {
    return <LoadingSpinner />;
  }

  return (
    <div className="grid w-full gap-5">
      <header>
        <p className="text-xs uppercase tracking-wide text-teal-300">Market</p>
        <h2 className="text-2xl font-black">Shop</h2>
      </header>

      {notice && (
        <div className="bg-teal-500/15 rounded border border-teal-500/50 px-3 py-2 text-sm text-teal-100">
          {notice}
        </div>
      )}

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-700 pb-2">
          <ShopTab
            label="Material Exchange"
            isActive={activeSection === "exchange"}
            onClick={() => setActiveSection("exchange")}
          />
          <ShopTab
            label="Buildings"
            isActive={activeSection === "buildings"}
            onClick={() => setActiveSection("buildings")}
          />
          <ShopTab
            label="Rockets"
            isActive={activeSection === "rockets"}
            onClick={() => setActiveSection("rockets")}
          />
        </div>

        {activeSection === "exchange" && (
          <div className="grid gap-3">
            <SectionTitle
              title="Material Exchange"
              subtitle="Paid with Bloons"
            />
            <div className="grid gap-3 md:grid-cols-2">
              {materialOffers.data?.map((offer) => (
                <MaterialExchangeItem
                  key={offer.id}
                  offer={offer}
                  isExchanging={exchangeMaterial.isLoading}
                  canAfford={bloonsBalance >= offer.costBloons}
                  onExchange={() =>
                    exchangeMaterial.mutate({
                      offerId: offer.id,
                    })
                  }
                />
              ))}
            </div>
          </div>
        )}

        {activeSection === "buildings" && (
          <div className="grid gap-3">
            <SectionTitle title="Buildings" subtitle="Paid with Rhoons" />
            <div className="grid gap-3 md:grid-cols-2">
              {buildings.data?.map((building) => (
                <ShopItem
                  key={building.id}
                  building={building}
                  ownedAmount={ownedAmountByBuildingId.get(building.id) ?? 0}
                  isBuying={purchaseBuilding.isLoading}
                  canAfford={rhoonsBalance >= building.price}
                  onBuy={() => purchaseBuilding.mutate({ id: building.id })}
                />
              ))}
            </div>
          </div>
        )}

        {activeSection === "rockets" && (
          <div className="grid gap-3">
            <SectionTitle title="Rockets" subtitle="Paid with Rhoons" />
            <div className="grid gap-3 md:grid-cols-2">
              {fleet.data?.map((rocket) => (
                <RocketShopItem
                  key={rocket.id}
                  rocket={rocket}
                  isBuying={purchaseRocket.isLoading}
                  canAfford={rhoonsBalance >= rocket.price}
                  onBuy={() => purchaseRocket.mutate({ rocketId: rocket.id })}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-3">
        <SectionTitle title="Bloons Packages" subtitle="Always available" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {bloonPackages.data?.map((bloonPackage) => (
            <BloonPackageItem
              key={bloonPackage.id}
              bloonPackage={bloonPackage}
              isPurchasing={createBloonCheckoutSession.isLoading}
              onBuy={() =>
                createBloonCheckoutSession.mutate({
                  packageId: bloonPackage.id,
                })
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
};

type ShopItemProps = {
  building: ShopBuilding;
  ownedAmount: number;
  isBuying: boolean;
  canAfford: boolean;
  onBuy: () => void;
};

const ShopTab = ({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded border px-3 py-2 text-xs font-black uppercase tracking-wide transition ${
      isActive
        ? "border-teal-300 bg-teal-500 text-slate-950"
        : "border-slate-700 bg-slate-900 text-slate-300 hover:border-teal-300"
    }`}
  >
    {label}
  </button>
);

const BloonPackageItem = ({
  bloonPackage,
  isPurchasing,
  onBuy,
}: {
  bloonPackage: BloonPackage;
  isPurchasing: boolean;
  onBuy: () => void;
}) => (
  <article className="bg-slate-900/85 grid gap-3 rounded border border-slate-700 p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-teal-300">
          {bloonPackage.bonusLabel ?? "Bloons"}
        </p>
        <h3 className="truncate text-lg font-bold">{bloonPackage.name}</h3>
      </div>
      <span className="shrink-0 rounded border border-rose-300 bg-rose-500 px-2 py-1 text-sm font-black text-white">
        {bloonPackage.priceLabel}
      </span>
    </div>

    <MaterialIcon
      id={bloonPackage.material.id}
      amount={bloonPackage.bloons}
      image={bloonPackage.material.image ?? undefined}
      label="Get Bloons"
    />

    <button
      type="button"
      disabled={isPurchasing}
      onClick={onBuy}
      className="flex items-center justify-center gap-2 rounded border border-teal-300 bg-teal-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:border-slate-600 disabled:bg-slate-700 disabled:text-slate-300"
    >
      <ShoppingBagIcon className="h-4 w-4" />
      Checkout
    </button>
  </article>
);

const ShopItem = ({
  building,
  ownedAmount,
  isBuying,
  canAfford,
  onBuy,
}: ShopItemProps) => {
  const isMaxed = ownedAmount >= building.maxAmount;
  const isUnavailable = isBuying || isMaxed || !canAfford;

  return (
    <article
      className={`grid gap-3 rounded border p-3 transition ${
        isMaxed
          ? "bg-slate-900/45 border-slate-800 opacity-60 grayscale"
          : "bg-slate-900/85 border-slate-700"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded border border-slate-700 bg-slate-950">
          {building.image ? (
            <Image
              className="object-cover"
              src={building.image}
              fill
              sizes="80px"
              alt={building.name}
            />
          ) : (
            <BuildingStorefrontIcon className="h-full w-full p-4 text-slate-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold">{building.name}</h3>
          <p className="text-sm text-slate-400">
            {millify(building.price)} Rhoons · {ownedAmount}/
            {building.maxAmount} owned
          </p>
        </div>
      </div>

      <BuildingProductionFlow building={building} />

      <button
        type="button"
        disabled={isUnavailable}
        onClick={onBuy}
        className="rounded border border-teal-300 bg-teal-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:border-slate-600 disabled:bg-slate-700 disabled:text-slate-300"
      >
        {isMaxed
          ? "Max Owned"
          : canAfford
            ? "Buy with Rhoons"
            : "Not Enough Rhoons"}
      </button>
    </article>
  );
};

const RocketShopItem = ({
  rocket,
  isBuying,
  canAfford,
  onBuy,
}: {
  rocket: ShopRocket;
  isBuying: boolean;
  canAfford: boolean;
  onBuy: () => void;
}) => {
  const isUnavailable = rocket.owned || isBuying || !canAfford;

  return (
    <article
      className={`grid gap-3 rounded border p-3 transition ${
        rocket.owned
          ? "bg-slate-900/45 border-slate-800 opacity-60 grayscale"
          : "bg-slate-900/85 border-slate-700"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded border border-slate-700 bg-slate-950">
          {rocket.image ? (
            <Image
              src={rocket.image}
              alt={rocket.name}
              fill
              sizes="80px"
              className="object-contain"
            />
          ) : (
            <RocketLaunchIcon className="h-full w-full p-4 text-slate-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold">{rocket.name}</h3>
          <p className="text-sm text-slate-400">
            {rocket.owned
              ? `Owned · Mk ${rocket.upgrade}`
              : `${millify(rocket.price)} Rhoons`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <RocketMetric label="Speed" value={millify(rocket.speed)} />
        <RocketMetric label="Cargo" value={millify(rocket.cargoCapacity)} />
        <RocketMetric label="Fuel" value={millify(rocket.fuelCapacity)} />
      </div>

      <button
        type="button"
        disabled={isUnavailable}
        onClick={onBuy}
        className="flex items-center justify-center gap-2 rounded border border-teal-300 bg-teal-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:border-slate-600 disabled:bg-slate-700 disabled:text-slate-300"
      >
        <ShoppingCartIcon className="h-4 w-4" />
        {rocket.owned
          ? "Owned"
          : canAfford
            ? "Buy with Rhoons"
            : "Not Enough Rhoons"}
      </button>
    </article>
  );
};

const RocketMetric = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className="rounded bg-slate-950/70 p-3">
    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
    <p className="font-bold text-slate-100">{value}</p>
  </div>
);

const BuildingProductionFlow = ({ building }: { building: ShopBuilding }) => (
  <div className="bg-slate-950/45 rounded border border-slate-800 p-2">
    <div className="building-flow grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(4.5rem,5rem)_auto_minmax(0,1fr)] sm:items-center">
      <FlowMaterials label="Input">
        {building.reqInput.length > 0 ? (
          building.reqInput.map((input) => (
            <MaterialIcon
              key={input.material.id}
              id={input.material.id}
              amount={input.amount * building.productionRate}
              image={input.material.image ?? undefined}
              label={input.material.name}
            />
          ))
        ) : (
          <FlowEmpty label="No input" />
        )}
      </FlowMaterials>

      <FlowArrow tone="input" />

      <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded border border-slate-700 bg-slate-900 shadow-inner">
        <span className="building-flow__pulse" aria-hidden="true" />
        {building.image ? (
          <Image
            className="rounded object-cover"
            src={building.image}
            fill
            sizes="64px"
            alt=""
          />
        ) : (
          <BuildingStorefrontIcon className="h-full w-full p-4 text-slate-600" />
        )}
      </div>

      <FlowArrow tone="output" />

      <FlowMaterials label="Output">
        {building.recOutput.length > 0 ? (
          building.recOutput.map((output) => (
            <MaterialIcon
              key={output.material.id}
              id={output.material.id}
              amount={output.amount * building.productionRate}
              image={output.material.image ?? undefined}
              label={output.material.name}
            />
          ))
        ) : (
          <FlowEmpty label="Utility" />
        )}
      </FlowMaterials>
    </div>
  </div>
);

const FlowMaterials = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="grid min-w-0 gap-1.5">
    <p className="text-[0.65rem] font-black uppercase leading-3 tracking-wide text-slate-500">
      {label}
    </p>
    <div className="grid grid-cols-1 gap-1.5">{children}</div>
  </div>
);

const FlowEmpty = ({ label }: { label: string }) => (
  <div className="rounded border border-dashed border-slate-700 bg-slate-900/60 px-2 py-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
    {label}
  </div>
);

const FlowArrow = ({ tone }: { tone: "input" | "output" }) => (
  <div className={`building-flow__arrow building-flow__arrow--${tone}`}>
    <span className="building-flow__trail" aria-hidden="true" />
    <ArrowLongRightIcon className="relative z-10 h-6 w-6" aria-hidden="true" />
  </div>
);

const MaterialExchangeItem = ({
  offer,
  isExchanging,
  canAfford,
  onExchange,
}: {
  offer: ShopMaterialOffer;
  isExchanging: boolean;
  canAfford: boolean;
  onExchange: () => void;
}) => (
  <article className="bg-slate-900/85 grid gap-3 rounded border border-slate-700 p-3">
    <div>
      <p className="text-xs uppercase tracking-wide text-teal-300">
        Bloons Exchange
      </p>
      <h3 className="text-lg font-bold">{offer.material.name} Bundle</h3>
    </div>

    <div className="grid grid-cols-2 gap-2">
      <MaterialIcon
        id={offer.costMaterial.id}
        amount={offer.costBloons}
        image={offer.costMaterial.image ?? undefined}
        label="Pay Bloons"
      />
      <MaterialIcon
        id={offer.material.id}
        amount={offer.amount}
        image={offer.material.image ?? undefined}
        label={`Get ${offer.material.name}`}
      />
    </div>

    <button
      type="button"
      disabled={isExchanging || !canAfford}
      onClick={onExchange}
      className="rounded border border-rose-300 bg-rose-500 px-4 py-2 text-sm font-bold text-white disabled:border-slate-600 disabled:bg-slate-700 disabled:text-slate-300"
    >
      {canAfford ? "Exchange" : "Not Enough Bloons"}
    </button>
  </article>
);

const SectionTitle = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) => (
  <div className="flex items-end justify-between gap-3 border-b border-slate-700 pb-2">
    <h3 className="text-sm font-black uppercase tracking-wide text-slate-200">
      {title}
    </h3>
    <span className="text-xs text-slate-400">{subtitle}</span>
  </div>
);

export default Shop;
