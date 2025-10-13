import * as React from "react";

// We'll always use Toronto for this shop.
const SHOP_TIMEZONE = "America/Toronto";

type Hours = {
  monFriOpen: string;
  monFriClose: string;
  satOpen: string;
  satClose: string;
  sundayClosed: boolean;
  sunOpen: string; // used only when sundayClosed === false
  sunClose: string; // used only when sundayClosed === false
  slotDurationMinutes: number;
};

const DEFAULT: Hours = {
  monFriOpen: "09:00",
  monFriClose: "18:00",
  satOpen: "10:00",
  satClose: "16:00",
  sundayClosed: true,
  sunOpen: "10:00",
  sunClose: "16:00",
  slotDurationMinutes: 60,
};

export default function SettingsPage() {
  const [form, setForm] = React.useState<Hours>(DEFAULT);

  const update = (key: keyof Hours, value: string | number | boolean) =>
    setForm((f) => ({ ...f, [key]: value as any }));

  const save = () => {
    // Build the object we'd persist later (Firestore payload shape).
    const payload = {
      timezone: SHOP_TIMEZONE, // fixed
      slotDurationMinutes: form.slotDurationMinutes,
      hours: {
        monFri: { open: form.monFriOpen, close: form.monFriClose },
        sat: { open: form.satOpen, close: form.satClose },
        sun: form.sundayClosed
          ? { closed: true as const }
          : { open: form.sunOpen, close: form.sunClose },
      },
    };

    console.log("Saving settings (mock):", payload);
    alert("Saved (mock). Next step: persist to Firestore (settings/default).");
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Settings (Availability)</h2>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Hours card */}
        <div className="rounded-xl border border-gray-800 p-4 space-y-4">
          <h3 className="font-medium">Hours</h3>

          {/* Mon–Fri */}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Mon–Fri Open
              <input
                type="time"
                value={form.monFriOpen}
                onChange={(e) => update("monFriOpen", e.target.value)}
                className="mt-1 w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-sm"
              />
            </label>

            <label className="text-sm">
              Mon–Fri Close
              <input
                type="time"
                value={form.monFriClose}
                onChange={(e) => update("monFriClose", e.target.value)}
                className="mt-1 w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-sm"
              />
            </label>

            {/* Saturday */}
            <label className="text-sm">
              Sat Open
              <input
                type="time"
                value={form.satOpen}
                onChange={(e) => update("satOpen", e.target.value)}
                className="mt-1 w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-sm"
              />
            </label>

            <label className="text-sm">
              Sat Close
              <input
                type="time"
                value={form.satClose}
                onChange={(e) => update("satClose", e.target.value)}
                className="mt-1 w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-sm"
              />
            </label>
          </div>

          {/* Sunday toggle + conditional inputs */}
          <div className="space-y-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.sundayClosed}
                onChange={(e) => update("sundayClosed", e.target.checked)}
              />
              Sunday closed
            </label>

            {!form.sundayClosed && (
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  Sun Open
                  <input
                    type="time"
                    value={form.sunOpen}
                    onChange={(e) => update("sunOpen", e.target.value)}
                    className="mt-1 w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-sm"
                  />
                </label>
                <label className="text-sm">
                  Sun Close
                  <input
                    type="time"
                    value={form.sunClose}
                    onChange={(e) => update("sunClose", e.target.value)}
                    className="mt-1 w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-sm"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Slot + timezone card */}
        <div className="rounded-xl border border-gray-800 p-4 space-y-4">
          <h3 className="font-medium">Slot & Timezone</h3>

          <label className="text-sm block">
            Slot Duration (minutes)
            <input
              type="number"
              min={15}
              step={15}
              value={form.slotDurationMinutes}
              onChange={(e) =>
                update("slotDurationMinutes", Number(e.target.value))
              }
              className="mt-1 w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-sm"
            />
          </label>

          <div className="text-sm">
            <div className="text-gray-400">Timezone</div>
            <div className="mt-1 rounded-md bg-gray-900 border border-gray-800 px-3 py-2">
              {SHOP_TIMEZONE}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Timezone is fixed for this garage.
            </p>
          </div>
        </div>
      </div>

      <div>
        <button
          onClick={save}
          className="px-4 py-2 rounded-md bg-red-600 text-white text-sm hover:bg-red-500"
        >
          Save Settings
        </button>
      </div>
    </section>
  );
}
