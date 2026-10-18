// Camera and barcode reading for the scan screen. The pure decisions are
// exported for tests; startCamera/createDetector need a real browser.

export const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"];

// A code counts once two frames in a row read it — a single misread frame
// never opens the editor — and then not again until the code changes or
// leaves the frame.
export const createReadConfirmer = () => {
  let previous = null;
  let accepted = null;
  return (code) => {
    const confirmed = code !== null && code === previous && code !== accepted;
    previous = code;
    if (code !== accepted) accepted = null;
    if (confirmed) accepted = code;
    return confirmed ? code : null;
  };
};

const REAR = /back|rear|environment|zadnj/i;

// Phones with several rear lenses (wide, ultra-wide, macro) list them all;
// the user can cycle through them when the default one won't focus close.
export const backCameras = (devices) => {
  const cameras = devices.filter((d) => d.kind === "videoinput");
  const rear = cameras.filter((d) => REAR.test(d.label));
  return (rear.length > 0 ? rear : cameras).map(({ deviceId, label }) => ({ deviceId, label }));
};

export const nextCameraId = (cameras, currentId) => {
  if (cameras.length < 2) return null;
  const index = cameras.findIndex((c) => c.deviceId === currentId);
  return cameras[(index + 1) % cameras.length].deviceId;
};

// High resolution keeps small barcodes sharp; the browser's default is often 640×480.
export const cameraConstraints = (deviceId) => ({
  ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" }),
  width: { ideal: 1920 },
  height: { ideal: 1080 },
});

export const readerKind = (setting, hasNative) => (setting !== "zxing" && hasNative ? "native" : "zxing");

export const cameraErrorKind = (error) =>
  error?.name === "NotAllowedError" || error?.name === "SecurityError" ? "permission" : "unavailable";

// Built-in BarcodeDetector (Android Chrome) or the zxing WebAssembly reader
// (iPhone, or when chosen for comparison). The wasm ships with the app and is
// only fetched when zxing is actually used.
export const createDetector = async (kind) => {
  if (kind === "native") return new window.BarcodeDetector({ formats: FORMATS });
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import("barcode-detector/ponyfill"),
    import("zxing-wasm/reader/zxing_reader.wasm?url"),
  ]);
  prepareZXingModule({
    overrides: { locateFile: (path, prefix) => (path.endsWith(".wasm") ? wasmUrl : prefix + path) },
  });
  return new BarcodeDetector({ formats: FORMATS });
};

export const startCamera = async (video, { deviceId } = {}) => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: cameraConstraints(deviceId) });
  const [track] = stream.getVideoTracks();
  const capabilities = track.getCapabilities?.() ?? {};
  if (capabilities.focusMode?.includes("continuous")) {
    await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(() => {});
  }
  video.srcObject = stream;
  await video.play().catch(() => {});
  return {
    stream,
    track,
    deviceId: track.getSettings?.().deviceId ?? deviceId ?? null,
    torch: Boolean(capabilities.torch),
    setTorch: (on) => track.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {}),
    stop: () => stream.getTracks().forEach((t) => t.stop()),
  };
};
