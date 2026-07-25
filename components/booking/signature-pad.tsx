"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Finger / mouse / stylus signature pad. Writes a PNG data URL into a hidden
 * input named `signatureImage` for the booking form submit.
 */
export function SignaturePad({
  required = false,
  label = "Draw your signature",
}: {
  required?: boolean;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [dataUrl, setDataUrl] = useState("");
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      const width = Math.max(280, parent?.clientWidth ?? 320);
      const height = 140;
      const prev = canvas.toDataURL("image/png");
      canvas.width = width * 2;
      canvas.height = height * 2;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(2, 2);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1f1726";
      ctx.lineWidth = 2.2;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      if (hasInk && prev.startsWith("data:image")) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, width, height);
        img.src = prev;
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount sizing only
  }, []);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawing.current = true;
    canvas.setPointerCapture(e.pointerId);
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    setDataUrl(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const width = canvas.width / 2;
    const height = canvas.height / 2;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    setHasInk(false);
    setDataUrl("");
  }

  // Capture final stroke on pointer up before validating submit.
  useEffect(() => {
    if (!hasInk) return;
    const canvas = canvasRef.current;
    if (canvas) setDataUrl(canvas.toDataURL("image/png"));
  }, [hasInk]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">
          {label}
          {required && <span className="text-red-400"> *</span>}
        </p>
        <button
          type="button"
          onClick={clear}
          className="text-xs font-medium text-ink-soft underline-offset-2 hover:underline"
        >
          Clear
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-edge bg-white touch-none">
        <canvas
          ref={canvasRef}
          className="block w-full cursor-crosshair"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
        />
      </div>
      <input
        type="hidden"
        name="signatureImage"
        value={dataUrl}
        required={required}
      />
      {!hasInk && required && (
        <p className="text-xs text-ink-faint">Sign above with your finger or mouse.</p>
      )}
    </div>
  );
}
