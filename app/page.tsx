"use client";

import { useState, useEffect, useRef } from "react";

const DIRECTIONS = ["Facing North ⬆", "Now turn East ➡", "Now turn South ⬇", "Now turn West ⬅"];

type Plan = {
  riskLevel: string;
  hazards: string[];
  steps: string[];
  reasoning: string;
  shelters: { name: string; direction: string; note: string }[];
};

export default function Home() {
  const [stage, setStage] = useState<"intro" | "listening" | "capture" | "loading" | "plan">("intro");
  const [distance, setDistance] = useState<number | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [error, setError] = useState("");
  const [micError, setMicError] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [locLoading, setLocLoading] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const flashTimeRef = useRef<number | null>(null);

  // 30/30 timer
  const [clearSeconds, setClearSeconds] = useState(30 * 60);
  const [clearStarted, setClearStarted] = useState(false);
  const clearRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startClearTimer() {
    setClearSeconds(30 * 60);
    setClearStarted(true);
    if (clearRef.current) clearInterval(clearRef.current);
    clearRef.current = setInterval(() => {
      setClearSeconds((s) => { if (s <= 1) { clearInterval(clearRef.current!); return 0; } return s - 1; });
    }, 1000);
  }
  function resetClearTimer() {
    setClearSeconds(30 * 60);
    if (clearRef.current) clearInterval(clearRef.current);
    clearRef.current = setInterval(() => {
      setClearSeconds((s) => { if (s <= 1) { clearInterval(clearRef.current!); return 0; } return s - 1; });
    }, 1000);
  }
  const clearDone = clearStarted && clearSeconds === 0;
  const clearMM = Math.floor(clearSeconds / 60).toString().padStart(2, "0");
  const clearSS = (clearSeconds % 60).toString().padStart(2, "0");

  // Read aloud
  const [speaking, setSpeaking] = useState(false);
  function handleReadAloud() {
    if (!plan) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const stepsText = plan.steps.map((s, i) => `Step ${i + 1}: ${s}`).join(". ");
    const text = `Risk level: ${plan.riskLevel}. ${stepsText}. ${plan.reasoning}`;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.92;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }

  function stopListening() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (audioCtxRef.current) audioCtxRef.current.close();
    rafRef.current = null; streamRef.current = null; audioCtxRef.current = null; analyserRef.current = null;
  }

  function onThunderDetected() {
    stopListening();
    const ft = flashTimeRef.current;
    if (ft) setDistance((Date.now() - ft) / 1000 / 5);
    startClearTimer();
    setStage("capture");
  }

  async function handleFlash() {
    setMicError("");
    flashTimeRef.current = Date.now();
    setStage("listening");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      let calibrating = true;
      const ambientSamples: number[] = [];
      setTimeout(() => { calibrating = false; }, 1500);
      function detect() {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        if (calibrating) { ambientSamples.push(avg); }
        else {
          const ambient = ambientSamples.length ? ambientSamples.reduce((a, b) => a + b, 0) / ambientSamples.length : 20;
          const threshold = Math.max(ambient * 1.3, 15);
          if (avg > threshold) { onThunderDetected(); return; }
        }
        rafRef.current = requestAnimationFrame(detect);
      }
      rafRef.current = requestAnimationFrame(detect);
    } catch { setMicError("Microphone access denied. Tap below when you hear thunder."); }
  }

  function requestLocation() {
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
          const d = await r.json();
          const label = d.address?.city || d.address?.town || d.address?.suburb || d.address?.county || "your area";
          setLocation({ lat, lng, label });
        } catch {
          setLocation({ lat, lng, label: "your area" });
        }
        setLocLoading(false);
      },
      () => { setLocLoading(false); }
    );
  }

  function resetAll() {
    stopListening();
    setDistance(null); flashTimeRef.current = null;
    setPhotos([]); setPlan(null); setChecked([]); setError(""); setMicError("");
    setClearStarted(false); setClearSeconds(30 * 60);
    if (clearRef.current) clearInterval(clearRef.current);
    window.speechSynthesis.cancel(); setSpeaking(false);
    setStage("intro");
  }

  function openCamera() { fileInputRef.current?.click(); }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && photos.length < 4) {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxW = 1024;
          const scale = Math.min(1, maxW / img.width);
          const canvas = document.createElement("canvas");
          canvas.width = img.width * scale; canvas.height = img.height * scale;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          setPhotos((p) => [...p, canvas.toDataURL("image/jpeg", 0.8)]);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  }

  async function getPlan() {
    setStage("loading");
    setError("");
    try {
      const locationContext = location
        ? `The user is located at coordinates ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)} in or near ${location.label}.`
        : "The user's location is unknown.";

      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          distance: distance?.toFixed(1),
          photos,
          prompt: `You are a storm safety expert. The user just saw lightning ${distance ? `approximately ${distance.toFixed(1)} miles away` : "nearby"}.
${locationContext}

They have shared ${photos.length} photo(s) of their actual surroundings right now.

RULES:
- Only mention hazards you can ACTUALLY SEE in the photos. No guessing.
- Every action step must reference something visible in their photos.
- If you can't see trees, don't mention trees. Same for water, hills, structures, etc.
- Steps ordered by urgency. Step 1 = most critical action right now.
- For shelters: if location is provided, use your knowledge of that area to suggest 2-3 REAL nearby building types or landmarks they could walk to (e.g. "The library on Main St", "a nearby parking garage", "the brick school building to the north"). Be specific to the location if you know it. If location unknown, suggest generic shelter types.
- reasoning: 1-2 sentences describing exactly what you see in the photos and why it matters.

Return ONLY valid JSON, no markdown:
{
  "riskLevel": "LOW" (no visible storm, lightning far away) | "MODERATE" (storm visible but distant, some shelter nearby) | "HIGH" (storm close, under 6 miles, exposed location) | "EXTREME" (lightning under 3 miles, no shelter visible, open exposed area with tall conductors),
  "hazards": ["only things visible in photos"],
  "steps": ["action based on what you see", "..."],
  "reasoning": "what you see and why",
  "shelters": [
    { "name": "Building name or type", "direction": "e.g. 0.3 mi north", "note": "one short reason it's good shelter" }
  ]
}`
        }),
      });
      if (!res.ok) throw new Error("bad response");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPlan(data);
      setChecked(new Array((data.steps || []).length).fill(false));
      setStage("plan");
    } catch {
      setError("Couldn't generate your plan. Check your connection and try again.");
      setStage("capture");
    }
  }

  useEffect(() => {
    return () => { stopListening(); if (clearRef.current) clearInterval(clearRef.current); };
  }, []);

  function riskColor(level: string) {
    const l = (level || "").toLowerCase();
    if (l === "extreme") return { bg: "#FF2D2D", text: "#fff", glow: "#FF2D2D" };
    if (l === "high") return { bg: "#FF6B00", text: "#fff", glow: "#FF6B00" };
    if (l === "moderate" || l === "caution") return { bg: "#F5C400", text: "#0A0A0A", glow: "#F5C400" };
    return { bg: "#00C853", text: "#fff", glow: "#00C853" };
  }

  function distanceRisk(d: number) {
    if (d <= 6) return { label: "TAKE SHELTER NOW", color: "#FF2D2D" };
    if (d <= 10) return { label: "MOVE INSIDE", color: "#FF6B00" };
    return { label: "STAY ALERT", color: "#F5C400" };
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0A0C10; }
        @keyframes bar { 0%, 100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.35s ease forwards; }
        .pulse-dot { width: 8px; border-radius: 2px; background: #F5C400; animation: bar 1s ease-in-out infinite; }
      `}</style>

      <main style={{
        minHeight: "100dvh", width: "100%", background: "#0A0C10",
        display: "flex", flexDirection: "column",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        color: "#fff", overflowX: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.03em", color: "#fff" }}>STORM</span>
            <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.03em", color: "#F5C400" }}>SENSE</span>
          </div>
          {stage !== "intro" && (
            <button onClick={resetAll} style={{ background: "rgba(255,255,255,0.07)", color: "#888", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", letterSpacing: "0.05em" }}>
              RESET
            </button>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 440, width: "100%", margin: "0 auto", padding: "24px 20px 40px" }}>

          {/* ── INTRO ── */}
          {stage === "intro" && (
            <div className="fade-up">
              <div style={{ marginBottom: 48 }}>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", color: "#555", marginBottom: 16 }}>LIGHTNING SAFETY</div>
                <h1 style={{ fontSize: 42, fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 16 }}>
                  Know your<br /><span style={{ color: "#F5C400" }}>storm.</span>
                </h1>
                <p style={{ fontSize: 16, color: "#666", lineHeight: 1.6 }}>
                  Tap when you see lightning. We detect the thunder automatically, then analyze your surroundings.
                </p>
              </div>

              <div style={{ background: "#13151A", border: "1px solid #1E2028", borderRadius: 16, padding: "16px 18px", marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 3 }}>📍 Share location</div>
                    <div style={{ fontSize: 12, color: "#555" }}>
                      {location ? `📍 ${location.label}` : "For nearby shelter suggestions"}
                    </div>
                  </div>
                  {location ? (
                    <div style={{ background: "#00C853", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700 }}>ON</div>
                  ) : (
                    <button
                      onClick={requestLocation}
                      disabled={locLoading}
                      style={{ background: "#F5C400", color: "#0A0A0A", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 800, cursor: "pointer", letterSpacing: "0.05em" }}
                    >
                      {locLoading ? "…" : "ALLOW"}
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={handleFlash}
                style={{
                  width: "100%", background: "#F5C400", color: "#0A0A0A", border: "none",
                  borderRadius: 16, padding: "20px 0", fontSize: 18, fontWeight: 900,
                  cursor: "pointer", letterSpacing: "-0.01em",
                  boxShadow: "0 0 40px rgba(245,196,0,0.25)",
                }}
              >
                ⚡ I SAW THE FLASH
              </button>
              <p style={{ textAlign: "center", fontSize: 12, color: "#333", marginTop: 16 }}>
                We'll listen for thunder via your microphone
              </p>
            </div>
          )}

          {/* ── LISTENING ── */}
          {stage === "listening" && (
            <div className="fade-up" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", color: "#F5C400", marginBottom: 32 }}>LISTENING</div>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 5, height: 48, marginBottom: 32 }}>
                {[0,1,2,3,4,5,6].map((i) => (
                  <div key={i} className="pulse-dot" style={{ height: `${20 + (i % 3) * 14}px`, animationDelay: `${i * 0.12}s` }} />
                ))}
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 10 }}>Waiting for thunder…</h2>
              <p style={{ fontSize: 15, color: "#555", marginBottom: 40, lineHeight: 1.6 }}>
                Keep your phone out. We'll catch the boom and jump straight to the next step.
              </p>
              {micError && (
                <div style={{ background: "#1A0808", border: "1px solid #FF2D2D", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#FF6B6B" }}>
                  {micError}
                </div>
              )}
              <button onClick={onThunderDetected} style={{ ...solidBtn("#1E2028", "#fff"), marginBottom: 8 }}>
                I heard it — skip
              </button>
              <button onClick={resetAll} style={ghostBtn}>Cancel</button>
            </div>
          )}

          {/* ── CAPTURE ── */}
          {stage === "capture" && (
            <div className="fade-up">
              {distance !== null && (
                <div style={{ marginBottom: 28, textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", color: "#555", marginBottom: 8 }}>LIGHTNING DISTANCE</div>
                  <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.04em" }}>
                    {distance.toFixed(1)}<span style={{ fontSize: 24, color: "#555", fontWeight: 600 }}>mi</span>
                  </div>
                  <div style={{
                    display: "inline-block", marginTop: 10,
                    background: distanceRisk(distance).color, color: "#000",
                    fontSize: 12, fontWeight: 900, padding: "6px 16px", borderRadius: 6, letterSpacing: "0.1em",
                  }}>
                    {distanceRisk(distance).label}
                  </div>
                </div>
              )}

              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#555", marginBottom: 6 }}>
                STEP {Math.min(photos.length + 1, 4)} OF 4 — CAPTURE SURROUNDINGS
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 20 }}>
                {photos.length < 4 ? DIRECTIONS[photos.length] : "All four captured ✓"}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
                {[0,1,2,3].map((i) => (
                  <div key={i} style={{
                    aspectRatio: "1", borderRadius: 12,
                    background: photos[i] ? "transparent" : "#13151A",
                    border: photos[i] ? "none" : "1.5px dashed #2A2D35",
                    overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {photos[i]
                      ? <img src={photos[i]} alt={`view ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 20, color: "#2A2D35", fontWeight: 900 }}>{i + 1}</span>}
                  </div>
                ))}
              </div>

              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />
              {error && <p style={{ color: "#FF6B6B", fontSize: 13, marginBottom: 12 }}>{error}</p>}

              {photos.length < 4 ? (
                <button onClick={openCamera} style={{ ...solidBtn("#F5C400", "#0A0A0A"), letterSpacing: "0.05em" }}>
                  📷 TAKE PHOTO {photos.length + 1} OF 4
                </button>
              ) : (
                <button onClick={getPlan} style={{ ...solidBtn("#fff", "#0A0A0A"), boxShadow: "0 0 30px rgba(255,255,255,0.1)" }}>
                  GET MY SAFETY PLAN →
                </button>
              )}
              <button onClick={resetAll} style={ghostBtn}>Start over</button>
            </div>
          )}

          {/* ── LOADING ── */}
          {stage === "loading" && (
            <div style={{ textAlign: "center" }} className="fade-up">
              <div style={{ fontSize: 48, marginBottom: 20 }}>⚡</div>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", color: "#F5C400", marginBottom: 12 }}>ANALYZING</div>
              <p style={{ fontSize: 16, color: "#555" }}>Reading your surroundings…</p>
            </div>
          )}

          {/* ── PLAN ── */}
          {stage === "plan" && plan && (() => {
            const rc = riskColor(plan.riskLevel);
            return (
              <div className="fade-up">
                <div style={{
                  background: rc.bg, borderRadius: 16, padding: "20px",
                  marginBottom: 16, position: "relative",
                  boxShadow: `0 0 40px ${rc.glow}33`,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: rc.text, opacity: 0.7, marginBottom: 4 }}>RISK LEVEL</div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: rc.text, letterSpacing: "-0.02em" }}>{plan.riskLevel}</div>
                  {distance !== null && <div style={{ fontSize: 13, color: rc.text, opacity: 0.75, marginTop: 2 }}>⚡ {distance.toFixed(1)} mi away</div>}
                  <button onClick={handleReadAloud} style={{
                    position: "absolute", top: 16, right: 16,
                    background: "rgba(0,0,0,0.2)", color: rc.text,
                    border: "none", borderRadius: 8, padding: "6px 12px",
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}>
                    {speaking ? "⏹ STOP" : "🔊 READ"}
                  </button>
                </div>

                <div style={{ fontSize: 11, color: "#333", fontStyle: "italic", marginBottom: 20, paddingLeft: 4 }}>
                  ℹ️ Based on what we can see in your photos — always seek shelter regardless.
                </div>

                {plan.hazards?.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "#555", marginBottom: 10 }}>WHAT WE SEE NEARBY</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {plan.hazards.map((h, i) => (
                        <span key={i} style={{ background: "#1A1208", border: "1px solid #3D2E00", color: "#F5C400", fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 6 }}>
                          ⚠ {h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "#555", marginBottom: 10 }}>YOUR ACTION PLAN</div>
                <div style={{ marginBottom: 24 }}>
                  {plan.steps?.map((s, i) => {
                    const isFirst = i === 0;
                    return (
                      <div
                        key={i}
                        onClick={() => setChecked((c) => c.map((v, idx) => idx === i ? !v : v))}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 14,
                          background: checked[i] ? "#0D1A10" : isFirst ? "#130D00" : "#13151A",
                          borderRadius: 12, padding: isFirst ? "18px 16px" : "14px 16px",
                          marginBottom: 8, cursor: "pointer",
                          border: checked[i] ? "1px solid #1A3D1F" : isFirst ? `2px solid ${rc.bg}` : "1px solid #1E2028",
                        }}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                          background: checked[i] ? "#00C853" : isFirst ? rc.bg : "#1E2028",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: checked[i] ? "#fff" : isFirst ? rc.text : "#555",
                          fontSize: 12, fontWeight: 900, marginTop: 1,
                        }}>
                          {checked[i] ? "✓" : i + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          {isFirst && !checked[i] && (
                            <div style={{ fontSize: 9, fontWeight: 900, color: rc.bg, letterSpacing: "0.15em", marginBottom: 5 }}>DO THIS FIRST</div>
                          )}
                          <span style={{
                            fontSize: isFirst ? 16 : 14, fontWeight: isFirst ? 700 : 500,
                            color: checked[i] ? "#2A4D30" : "#fff",
                            textDecoration: checked[i] ? "line-through" : "none", lineHeight: 1.5,
                          }}>{s}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {plan.shelters?.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "#555", marginBottom: 10 }}>
                      🏛 NEARBY SHELTER{location ? ` — ${location.label.toUpperCase()}` : ""}
                    </div>
                    {plan.shelters.map((sh, i) => (
                      <div key={i} style={{
                        background: "#0D1017", border: "1px solid #1E2028",
                        borderRadius: 12, padding: "14px 16px", marginBottom: 8,
                        display: "flex", alignItems: "flex-start", gap: 12,
                      }}>
                        <div style={{ fontSize: 20, flexShrink: 0 }}>🏛</div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{sh.name}</div>
                          <div style={{ fontSize: 12, color: "#F5C400", fontWeight: 600, marginBottom: 3 }}>{sh.direction}</div>
                          <div style={{ fontSize: 12, color: "#555" }}>{sh.note}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {clearStarted && (
                  <div style={{
                    background: clearDone ? "#0D1A10" : "#130D00",
                    border: `1px solid ${clearDone ? "#1A3D1F" : "#3D2E00"}`,
                    borderRadius: 12, padding: "14px 16px", marginBottom: 20,
                  }}>
                    {clearDone ? (
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#00C853" }}>✓ 30-min all-clear reached</div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#F5C400", letterSpacing: "0.08em" }}>⏱ WAIT-TO-GO TIMER</div>
                          <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>NWS 30/30 rule</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ fontSize: 22, fontWeight: 900, color: "#F5C400", fontVariantNumeric: "tabular-nums" }}>{clearMM}:{clearSS}</div>
                          <button onClick={resetClearTimer} style={{ background: "#1E2028", color: "#F5C400", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            RESET
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {plan.reasoning && (
                  <div style={{ background: "#13151A", border: "1px solid #1E2028", borderRadius: 12, padding: "14px 16px", marginBottom: 24 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "#555", marginBottom: 6 }}>WHAT WE SEE</div>
                    <p style={{ fontSize: 13, color: "#666", margin: 0, lineHeight: 1.6 }}>{plan.reasoning}</p>
                  </div>
                )}

                <button onClick={resetAll} style={ghostBtn}>Start over</button>
              </div>
            );
          })()}
        </div>

        <div style={{ textAlign: "center", padding: "0 20px 24px" }}>
          <p style={{ fontSize: 11, color: "#2A2D35", letterSpacing: "0.05em" }}>
            ALWAYS CALL EMERGENCY SERVICES IN A LIFE-THREATENING SITUATION
          </p>
        </div>
      </main>
    </>
  );
}

function solidBtn(bg: string, color: string): React.CSSProperties {
  return {
    width: "100%", background: bg, color, border: "none",
    borderRadius: 12, padding: "18px 0", fontSize: 15, fontWeight: 800,
    cursor: "pointer", letterSpacing: "0.05em", marginBottom: 10,
    WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
  };
}

const ghostBtn: React.CSSProperties = {
  width: "100%", background: "transparent", color: "#333", border: "none",
  padding: "14px 0", fontSize: 13, fontWeight: 600, cursor: "pointer",
  letterSpacing: "0.05em", marginBottom: 4,
};