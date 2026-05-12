import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const webHapticsTriggerMock = vi.fn(() => Promise.resolve(undefined));
const zeroInvokeMock = vi.fn<(_cmd: string, _payload?: Record<string, unknown>) => Promise<unknown>>(
  (_cmd, _payload) => Promise.resolve(undefined),
);

vi.mock("web-haptics", () => ({
  WebHaptics: vi.fn(function (this: { trigger: typeof webHapticsTriggerMock }) {
    this.trigger = webHapticsTriggerMock;
  }),
}));

describe("haptics", () => {
  let origWindow: typeof globalThis.window | undefined;

  beforeEach(() => {
    origWindow = globalThis.window;
    webHapticsTriggerMock.mockClear();
    zeroInvokeMock.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.window = origWindow!;
  });

  function setNativeWindow(platform: string = "web") {
    zeroInvokeMock.mockImplementation((_cmd: string, _payload?: Record<string, unknown>) => {
      if (_cmd === "os.platform") return Promise.resolve(platform);
      return Promise.resolve(undefined);
    });
    globalThis.window = {
      ...globalThis.window,
      zero: {
        invoke: zeroInvokeMock,
        on: vi.fn(),
        windows: {},
        dialogs: {},
      },
    } as unknown as Window & typeof globalThis;
  }

  it("calls web-haptics on web", async () => {
    const { hapticLight } = await import("./haptics");
    await hapticLight();
    expect(webHapticsTriggerMock).toHaveBeenCalledWith("light", undefined);
  });

  it("uses iOS native impact haptics", async () => {
    setNativeWindow("ios");
    const { hapticMedium } = await import("./haptics");
    await hapticMedium();
    expect(zeroInvokeMock).toHaveBeenCalledWith("haptics.impact", { style: "medium" });
  });

  it("uses iOS notification feedback for warning", async () => {
    setNativeWindow("ios");
    const { hapticWarning } = await import("./haptics");
    await hapticWarning();
    expect(zeroInvokeMock).toHaveBeenCalledWith("haptics.notification", { kind: "warning" });
  });

  it("uses iOS notification feedback for save/success", async () => {
    setNativeWindow("ios");
    const { hapticSave } = await import("./haptics");
    await hapticSave();
    expect(zeroInvokeMock).toHaveBeenCalledWith("haptics.notification", { kind: "success" });
  });

  it("uses macOS native haptic and web-haptics audio path", async () => {
    setNativeWindow("macos");
    const { hapticHeavy } = await import("./haptics");
    await hapticHeavy();
    expect(zeroInvokeMock).toHaveBeenCalledWith("haptics.macos", { style: "heavy" });
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
