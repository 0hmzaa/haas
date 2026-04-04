"use client";

import { useState, type ReactNode } from "react";

type Tab = {
  label: string;
  content: ReactNode;
};

type TabGroupProps = {
  tabs: Tab[];
};

export function TabGroup({ tabs }: TabGroupProps) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div className="flex border-b-2 border-[var(--color-border-strong)]">
        {tabs.map((tab, index) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setActive(index)}
            className={`px-5 py-3 text-sm font-bold transition ${
              active === index
                ? "border-b-2 border-[var(--color-primary)] text-[var(--color-text)] -mb-[2px]"
                : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pt-8">{tabs[active]?.content}</div>
    </div>
  );
}
