"use client";

import { useState } from "react";

interface HelpTipProps {
  text: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

export default function HelpTip({ text, side = "top", className = "" }: HelpTipProps) {
  const [show, setShow] = useState(false);

  const sideStyles: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
  };

  return (
    <span
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      onClick={(e) => {
        e.stopPropagation();
        setShow((p) => !p);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setShow(false);
      }}
      tabIndex={0}
      role="button"
      aria-label={`Help: ${text}`}
    >
      <span className="cursor-help z-50 rounded-full border border-zinc-700 px-1.5 text-[10px] leading-4 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors select-none">
        ?
      </span>
      {show && (
        <span
          className={`absolute z-50 w-64 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs  text-zinc-200 shadow-xl ${
            sideStyles[side]
          }`}
          style={{ pointerEvents: "none" }}
          role="tooltip"
        >
          {text}
        </span>
      )}
    </span>
  );
}
