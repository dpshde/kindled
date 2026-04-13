import { describe, it, expect, vi, beforeEach } from "vitest";

const triggerMock = vi.fn().mockResolvedValue(undefined);

vi.mock("web-haptics", () => ({
  WebHaptics: vi.fn().mockImplementation(() => ({
    trigger: triggerMock,
  })),
}));

import { hapticTrigger } from "./haptics";

describe("hapticTrigger", () => {
  beforeEach(() => {
    triggerMock.mockClear();
  });

  it("calls WebHaptics.trigger with default args", async () => {
    await hapticTrigger();
    expect(triggerMock).toHaveBeenCalledTimes(1);
    expect(triggerMock).toHaveBeenCalledWith(undefined, undefined);
  });

  it("forwards preset name and options", async () => {
    await hapticTrigger("selection", { intensity: 0.8 });
    expect(triggerMock).toHaveBeenCalledWith("selection", { intensity: 0.8 });
  });
});
