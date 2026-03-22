"use client";

import { useRef, useEffect, useState, type ReactNode } from "react";

interface AnimateOnScrollProps {
  animation?: string;
  delay?: number;
  className?: string;
  children: ReactNode;
}

export function AnimateOnScroll({
  animation = "animate-slide-up",
  delay = 0,
  className = "",
  children,
}: AnimateOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced motion
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${visible ? animation : ""} ${className}`}
      style={{
        opacity: visible ? undefined : 0,
        animationDelay: delay > 0 ? `${delay}ms` : undefined,
      }}
    >
      {children}
    </div>
  );
}
