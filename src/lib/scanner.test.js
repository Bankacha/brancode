import { describe, it, expect } from "vitest";
import { backCameras, cameraConstraints, cameraErrorKind, createReadConfirmer, nextCameraId, readerKind } from "./scanner.js";

describe("createReadConfirmer", () => {
  it("accepts a code once two frames in a row read it, and only once", () => {
    const confirm = createReadConfirmer();
    expect(["A", "A", "A"].map(confirm)).toEqual([null, "A", null]);
  });

  it("accepts the same code again after a frame without it", () => {
    const confirm = createReadConfirmer();
    expect(["A", "A", null, "A", "A"].map(confirm)).toEqual([null, "A", null, null, "A"]);
  });

  it("ignores a single misread between two codes", () => {
    const confirm = createReadConfirmer();
    expect(["A", "B", "B"].map(confirm)).toEqual([null, null, "B"]);
  });
});

describe("backCameras", () => {
  const devices = [
    { kind: "videoinput", deviceId: "1", label: "camera2 1, facing front" },
    { kind: "videoinput", deviceId: "0", label: "camera2 0, facing back" },
    { kind: "audioinput", deviceId: "m", label: "mic" },
    { kind: "videoinput", deviceId: "2", label: "camera2 2, facing back" },
  ];

  it("keeps the rear cameras", () => {
    expect(backCameras(devices).map((c) => c.deviceId)).toEqual(["0", "2"]);
  });

  it("falls back to every camera when labels don't say which way they face", () => {
    const unlabeled = [
      { kind: "videoinput", deviceId: "a", label: "" },
      { kind: "videoinput", deviceId: "b", label: "" },
    ];
    expect(backCameras(unlabeled).map((c) => c.deviceId)).toEqual(["a", "b"]);
  });
});

describe("nextCameraId", () => {
  const cams = [{ deviceId: "0" }, { deviceId: "2" }];
  it("cycles through the rear cameras", () => {
    expect(nextCameraId(cams, "0")).toBe("2");
    expect(nextCameraId(cams, "2")).toBe("0");
  });

  it("has nothing to switch to with one camera", () => {
    expect(nextCameraId([{ deviceId: "0" }], "0")).toBeNull();
  });
});

describe("cameraConstraints", () => {
  it("asks for the rear camera in high resolution", () => {
    const c = cameraConstraints();
    expect(c.facingMode).toBe("environment");
    expect(c.width.ideal).toBe(1920);
    expect(c.height.ideal).toBe(1080);
  });

  it("asks for a chosen camera exactly", () => {
    const c = cameraConstraints("x");
    expect(c.deviceId).toEqual({ exact: "x" });
    expect(c.facingMode).toBeUndefined();
  });
});

describe("readerKind", () => {
  it("uses the built-in reader when there is one, zxing otherwise", () => {
    expect(readerKind("auto", true)).toBe("native");
    expect(readerKind("auto", false)).toBe("zxing");
    expect(readerKind("native", false)).toBe("zxing");
    expect(readerKind("zxing", true)).toBe("zxing");
  });
});

describe("cameraErrorKind", () => {
  it("tells a refused permission from a missing camera", () => {
    expect(cameraErrorKind({ name: "NotAllowedError" })).toBe("permission");
    expect(cameraErrorKind({ name: "SecurityError" })).toBe("permission");
    expect(cameraErrorKind({ name: "NotFoundError" })).toBe("unavailable");
  });
});
