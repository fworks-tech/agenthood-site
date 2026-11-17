"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  onVisible?: () => void;
}

export default function FadeIn({ children, delay = 0, className = "", onVisible }: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (rect.top < window.innerHeight || reduceMotion) {
      onVisible?.();
      return;
    }

    // Hide only after hydration, while the section is still off-screen, so SSR
    // and no-JS users always see content and the slide-up never blinks
    // already-visible text.
    el.classList.add("opacity-0");

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.remove("opacity-0");
          setAnimated(true);
          onVisible?.();
          obs.disconnect();
        } else if (entry.boundingClientRect.bottom < 0) {
          // Jumped past (anchor link, fast scroll): reveal without animation.
          el.classList.remove("opacity-0");
          onVisible?.();
          obs.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      el.classList.remove("opacity-0");
    };
  }, [onVisible]);

  return (
    <div
      ref={ref}
      className={`${animated ? "animate-[slide-up_0.5s_ease-out_forwards]" : ""} ${className}`}
      style={animated && delay > 0 ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
