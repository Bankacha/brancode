import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { CameraOff, Check, CircleCheck, Flashlight, WifiOff, X } from "lucide-react";
import { backCameras, cameraErrorKind, createDetector, createReadConfirmer, nextCameraId, readerKind, startCamera } from "../lib/scanner.js";
import { formatPrice } from "../lib/format.js";
import { finishScreen, leaveScreen } from "../lib/navigation.js";
import { usePrintFormat } from "../lib/printFormat.js";
import { useScannerReader } from "../lib/useScannerReader.js";
import { useSheet } from "../lib/useSheet.js";
import { useToast } from "../components/Toast.jsx";
import EditSheet from "../sheets/EditSheet.jsx";

const CAMERA_KEY = "camera-device";
const readCamera = () => {
  try {
    return localStorage.getItem(CAMERA_KEY);
  } catch (e) {
    return null;
  }
};
const rememberCamera = (id) => {
  try {
    if (id) localStorage.setItem(CAMERA_KEY, id);
    else localStorage.removeItem(CAMERA_KEY);
  } catch (e) {
    console.error("save camera failed", e);
  }
};

function OverlayButton({ label, onClick, children, className = "" }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex h-11 min-w-11 items-center justify-center rounded-full bg-black/40 text-white transition-transform duration-100 active:scale-[.97] ${className}`}
    >
      {children}
    </button>
  );
}

// Handoff "03 · Skeniranje": scanning in a row. A confirmed read pauses the
// camera and opens the edit sheet over it; closing the sheet in any way
// resumes scanning.
export default function Scan({ editor }) {
  const navigate = useNavigate();
  const location = useLocation();
  const sheet = useSheet();
  const toast = useToast();
  const [format] = usePrintFormat();
  const [readerSetting] = useScannerReader();
  const videoRef = useRef(null);
  const cameraRef = useRef(null);
  const detectorRef = useRef(null);
  // One for the whole visit: after a save, skip or cancel the article is
  // usually still in front of the camera and must not reopen until it leaves
  // the frame (or another code appears).
  const confirmRead = useRef(createReadConfirmer()).current;
  const firstPage = useRef(location.key === "default");
  const [deviceId, setDeviceId] = useState(readCamera);
  const [cameras, setCameras] = useState([]);
  const [live, setLive] = useState(false);
  const [torch, setTorch] = useState({ available: false, on: false });
  const [visible, setVisible] = useState(() => document.visibilityState !== "hidden");
  const [sessionCount, setSessionCount] = useState(0);
  const paused = sheet.name === "edit";
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // A refreshed page can't have a read in flight: drop a stale "edit" entry.
  useEffect(() => {
    if (sheet.name === "edit" && editor.barcode === null) navigate(".", { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The camera is off while the app is in the background.
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  const showCameraError = (error) => {
    const permission = cameraErrorKind(error) === "permission";
    toast.show({
      kind: "error",
      icon: CameraOff,
      text: permission ? "Nema dozvole za kameru." : "Kamera nije dostupna.",
      action: { label: "Upiši ručno", run: () => navigate("/rucni-unos", { replace: true }) },
    });
  };

  // Camera on while visible; restarted when another lens is chosen.
  useEffect(() => {
    if (!visible) return;
    let stopped = false;
    let camera = null;
    (async () => {
      try {
        camera = await startCamera(videoRef.current, { deviceId });
        if (stopped) return camera.stop();
        cameraRef.current = camera;
        setTorch({ available: camera.torch, on: false });
        setLive(true);
        if (pausedRef.current) videoRef.current?.pause();
        const devices = (await navigator.mediaDevices?.enumerateDevices?.().catch(() => [])) ?? [];
        if (!stopped) setCameras(backCameras(devices));
      } catch (error) {
        if (stopped) return;
        if (deviceId && cameraErrorKind(error) !== "permission") {
          rememberCamera(null); // a remembered lens from another phone: fall back to the default
          setDeviceId(null);
          return;
        }
        showCameraError(error);
      }
    })();
    return () => {
      stopped = true;
      camera?.stop();
      cameraRef.current = null;
      setLive(false);
    };
  }, [visible, deviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Built-in reader or zxing, per device support and the (temporary) menu choice.
  useEffect(() => {
    let cancelled = false;
    createDetector(readerKind(readerSetting, "BarcodeDetector" in window))
      .then((detector) => {
        if (!cancelled) detectorRef.current = detector;
      })
      .catch((e) => console.error("barcode reader failed to load", e));
    return () => {
      cancelled = true;
      detectorRef.current = null;
    };
  }, [readerSetting]);

  const onReadRef = useRef(null);
  onReadRef.current = (code) => {
    setSessionCount((n) => n + 1);
    editor.open(code);
    sheet.open("edit");
  };

  // Read frames while the camera is live and no sheet is open; the frame on
  // screen freezes while the sheet is up.
  useEffect(() => {
    const video = videoRef.current;
    if (!live || paused) {
      video?.pause?.();
      return;
    }
    video?.play?.().catch(() => {});
    let stopped = false;
    let frame = null;
    const loop = async () => {
      if (stopped) return;
      const detector = detectorRef.current;
      if (detector && video && video.readyState >= 2) {
        try {
          const codes = await detector.detect(video);
          const code = confirmRead(codes[0]?.rawValue ?? null);
          if (code && !stopped) return onReadRef.current(code);
        } catch (e) {
          // a frame the reader couldn't handle; try the next one
        }
      }
      if (!stopped) frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
    };
  }, [live, paused]);

  const switchCamera = () => {
    const next = nextCameraId(cameras, cameraRef.current?.deviceId ?? deviceId);
    if (!next) return;
    rememberCamera(next);
    setDeviceId(next);
  };

  const toggleTorch = () => {
    const on = !torch.on;
    cameraRef.current?.setTorch(on);
    setTorch((t) => ({ ...t, on }));
  };

  const added = (item) => toast.show({ kind: "success", icon: Check, text: `Dodato: ${item.name}`, detail: formatPrice(item.price) });

  const save = async (then) => {
    const saved = await editor.save();
    if (!saved) {
      toast.show({ kind: "error", icon: WifiOff, text: "Nema veze. Nije sačuvano.", action: { label: "Ponovi", run: () => saveRef.current(then) } });
      return;
    }
    added(saved);
    if (then === "next") sheet.close();
    else finishScreen(navigate, firstPage.current);
  };
  const saveRef = useRef(save);
  saveRef.current = save;

  const skip = () => {
    const item = editor.skip();
    if (!item) return;
    added(item);
    sheet.close();
  };

  const cancel = () => {
    sheet.close();
    editor.close();
  };

  const cameraIndex = cameras.findIndex((c) => c.deviceId === (cameraRef.current?.deviceId ?? deviceId));
  const cameraLabel = cameras.length > 1 ? `kamera ${cameraIndex + 1}/${cameras.length}` : "kamera";

  return (
    <div className="fixed inset-0 z-30 mx-auto w-full max-w-[480px] overflow-hidden bg-camera">
      <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,var(--color-camera)_0_14px,var(--color-camera-stripe)_14px_28px)]" />
      <video ref={videoRef} muted playsInline className={`absolute inset-0 size-full object-cover ${live ? "" : "opacity-0"}`} />

      <div className="absolute inset-x-5 top-[calc(16px+env(safe-area-inset-top))] flex items-center justify-between">
        <OverlayButton label="Zatvori" onClick={() => leaveScreen(navigate, location)}>
          <X size={20} />
        </OverlayButton>
        <OverlayButton label="Promeni kameru" onClick={switchCamera} className="px-3.5 font-mono text-xs">
          {cameraLabel}
        </OverlayButton>
        {torch.available ? (
          <OverlayButton label="Blic" onClick={toggleTorch} className={torch.on ? "bg-white/80 text-ink" : ""}>
            <Flashlight size={20} />
          </OverlayButton>
        ) : (
          <span className="size-11" />
        )}
      </div>

      {paused ? (
        <div className="absolute top-[calc(76px+env(safe-area-inset-top))] left-1/2 flex -translate-x-1/2 flex-col items-center gap-3">
          <div className="relative h-[120px] w-[240px] rounded-card border-[3px] border-success">
            <span className="absolute inset-x-[7.5%] top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-success" />
          </div>
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-white">
            <CircleCheck size={16} className="text-success-light" /> Pročitano · kamera na pauzi
          </p>
        </div>
      ) : (
        <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4">
          <div className="relative h-[170px] w-[280px] rounded-[28px] border-[3px] border-bg">
            <span className="absolute inset-x-[7.5%] top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-accent" />
          </div>
          <p className="text-[15px] font-semibold text-white">Usmeri na barkod</p>
        </div>
      )}

      <EditSheet
        editor={editor}
        open={paused && editor.barcode !== null}
        onClose={cancel}
        format={format}
        source="scan"
        sessionCount={sessionCount}
        onSaveNext={() => save("next")}
        onSkip={skip}
        onFinish={() => save("finish")}
      />
    </div>
  );
}
