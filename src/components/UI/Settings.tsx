import React from "react";
import { SpeakerWaveIcon, SparklesIcon, ViewColumnsIcon } from "@heroicons/react/24/solid";

type SettingsState = {
  sound: boolean;
  motion: boolean;
  compact: boolean;
};

const STORAGE_KEY = "space-haven-settings";

const defaultSettings: SettingsState = {
  sound: true,
  motion: true,
  compact: false,
};

const Settings = () => {
  const [settings, setSettings] = React.useState<SettingsState>(defaultSettings);

  React.useEffect(() => {
    const storedSettings = window.localStorage.getItem(STORAGE_KEY);

    if (!storedSettings) {
      document.documentElement.dataset.motion = defaultSettings.motion ? "on" : "off";
      document.documentElement.dataset.compact = defaultSettings.compact ? "on" : "off";
      return;
    }

    try {
      const nextSettings = {
        ...defaultSettings,
        ...(JSON.parse(storedSettings) as SettingsState),
      };
      setSettings(nextSettings);
      document.documentElement.dataset.motion = nextSettings.motion ? "on" : "off";
      document.documentElement.dataset.compact = nextSettings.compact ? "on" : "off";
    } catch {
      setSettings(defaultSettings);
      document.documentElement.dataset.motion = defaultSettings.motion ? "on" : "off";
      document.documentElement.dataset.compact = defaultSettings.compact ? "on" : "off";
    }
  }, []);

  const updateSetting = (key: keyof SettingsState, value: boolean) => {
    setSettings((currentSettings) => {
      const nextSettings = {
        ...currentSettings,
        [key]: value,
      };

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
      document.documentElement.dataset.motion = nextSettings.motion ? "on" : "off";
      document.documentElement.dataset.compact = nextSettings.compact ? "on" : "off";

      return nextSettings;
    });
  };

  return (
    <div className="grid w-full gap-5">
      <header>
        <p className="text-xs uppercase tracking-wide text-teal-300">System</p>
        <h2 className="text-2xl font-black">Settings</h2>
      </header>

      <section className="grid gap-3">
        <ToggleRow
          icon={<SpeakerWaveIcon className="h-5 w-5" />}
          label="Sound"
          checked={settings.sound}
          onChange={(checked) => updateSetting("sound", checked)}
        />
        <ToggleRow
          icon={<SparklesIcon className="h-5 w-5" />}
          label="Motion"
          checked={settings.motion}
          onChange={(checked) => updateSetting("motion", checked)}
        />
        <ToggleRow
          icon={<ViewColumnsIcon className="h-5 w-5" />}
          label="Compact UI"
          checked={settings.compact}
          onChange={(checked) => updateSetting("compact", checked)}
        />
      </section>
    </div>
  );
};

const ToggleRow = ({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <label className="flex items-center justify-between gap-4 rounded border border-slate-700 bg-slate-900/85 p-3">
    <span className="flex items-center gap-3 text-sm font-bold">
      <span className="text-slate-400">{icon}</span>
      {label}
    </span>
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="h-5 w-5 accent-teal-400"
    />
  </label>
);

export default Settings;
