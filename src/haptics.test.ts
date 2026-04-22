import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const impactFeedbackMock = vi.fn(() => Promise.resolve({ status: "ok" }));
const notificationFeedbackMock = vi.fn(() => Promise.resolve({ status: "ok" }));
const performMock = vi.fn(() => Promise.resolve(undefined));
const isSupportedMock = vi.fn(() => Promise.resolve(true));
const platformMock = vi.fn(() => Promise.resolve("web"));
const isTauriMock = vi.fn(() => false);
const webHapticsTriggerMock = vi.fn(() => Promise.resolve(undefined));

vi.mock("web-haptics", () => ({
  WebHaptics: vi.fn(function (this: { trigger: typeof webHapticsTriggerMock }) {
    this.trigger = webHapticsTriggerMock;
  }),
}));

vi.mock("@tauri-apps/plugin-haptics", () => ({
  impactFeedback: impactFeedbackMock,
  notificationFeedback: notificationFeedbackMock,
}));

vi.mock("tauri-plugin-macos-haptics-api", () => ({
  perform: performMock,
  HapticFeedbackPattern: { Alignment: 0, LevelChange: 1, Generic: 2 },
  PerformanceTime: { Default: 0, Now: 1, DrawCompleted: 2 },
  isSupported: isSupportedMock,
}));

vi.mock("@tauri-apps/plugin-os", () => ({
  platform: platformMock,
}));

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: isTauriMock,
}));

describe("haptics", () => {
  let origWindow: typeof globalThis.window | undefined;

  beforeEach(() => {
    origWindow = globalThis.window;
    impactFeedbackMock.mockClear();
    notificationFeedbackMock.mockClear();
    performMock.mockClear();
    isSupportedMock.mockClear();
    webHapticsTriggerMock.mockClear();
    platformMock.mockClear();
    isTauriMock.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.window = origWindow!;
  });

  function setTauriWindow() {
    globalThis.window = {
      ...globalThis.window,
      __TAURI_INTERNALS__: {},
    } as unknown as Window & typeof globalThis;
    isTauriMock.mockReturnValue(true);
  }

  it("calls web-haptics on web", async () => {
    platformMock.mockResolvedValue("web");
    const { hapticLight } = await import("./haptics");
    await hapticLight();
    expect(webHapticsTriggerMock).toHaveBeenCalledWith("light", undefined);
  });

  it("uses iOS native impact haptics", async () => {
    setTauriWindow();
    platformMock.mockResolvedValue("ios");
    const { hapticMedium } = await import("./haptics");
    await hapticMedium();
    expect(impactFeedbackMock).toHaveBeenCalledWith("medium");
  });

  it("uses iOS notification feedback for warning", async () => {
    setTauriWindow();
    platformMock.mockResolvedValue("ios");
    const { hapticWarning } = await import("./haptics");
    await hapticWarning();
    expect(notificationFeedbackMock).toHaveBeenCalledWith("warning");
  });

  it("uses iOS notification feedback for save/success", async () => {
    setTauriWindow();
    platformMock.mockResolvedValue("ios");
    const { hapticSave } = await import("./haptics");
    await hapticSave();
    expect(notificationFeedbackMock).toHaveBeenCalledWith("success");
  });

  it("uses macOS native haptic and web-haptics audio path", async () => {
    setTauriWindow();
    platformMock.mockResolvedValue("macos");
    const { hapticHeavy } = await import("./haptics");
    await hapticHeavy();
    expect(performMock).toHaveBeenCalledTimes(1);
    expect(webHapticsTriggerMock).toHaveBeenCalledWith("heavy", undefined);
  });

  it("exports hapticTrigger passthrough", async () => {
    const { hapticTrigger } = await import("./haptics");
    await hapticTrigger("selection", { intensity: 0.8 });
    expect(webHapticsTriggerMock).toHaveBeenCalledWith("selection", {
      intensity: 0.8,
    });
  });
});
