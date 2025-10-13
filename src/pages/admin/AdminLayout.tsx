import * as React from "react";
import { NavLink, Outlet } from "react-router-dom";

const linkBase =
  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition";
const linkInactive = "text-gray-400 hover:text-white hover:bg-gray-800/60";
const linkActive = "text-white bg-gray-800";

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-black text-gray-200">
      <header className="flex items-center justify-between px-6 h-14 border-b border-gray-800">
        <h1 className="text-lg font-semibold">Garage Admin</h1>
        <span className="text-xs text-gray-500">v0.1</span>
      </header>

      <div className="grid grid-cols-[220px_1fr]">
        <aside className="h-[calc(100vh-56px)] border-r border-gray-800 p-3">
          <nav className="space-y-1">
            <NavLink
              to="bookings"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkInactive}`
              }
            >
              <span>📘</span> Bookings
            </NavLink>

            <NavLink
              to="settings"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkInactive}`
              }
            >
              <span>⚙️</span> Settings
            </NavLink>
          </nav>

          <div className="mt-6 text-xs text-gray-500">
            URL-only for now. Auth later.
          </div>
        </aside>

        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
