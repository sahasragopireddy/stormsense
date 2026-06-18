"use client";

import { useState, useEffect, useRef } from "react";

const DIRECTIONS = ["Facing North ⬆", "Now turn East ➡", "Now turn South ⬇", "Now turn West ⬅"];

export default function Home() {
  const [stage, setStage] = useState<"intro" | "timing" | "result" | "capture">("intro");
  const [flashTime, setFlashTime] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleFlash() {
    setStage("timing");
    setFlashTime(Date.now());
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 0.1), 100);
  }

  function handleThunder() {
    if (timerRef.current) clearInterval(timerRef.current);
    setFlashTime((ft) => {
      if (ft) setDistance((Date.now() - ft) / 1000 / 5);
      return null;
    });
    setStage("result");
  }

  function resetTiming() {
    setDistance(null);
    setSeconds(0);
    setStage("intro");
  }

  function openCamera() {
    fileInputRef.current?.click();
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && photos.length < 4) {
      setPhotos((p) => [...p, URL.createObjectURL(file)]);
    }
    e.target.value = "";
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function risk(d: number) {
    if (d <= 6) return { label: "High risk — take shelter now", color: "#854F0B", bg: "#FBE9C8" };
    if (d <= 10) return { label: "Caution — storm is close", color: "#854F0B", bg: "#FAEEDA" };
    return { label: "Lower risk — stay alert", color: "#185FA5", bg: "#E6F1FB" };
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        width: "100%",
        background: "#EAF2FB",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#0C447C",
        padding: "24px 20px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: 0.5, color: "#185FA5" }}>
          STORMSENSE
        </span>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 420, width: "100%", margin: "0 auto" }}>

        {stage === "intro" && (
          <div style={{ textAlign: "center" }}>
            <div style={iconBadge}><span style={{ fontSize: 32 }}>⚡</span></div>
            <h1 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 6px" }}>Know your storm.</h1>
            <p style={{ fontSize: 15, color: "#185FA5", margin: "0 0 36px" }}>
              When you see lightning, tap below. We&apos;ll measure how close it is.
            </p>
            <button onClick={handleFlash} style={primaryBtn}>I saw the flash</button>
          </div>
        )}

        {stage === "timing" && (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 15, color: "#185FA5", margin: "0 0 8px" }}>Listening for thunder…</p>
            <div style={{ fontSize: 72, fontWeight: 600, lineHeight: 1, margin: "0 0 36px" }}>
              {seconds.toFixed(1)}<span style={{ fontSize: 24 }}>s</span>
            </div>
            <button onClick={handleThunder} style={{ ...primaryBtn, background: "#378ADD", color: "#fff" }}>
              I heard the thunder
            </button>
          </div>
        )}

        {stage === "result" && distance !== null && (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "#185FA5", margin: 0 }}>lightning is about</p>
            <div style={{ fontSize: 72, fontWeight: 600, lineHeight: 1, margin: "4px 0" }}>
              {distance.toFixed(1)}
            </div>
            <p style={{ fontSize: 15, color: "#185FA5", margin: "0 0 16px" }}>miles away</p>
            <div style={{ display: "inline-block", background: risk(distance).bg, color: risk(distance).color, fontSize: 13, fontWeight: 600, padding: "7px 18px", borderRadius: 20, marginBottom: 32 }}>
              {risk(distance).label}
            </div>
            <button onClick={() => setStage("capture")} style={primaryBtn}>Capture my surroundings</button>
            <button onClick={resetTiming} style={textBtn}>Measure again</button>
          </div>
        )}

        {stage === "capture" && (
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 4px" }}>Show us around you</h2>
            <p style={{ fontSize: 14, color: "#185FA5", margin: "0 0 20px" }}>
              {photos.length < 4 ? DIRECTIONS[photos.length] : "All four captured!"}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 14,
                    background: photos[i] ? "transparent" : "#D7E6F7",
                    border: photos[i] ? "none" : "2px dashed #A9C9EC",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {photos[i] ? (
                    <img src={photos[i]} alt={`view ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: 22, color: "#A9C9EC" }}>{i + 1}</span>
                  )}
                </div>
              ))}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhoto}
              style={{ display: "none" }}
            />

            {photos.length < 4 ? (
              <button onClick={openCamera} style={primaryBtn}>
                📷 Take photo {photos.length + 1} of 4
              </button>
            ) : (
              <button onClick={() => alert("Next: AI analyzes your surroundings")} style={{ ...primaryBtn, background: "#1D9E75", color: "#fff" }}>
                Get my safety plan →
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 16 }}>
        <p style={{ fontSize: 13, color: "#185FA5", margin: 0 }}>
          In an emergency, call your local emergency number
        </p>
      </div>
    </main>
  );
}

const iconBadge: React.CSSProperties = {
  width: 64, height: 64, borderRadius: "50%", background: "#FBE9C8",
  display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
};

const primaryBtn: React.CSSProperties = {
  width: "100%", background: "#EF9F27", color: "#412402", border: "none",
  borderRadius: 16, padding: "16px 0", fontSize: 16, fontWeight: 600, cursor: "pointer",
  WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
};

const textBtn: React.CSSProperties = {
  width: "100%", background: "transparent", color: "#185FA5", border: "none",
  padding: "14px 0", fontSize: 14, fontWeight: 500, cursor: "pointer", marginTop: 4,
};