"use client";

import { useState } from "react";

type CodeBlockProps = {
  code: string;
  language?: string;
};

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative border-2 border-[var(--color-border-strong)] bg-[#f5f5f5]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-1.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)]">
          {language ?? "code"}
        </span>
        <button
          type="button"
          onClick={copy}
          className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)] hover:text-[var(--color-text)]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-[var(--color-text)]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
