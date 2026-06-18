"use client";

import { useState, useEffect, useRef } from "react";

export default function Home() {
  const [flashTime, setFlashTime] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleFlash() {
    setFlashTime(Date.now());
    setDistance(null);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 0.1), 100);
  }

  function handleThunder() {
    if (timerRef.current) clearInterval(timerRef.current);
    setFlashTime((ft) => {
      if (ft) setDistance((Date.now() - ft) / 1000 / 5);
      return null;
    });
  }

  function openCamera() {
    fileInputRef.current?.click();
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPhoto(URL.createObjectURL(file));
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const waiting = flashTime !== null;

  return (
    <main
      style={{
        minHeight: "100dvh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0F172A",
        color: "white",
        padding: "24px",
        boxSizing: "border-box",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>StormSense</h1>
        <p style={{ color: "#94A3B8", marginTop: 6, marginBottom: 40 }}>
          Know your storm. Know your move.
        </p>

        {/* live timer while waiting for thunder */}
        {waiting && (
          <p style={{ fontSize: 56, fontWeight: 700, margin: "0 0 32px" }}>
            {seconds.toFixed(1)}s
          </p>
        )}

        {/* distance result */}
        {distance !== null && (
          <div style={{ marginBottom: 32 }}>
            <p style={{ color: "#94A3B8", margin: 0 }}>Lightning is about</p>
            <p style={{ fontSize: 56, fontWeight: 700, color: "#FACC15", margin: "4px 0" }}>
              {distance.toFixed(1)} mi
            </p>
            <p style={{ color: "#94A3B8", margin: 0 }}>away</p>
          </div>
        )}

        {/* captured surroundings photo */}
        {photo && (
          <img
            src={photo}
            alt="surroundings"
            style={{ width: "100%", borderRadius: 18, marginBottom: 20, border: "2px solid #334155" }}
          />
        )}

        {/* hidden camera input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          onChange={handlePhoto}
          style={{ display: "none" }}
        />

        {/* BUTTON LOGIC: flash -> thunder -> camera */}
        {!waiting && distance === null && (
          <button onClick={handleFlash} style={btnStyle("#FACC15", "#0F172A")}>
            ⚡ I saw the flash
          </button>
        )}

        {waiting && (
          <button onClick={handleThunder} style={btnStyle("#3B82F6", "#FFFFFF")}>
            🔊 I heard the thunder
          </button>
        )}

        {distance !== null && (
          <button onClick={openCamera} style={btnStyle("#FACC15", "#0F172A")}>
            {photo ? "📷 Retake surroundings" : "📷 Capture my surroundings"}
          </button>
        )}
      </div>
    </main>
  );
}

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    width: "100%",
    background: bg,
    color,
    fontWeight: 700,
    fontSize: 18,
    border: "none",
    borderRadius: 18,
    padding: "20px",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  };
}