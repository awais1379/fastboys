import * as React from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

type FormState = {
  monFriOpen: string;
  monFriClose: string;
  satOpen: string;
  satClose: string;
  sunClosed: boolean;
  sunOpen: string; // only used if not closed
  sunClose: string; // only used if not closed
  slotDuration: number; // multiples of 30
};

const DEFAULT: FormState = {
  monFriOpen: "09:00",
  monFriClose: "18:00",
  satOpen: "10:00",
  satClose: "16:00",
  sunClosed: true,
  sunOpen: "10:00",
  sunClose: "16:00",
  slotDuration: 60,
};

const DURATION_OPTIONS = [30, 60, 90, 120, 150, 180];

export default function SettingsPage() {
  const [form, setForm] = React.useState<FormState>(DEFAULT);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ref = React.useMemo(() => doc(db, "settings", "default"), []);

  // Load settings from Firestore on mount
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as Partial<FormState> & {
            slotDuration?: number;
          };
          // Backward/defensive defaults
          const next: FormState = {
            monFriOpen: data.monFriOpen ?? DEFAULT.monFriOpen,
            monFriClose: data.monFriClose ?? DEFAULT.monFriClose,
            satOpen: data.satOpen ?? DEFAULT.satOpen,
            satClose: data.satClose ?? DEFAULT.satClose,
            sunClosed: data.sunClosed ?? DEFAULT.sunClosed,
            sunOpen: data.sunOpen ?? DEFAULT.sunOpen,
            sunClose: data.sunClose ?? DEFAULT.sunClose,
            slotDuration:
              (data.slotDuration as number) ??
              data.slotDuration ??
              DEFAULT.slotDuration,
          };
          if (mounted) setForm(next);
        }
      } catch (e: any) {
        console.error(e);
        if (mounted) setError("Failed to load settings.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [ref]);

  const update = (key: keyof FormState, value: string | number | boolean) =>
    setForm((f) => ({ ...f, [key]: value as any }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // guard: keep duration to multiples of 30 just in case
      if (form.slotDuration % 30 !== 0) {
        throw new Error("Slot duration must be a multiple of 30.");
      }

      // Build the exact Firestore payload (flat + readable)
      const payload: any = {
        slotDuration: form.slotDuration,
        monFriOpen: form.monFriOpen,
        monFriClose: form.monFriClose,
        satOpen: form.satOpen,
        satClose: form.satClose,
        sunClosed: form.sunClosed,
        updatedAt: serverTimestamp(),
      };

      if (!form.sunClosed) {
        payload.sunOpen = form.sunOpen;
        payload.sunClose = form.sunClose;
      } else {
        // if closed, ensure old fields are cleared (optional)
        payload.sunOpen = null;
        payload.sunClose = null;
      }

      await setDoc(ref, payload, { merge: true });
      alert("Settings saved.");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to save settings.");
      alert("Failed to save. Check console.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Settings (Availability)</h2>
        <div className="text-sm text-gray-400">Loading…</div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Settings (Availability)</h2>

      {error && (
        <div className="rounded-md border border-red-800 bg-red-950/40 text-red-200 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Hours card */}
        <div className="rounded-xl border border-gray-800 p-4 space-y-4">
          <h3 className="font-medium">Hours</h3>

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

          <div className="space-y-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.sunClosed}
                onChange={(e) => update("sunClosed", e.target.checked)}
              />
              Sunday closed
            </label>

            {!form.sunClosed && (
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

        {/* Slot duration card */}
        <div className="rounded-xl border border-gray-800 p-4 space-y-4 h-fit">
          <h3 className="font-medium">Slot Duration</h3>
          <label className="text-sm block">
            Duration (minutes)
            <select
              value={form.slotDuration}
              onChange={(e) => update("slotDuration", Number(e.target.value))}
              className="mt-1 w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-2 text-sm"
            >
              {DURATION_OPTIONS.map((min) => (
                <option key={min} value={min}>
                  {min} minutes
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-gray-500">
            Must be a multiple of 30 minutes.
          </p>
        </div>
      </div>

      <div>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-md bg-red-600 text-white text-sm hover:bg-red-500 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </section>
  );
}
