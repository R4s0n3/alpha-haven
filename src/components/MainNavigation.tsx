// Navigation.tsx
import React, { useState, Suspense } from "react";
import Modal from "./Modal";
import {
  ArchiveBoxXMarkIcon,
  BuildingOffice2Icon,
  BuildingStorefrontIcon,
  ClipboardDocumentListIcon,
  GlobeAltIcon,
  RocketLaunchIcon,
  UserGroupIcon,
  WrenchIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import Buildings from "./UI/Buildings";
import Guild from "./UI/Guild";
import Inventory from "./UI/Inventory";
import Map from "./UI/Map";
import Quests from "./UI/Quests";
import Rockets from "./UI/Rockets";
import Settings from "./UI/Settings";
import Shop from "./UI/Shop";

const componentNames = [
  "Buildings",
  "Shop",
  "Quests",
  "Rockets",
  "Inventory",
  "Map",
  "Guild",
  "Settings",
];
const components: Record<string, React.ComponentType> = {
  Buildings,
  Guild,
  Inventory,
  Map,
  Quests,
  Rockets,
  Settings,
  Shop,
};

const panelComponents: Record<
  string,
  React.ComponentType<{ variant?: "compact" }>
> = {
  Buildings,
};

function MainNavigation() {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const handleButtonClick = (componentName: string) => {
    setSelectedName((currentName) =>
      currentName === componentName ? null : componentName,
    );
  };
  const SelectedComponent = selectedName
    ? components[selectedName] ?? null
    : null;
  const PanelComponent = selectedName
    ? panelComponents[selectedName] ?? null
    : null;

  return (
    <>
      <div className="fixed bottom-4 z-50 flex max-w-[calc(100vw-1rem)] flex-row gap-2 overflow-x-auto rounded border border-slate-700 bg-slate-950/95 p-2 shadow-2xl ring-1 ring-black/40 backdrop-blur-md">
        {componentNames.map((name) => (
          <button
            className={`aspect-square h-12 shrink-0 rounded border p-3 text-white shadow-sm transition hover:border-teal-300 ${
              selectedName === name
                ? "border-teal-300 bg-teal-500/20"
                : "border-slate-700 bg-slate-900"
            }`}
            key={name}
            title={name}
            aria-label={name}
            onClick={() => handleButtonClick(name)}
          >
            {renderIcon(name)}
          </button>
        ))}
        {SelectedComponent && !PanelComponent && (
          <Modal onClose={() => setSelectedName(null)}>
            <Suspense fallback={<div>Loading...</div>}>
              <SelectedComponent />
            </Suspense>
          </Modal>
        )}
      </div>

      {PanelComponent && (
        <aside className="fixed left-3 top-[15rem] z-40 max-h-[42vh] w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded border border-slate-700 bg-slate-950/95 shadow-2xl ring-1 ring-black/40 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[0.65rem] uppercase tracking-wide text-teal-300">
                Home Industry
              </p>
              <h2 className="truncate text-base font-black text-slate-100">
                Buildings
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedName(null)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-700 bg-slate-900 text-slate-200"
              aria-label="Close buildings"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[calc(42vh-3.25rem)] overflow-y-auto p-3 text-slate-100">
            <Suspense fallback={<div>Loading...</div>}>
              <PanelComponent variant="compact" />
            </Suspense>
          </div>
        </aside>
      )}
    </>
  );
}

export default MainNavigation;

function renderIcon(name: string): React.JSX.Element {
  switch (name) {
    case "Map":
      return <GlobeAltIcon className="h-6 w-6 text-white" />;
    case "Quests":
      return <ClipboardDocumentListIcon className="h-6 w-6 text-white" />;

    case "Shop":
      return <BuildingStorefrontIcon className="h-6 w-6 text-white" />;
    case "Rockets":
      return <RocketLaunchIcon className="h-6 w-6 text-white" />;
    case "Buildings":
      return <BuildingOffice2Icon className="h-6 w-6 text-white" />;
    case "Settings":
      return <WrenchIcon className="h-6 w-6 text-white" />;
    case "Guild":
      return <UserGroupIcon className="h-6 w-6 text-white" />;
    default:
      return <ArchiveBoxXMarkIcon className="h-6 w-6 text-white" />;
  }
}
