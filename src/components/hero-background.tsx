"use client";

import { useEffect, useRef } from "react";

export function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const draw = () => {
      time += 0.003;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Create gradient orbs with enhanced visibility
      const orbs = [
        { x: 0.2, y: 0.3, r: 400, color: "rgba(0, 210, 211, 0.28)" },
        { x: 0.8, y: 0.6, r: 350, color: "rgba(147, 51, 234, 0.22)" },
        { x: 0.5, y: 0.8, r: 300, color: "rgba(0, 210, 211, 0.18)" },
        { x: 0.1, y: 0.7, r: 250, color: "rgba(147, 51, 234, 0.15)" },
      ];

      orbs.forEach((orb, i) => {
        const offsetX = Math.sin(time + i * 1.5) * 50;
        const offsetY = Math.cos(time + i * 2) * 30;

        const gradient = ctx.createRadialGradient(
          orb.x * canvas.width + offsetX,
          orb.y * canvas.height + offsetY,
          0,
          orb.x * canvas.width + offsetX,
          orb.y * canvas.height + offsetY,
          orb.r
        );

        gradient.addColorStop(0, orb.color);
        gradient.addColorStop(1, "transparent");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      });

      animationId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 -z-10 opacity-85"
      style={{ filter: "blur(80px)" }}
    />
  );
}

export function GridPattern() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, transparent 0%, var(--background) 70%)`,
        }}
      />
    </div>
  );
}

export function FloatingIcons() {
  const icons = [
    { icon: "⚡", x: "10%", y: "20%", delay: "0s", size: "text-2xl" },
    { icon: "🔌", x: "85%", y: "15%", delay: "1s", size: "text-3xl" },
    { icon: "🤖", x: "75%", y: "70%", delay: "2s", size: "text-2xl" },
    { icon: "📦", x: "15%", y: "75%", delay: "0.5s", size: "text-xl" },
    { icon: "🔧", x: "90%", y: "45%", delay: "1.5s", size: "text-xl" },
    { icon: "💾", x: "5%", y: "50%", delay: "2.5s", size: "text-2xl" },
  ];

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
      {icons.map((item, i) => (
        <div
          key={i}
          className={`absolute ${item.size} opacity-35 animate-float`}
          style={{
            left: item.x,
            top: item.y,
            animationDelay: item.delay,
            animationDuration: "6s",
          }}
        >
          {item.icon}
        </div>
      ))}
    </div>
  );
}
