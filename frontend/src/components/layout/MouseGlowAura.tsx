"use client";

import React, { useEffect, useState } from "react";

export const MouseGlowAura: React.FC = () => {
  const [position, setPosition] = useState({ x: -200, y: -200 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div
      className="pointer-events-none fixed z-30 transition-transform duration-75 ease-out opacity-40 hidden sm:block"
      style={{
        left: 0,
        top: 0,
        transform: `translate3d(${position.x - 250}px, ${position.y - 250}px, 0)`,
        width: "500px",
        height: "500px",
        background: "radial-gradient(circle, rgba(0, 240, 255, 0.08) 0%, rgba(0, 255, 157, 0.05) 35%, transparent 70%)",
        filter: "blur(40px)",
      }}
    />
  );
};
