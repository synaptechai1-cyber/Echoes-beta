import { useEffect, useRef, useState, useCallback } from "react";
import { useUser, SignInButton } from "@clerk/clerk-react";
import "./EchoesVision.css";

// ---- Config ----
const FREE_USES_LIMIT = 3; // free actions (describe or read-text) before signup is required
const STORAGE_KEY = "echoesVision:freeUsesRemaining";

const MODELS = {
  fast: "onnx-community/SmolVLM-256M-Instruct",
  balanced: "onnx-community/SmolVLM-500M-Instruct",
};

const PROMPT =
  "You are a vision assistant for a blind person. In one or two short sentences, describe the scene directly ahead: mention people, obstacles, hazards, doorways, steps, and any readable signs. Be concrete and concise, no filler words.";

function getFreeUsesRemaining() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return FREE_USES_LIMIT;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? FREE_USES_LIMIT : n;
}

function setFreeUsesRemaining(n) {
  localStorage.setItem(STORAGE_KEY, String(n));
}

export default function EchoesVision() {
  const { isSignedIn } = useUser();

  const [status, setStatus] = useState(
    'Tap "Describe surroundings" to get started. The first time will take a moment to set up.'
  );
  const [busy, setBusy] = useState(false);
  const [autoOn, setAutoOn] = useState(false);
  const [needsSignup, setNeedsSignup] = useState(false);
  const [quality, setQuality] = useState("balanced");
  const [rate, setRate] = useState(1);
  const [voices, setVoices] = useState([]);
  const [voiceName, setVoiceName] = useState("");
  const [cameraFacing, setCameraFacing] = useState("environment");
  const [loadProgress, setLoadProgress] = useState("");
  const [lastSpoken, setLastSpoken] = useState("");
  const [usesLeft, setUsesLeft] = useState(isSignedIn ? Infinity : getFreeUsesRemaining());

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const modelRef = useRef(null);
  const processorRef = useRef(null);
  const currentModelIdRef = useRef(null);
  const modelLoadingRef = useRef(null);
  const autoTimerRef = useRef(null);
  const lastFrameSampleRef = useRef(null);
  const ocrWorkerRef = useRef(null);

  // Keep usesLeft in sync if sign-in state changes (e.g. they sign in mid-session)
  useEffect(() => {
    setUsesLeft(isSignedIn ? Infinity : getFreeUsesRemaining());
    if (isSignedIn) setNeedsSignup(false);
  }, [isSignedIn]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const populate = () => {
      const all = window.speechSynthesis.getVoices();
      const en = all.filter((v) => v.lang.startsWith("en"));
      const list = en.length ? en : all;
      setVoices(list);
      if (!voiceName && list.length) setVoiceName(list[0].name);
    };
    populate();
    window.speechSynthesis.onvoiceschanged = populate;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      setStatus(
        "Camera access was blocked. Please allow camera permission in your browser settings and reload."
      );
      throw err;
    }
  }, [cameraFacing]);

  useEffect(() => {
    startCamera().catch(() => {});
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    };
  }, [startCamera]);

  const speak = useCallback(
    (text) => {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate;
      const chosen = voices.find((v) => v.name === voiceName);
      if (chosen) u.voice = chosen;
      window.speechSynthesis.speak(u);
      setLastSpoken(text);
    },
    [rate, voices, voiceName]
  );

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);
    return canvas;
  };

  // Returns true if the action is allowed to proceed (and consumes a free use if unauthenticated)
  const consumeUseOrPrompt = () => {
    if (isSignedIn) return true;
    const remaining = getFreeUsesRemaining();
    if (remaining <= 0) {
      setNeedsSignup(true);
      setStatus("You've used your free descriptions. Sign up free to keep using Echoes Vision.");
      return false;
    }
    const next = remaining - 1;
    setFreeUsesRemaining(next);
    setUsesLeft(next);
    return true;
  };

  const ensureModel = async () => {
    const wanted = MODELS[quality];
    if (modelRef.current && currentModelIdRef.current === wanted) return;
    if (modelLoadingRef.current && currentModelIdRef.current === wanted) {
      return modelLoadingRef.current;
    }
    currentModelIdRef.current = wanted;
    setStatus(
      "Setting up the vision model for the first time. This downloads once and is then cached on your device.",
      true
    );

    modelLoadingRef.current = (async () => {
      const { AutoProcessor, AutoModelForVision2Seq } = await import(
        "@huggingface/transformers"
      );
      let device = "wasm";
      if ("gpu" in navigator) device = "webgpu";
      processorRef.current = await AutoProcessor.from_pretrained(wanted);
      modelRef.current = await AutoModelForVision2Seq.from_pretrained(wanted, {
        dtype: {
          embed_tokens: "fp16",
          vision_encoder: "fp16",
          decoder_model_merged: "q4",
        },
        device,
        progress_callback: (p) => {
          if (p.status === "progress" && p.file) {
            const pct = p.total ? Math.round((p.loaded / p.total) * 100) : null;
            setLoadProgress(pct !== null ? `Downloading model… ${pct}%` : "Downloading model…");
          }
        },
      });
    })();

    await modelLoadingRef.current;
    setLoadProgress("");
  };

  const describeScene = async () => {
    if (!consumeUseOrPrompt()) return;
    setBusy(true);
    try {
      const { RawImage } = await import("@huggingface/transformers");
      if (!streamRef.current) await startCamera();
      await ensureModel();
      setStatus("Looking…");

      const frame = captureFrame();
      const dataUrl = frame.toDataURL("image/jpeg", 0.85);
      const image = await RawImage.fromURL(dataUrl);

      const messages = [
        { role: "user", content: [{ type: "image" }, { type: "text", text: PROMPT }] },
      ];
      const textPrompt = processorRef.current.apply_chat_template(messages, {
        add_generation_prompt: true,
      });
      const inputs = await processorRef.current(textPrompt, image);
      const generated = await modelRef.current.generate({ ...inputs, max_new_tokens: 100 });
      const inputLen = inputs.input_ids.dims.at(-1);
      const decoded = processorRef.current.batch_decode(
        generated.slice(null, [inputLen, null]),
        { skip_special_tokens: true }
      );
      const description =
        (decoded[0] || "").trim() ||
        "I couldn't make out anything clear. Try moving a little closer or into better light.";

      setStatus(description);
      speak(description);
    } catch (err) {
      console.error(err);
      setStatus(
        "Something went wrong describing the scene. " + (err?.message || "Please try again.")
      );
    } finally {
      setBusy(false);
    }
  };

  const getOcrWorker = async () => {
    if (!ocrWorkerRef.current) {
      ocrWorkerRef.current = (async () => {
        await new Promise((resolve, reject) => {
          if (window.Tesseract) return resolve();
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/[email protected]/dist/tesseract.min.js";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
        return await window.Tesseract.createWorker("eng");
      })();
    }
    return ocrWorkerRef.current;
  };

  const readText = async () => {
    if (!consumeUseOrPrompt()) return;
    setBusy(true);
    try {
      if (!streamRef.current) await startCamera();
      setStatus("Setting up text reading…");
      const worker = await getOcrWorker();
      setStatus("Reading text…");
      const frame = captureFrame();
      const { data } = await worker.recognize(frame);
      const text = (data.text || "").trim();
      if (text) {
        setStatus(text);
        speak(text);
      } else {
        setStatus("No readable text found. Try holding steady and closer to the text.");
        speak("No readable text found.");
      }
    } catch (err) {
      console.error(err);
      setStatus("Couldn't read text just now. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const frameSignature = () => {
    const w = 16,
      h = 12;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d").drawImage(videoRef.current, 0, 0, w, h);
    return c.getContext("2d").getImageData(0, 0, w, h).data;
  };

  const framesDiffer = (a, b, threshold = 18) => {
    if (!a || !b) return true;
    let diffSum = 0;
    for (let i = 0; i < a.length; i += 4) diffSum += Math.abs(a[i] - b[i]);
    return diffSum / (a.length / 4) > threshold;
  };

  const toggleAutoMode = () => {
    if (autoOn) {
      setAutoOn(false);
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
      return;
    }
    // Auto mode requires being signed in — otherwise it burns through the free cap in seconds
    if (!isSignedIn) {
      setNeedsSignup(true);
      setStatus("Auto mode is a signed-in feature so it doesn't burn through your free uses instantly. Sign up free to unlock it.");
      return;
    }
    setAutoOn(true);
    lastFrameSampleRef.current = null;
    autoTimerRef.current = setInterval(async () => {
      if (busy) return;
      if (!streamRef.current) {
        try {
          await startCamera();
        } catch {
          return;
        }
      }
      const sig = frameSignature();
      if (framesDiffer(sig, lastFrameSampleRef.current)) {
        lastFrameSampleRef.current = sig;
        await describeScene();
      }
    }, 4000);
  };

  return (
    <div className="echoes-vision">
      <div className="ev-status" role="status" aria-live="polite">
        {status}
      </div>

      <video ref={videoRef} playsInline muted aria-hidden="true" className="ev-video" />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <button
        className={`ev-primary-btn${autoOn ? " recording" : ""}`}
        onClick={describeScene}
        disabled={busy}
      >
        <span>🔎 Describe surroundings</span>
        {loadProgress && <small>{loadProgress}</small>}
        {!isSignedIn && Number.isFinite(usesLeft) && (
          <small>{usesLeft} free use{usesLeft === 1 ? "" : "s"} left</small>
        )}
      </button>

      <div className="ev-row">
        <button className="ev-secondary-btn" onClick={readText} disabled={busy}>
          📖 Read text
        </button>
        <button
          className="ev-secondary-btn"
          aria-pressed={autoOn}
          onClick={toggleAutoMode}
        >
          {autoOn ? "⏹ Stop auto mode" : "🔁 Auto mode"}
        </button>
      </div>

      {lastSpoken && (
        <button className="ev-secondary-btn" onClick={() => speak(lastSpoken)}>
          🔊 Repeat last description
        </button>
      )}

      {needsSignup && (
        <div className="ev-signup-card">
          <p>You've used your free descriptions for this device.</p>
          <SignInButton mode="modal">
            <button className="ev-primary-btn small">Sign up free for unlimited use</button>
          </SignInButton>
        </div>
      )}

      <details className="ev-settings">
        <summary>Settings</summary>
        <div className="ev-setting-row">
          <label htmlFor="ev-quality">Description quality</label>
          <select id="ev-quality" value={quality} onChange={(e) => setQuality(e.target.value)}>
            <option value="fast">Faster (smaller model)</option>
            <option value="balanced">Balanced (recommended)</option>
          </select>
        </div>
        <div className="ev-setting-row">
          <label htmlFor="ev-rate">Speech speed</label>
          <input
            id="ev-rate"
            type="range"
            min="0.6"
            max="1.6"
            step="0.1"
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
          />
        </div>
        <div className="ev-setting-row">
          <label htmlFor="ev-voice">Voice</label>
          <select id="ev-voice" value={voiceName} onChange={(e) => setVoiceName(e.target.value)}>
            {voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <div className="ev-setting-row">
          <label htmlFor="ev-camera">Camera</label>
          <select
            id="ev-camera"
            value={cameraFacing}
            onChange={(e) => setCameraFacing(e.target.value)}
          >
            <option value="environment">Rear (world-facing)</option>
            <option value="user">Front</option>
          </select>
        </div>
      </details>
    </div>
  );
}
