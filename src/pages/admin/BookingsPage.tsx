import * as React from "react";

export default function BookingsPage() {
  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Bookings</h2>
        <button
          className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm hover:bg-red-500"
          onClick={() => alert("TODO: table + filters")}
        >
          Refresh
        </button>
      </header>

      <div className="rounded-xl border border-gray-800 p-4">
        <p className="text-sm text-gray-400">
          Placeholder for the bookings table (date/time, service, customer,
          status) with cancel/reschedule actions.
        </p>
      </div>
    </section>
  );
}
