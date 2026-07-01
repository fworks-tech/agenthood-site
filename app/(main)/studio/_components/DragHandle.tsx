"use client";

import { useCallback, useRef, useEffect } from "react";

interface DragHandleProps {
  direction: "horizontal" | "vertical";
  onDrag: (delta: number) => void;
  className?: string;
}

export default function DragHandle({ direction, onDrag, className = "" }: DragHandleProps) {
  const dragging = useRef(false);
  const startPos = useRef(0);

  const isHorizontal = direction === "horizontal";

  const startDrag = useCallback((clientX: number, clientY: number) => {
    dragging.current = true;
    startPos.current = isHorizontal ? clientX : clientY;
    document.body.style.cursor = isHorizontal ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  }, [isHorizontal]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startDrag(e.clientX, e.clientY);
  }, [startDrag]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);
  }, [startDrag]);

  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (!dragging.current) return;
      const current = isHorizontal ? clientX : clientY;
      const delta = current - startPos.current;
      startPos.current = current;
      onDrag(delta);
    };

    const handleEnd = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      if (!dragging.current) return;
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleEnd);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleEnd);
    };
  }, [direction, onDrag, isHorizontal]);

  return (
    <div
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className={`group relative z-30 flex items-center justify-center shrink-0 ${
        isHorizontal ? "w-2.5 sm:w-1.5 cursor-col-resize" : "h-2.5 sm:h-1.5 cursor-row-resize"
      } ${className}`}
      aria-hidden
    >
      <div
        className={`transition-colors ${
          isHorizontal ? "h-8 w-px" : "h-px w-8"
        } bg-zinc-700 group-hover:bg-emerald-500 group-active:bg-emerald-400`}
      />
    </div>
  );
}
