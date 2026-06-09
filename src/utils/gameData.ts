export type TradeMaterialName =
  | "Rhoons"
  | "Concrete"
  | "H3"
  | "Metal"
  | "Bloons"
  | "Dust"
  | "Zaza";

export type PlanetDefinition = {
  id: string;
  name: string;
  texture: string;
  xLoc: number;
  yLoc: number;
  zLoc: number;
  character: {
    name: string;
    image: string;
  };
  buys: TradeMaterialName[];
  sells: TradeMaterialName[];
  focus: string;
  cadence: string;
};

export const HOME_PLANET_ID = "haven";

export const planetRoster: PlanetDefinition[] = [
  {
    id: HOME_PLANET_ID,
    name: "Alpha Haven",
    texture: "redy.png",
    xLoc: -34,
    yLoc: 12,
    zLoc: -44,
    character: {
      name: "Nekko",
      image: "/assets/game/characters/nekko_talk.gif",
    },
    buys: ["Dust", "H3"],
    sells: [],
    focus: "home industry and launch prep",
    cadence: "steady",
  },
  {
    id: "elbako",
    name: "Elbako Exchange",
    texture: "elbako.png",
    xLoc: -84,
    yLoc: 22,
    zLoc: 64,
    character: {
      name: "Pakko",
      image: "/assets/game/characters/pakko_talk.gif",
    },
    buys: ["Dust", "Concrete", "Metal"],
    sells: ["Concrete", "Metal", "Bloons"],
    focus: "hull patches and dusty station filters",
    cadence: "busy",
  },
  {
    id: "zaza-store",
    name: "Zaza Store",
    texture: "greeny.png",
    xLoc: -67,
    yLoc: 35,
    zLoc: -69,
    character: {
      name: "Mira",
      image: "/assets/game/characters/nekko_talk.gif",
    },
    buys: ["Zaza", "Bloons", "H3"],
    sells: ["Zaza", "Bloons"],
    focus: "rare snacks and reactor pods",
    cadence: "impatient",
  },
  {
    id: "ais-crew",
    name: "AIS Crew",
    texture: "orangy.png",
    xLoc: 69,
    yLoc: -16,
    zLoc: 82,
    character: {
      name: "Sol",
      image: "/assets/game/characters/pakko_talk.gif",
    },
    buys: ["Metal", "H3", "Dust"],
    sells: ["H3", "Metal", "Concrete"],
    focus: "probe repairs and launch burns",
    cadence: "precise",
  },
  {
    id: "blacky",
    name: "Blacky Port",
    texture: "blacky.png",
    xLoc: 22,
    yLoc: 16,
    zLoc: -58,
    character: {
      name: "Vex",
      image: "/assets/game/characters/nekko_talk.gif",
    },
    buys: ["Concrete", "Bloons", "Metal"],
    sells: ["Metal", "Zaza"],
    focus: "cold storage and pressure shells",
    cadence: "quiet",
  },
  {
    id: "earth",
    name: "Old Earth",
    texture: "earthy.png",
    xLoc: -22,
    yLoc: 40,
    zLoc: -92,
    character: {
      name: "Tara",
      image: "/assets/game/characters/pakko_talk.gif",
    },
    buys: ["Dust", "Zaza", "Concrete"],
    sells: ["Concrete", "Dust", "Zaza"],
    focus: "museum domes and garden rigs",
    cadence: "formal",
  },
  {
    id: "pinky",
    name: "Pinky Ring",
    texture: "pinky.png",
    xLoc: 82,
    yLoc: 26,
    zLoc: -72,
    character: {
      name: "Kip",
      image: "/assets/game/characters/nekko_talk.gif",
    },
    buys: ["Bloons", "H3", "Zaza"],
    sells: ["Bloons", "Zaza", "H3"],
    focus: "festival balloons and fast fuel",
    cadence: "loud",
  },
];

export function getPlanetById(id: string | undefined) {
  const fallbackPlanet = planetRoster[0];

  if (!fallbackPlanet) {
    throw new Error("Planet roster is empty.");
  }

  return planetRoster.find((planet) => planet.id === id) ?? fallbackPlanet;
}

export function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}
