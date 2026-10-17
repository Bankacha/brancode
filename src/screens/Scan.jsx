import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AlertCircle } from "lucide-react";
import { PAPER, errorBanner, outlineButton } from "../lib/legacyTheme.js";

export default function Scan({ onDetected }) {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const [cameraError, setCameraError] = useState(null);
  // Latest callback without restarting the camera when the parent re-renders.
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  // Starts on mount and always releases the camera on unmount (route change,
  // system back), including a stream that only resolves after unmount.
  useEffect(() => {
    let stopped = false;
    let stream = null;
    let frame = null;

    const stop = () => {
      stopped = true;
      if (frame) cancelAnimationFrame(frame);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };

    const start = async () => {
      if (!("BarcodeDetector" in window)) {
        setCameraError("Skeniranje kamerom nije podržano u ovom browseru. Koristi ručni unos ili otvori aplikaciju na telefonu u Chrome-u.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new window.BarcodeDetector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"],
        });
        const loop = async () => {
          if (stopped) return;
          if (!videoRef.current || videoRef.current.readyState < 2) {
            frame = requestAnimationFrame(loop);
            return;
          }
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0 && !stopped) {
              stop();
              onDetectedRef.current(codes[0].rawValue);
              return;
            }
          } catch (e) {}
          frame = requestAnimationFrame(loop);
        };
        loop();
      } catch (e) {
        if (!stopped) setCameraError("Nema pristupa kameri (dozvola je odbijena ili kamera nije dostupna). Koristi ručni unos.");
      }
    };

    start();
    return stop;
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "#000", aspectRatio: "4/3" }}>
        <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
        <div
          style={{
            position: "absolute",
            inset: "30% 12%",
            border: `2px solid ${PAPER}`,
            borderRadius: 6,
            boxShadow: "0 0 0 999px rgba(0,0,0,0.35)",
          }}
        />
      </div>
      {cameraError && (
        <div style={errorBanner}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{cameraError}</span>
        </div>
      )}
      <button onClick={() => navigate("/")} style={{ ...outlineButton, padding: "12px" }}>
        Otkaži
      </button>
    </div>
  );
}
