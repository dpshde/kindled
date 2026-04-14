import { describe, expect, it } from "vitest";
import {
  initialAppScreenFromCaptureRef,
  normalizeAppScreen,
  noteScreenFromPassageAction,
  screenAfterBeginKindling,
  screenAfterKindlingAdvance,
} from "./app-screen";

describe("initialAppScreenFromCaptureRef", () => {
  it("returns capture when ref is non-empty", () => {
    expect(initialAppScreenFromCaptureRef("John 3:16")).toEqual({
      kind: "capture",
      initialRef: "John 3:16",
    });
  });

  it("returns threshold when ref is null", () => {
    expect(initialAppScreenFromCaptureRef(null)).toEqual({ kind: "threshold" });
  });

  it("returns threshold when ref is empty after trim", () => {
    expect(initialAppScreenFromCaptureRef("   ")).toEqual({ kind: "threshold" });
  });
});

describe("normalizeAppScreen", () => {
  it("maps passage with empty passageId to threshold", () => {
    expect(
      normalizeAppScreen({ kind: "passage", passageId: "" }),
    ).toEqual({ kind: "threshold" });
  });

  it("leaves valid passage unchanged", () => {
    const s = { kind: "passage" as const, passageId: "abc" };
    expect(normalizeAppScreen(s)).toBe(s);
  });
});

describe("screenAfterBeginKindling", () => {
  it("returns null when list is empty", () => {
    expect(screenAfterBeginKindling([])).toBeNull();
  });

  it("starts queue at first id", () => {
    expect(screenAfterBeginKindling(["a", "b"])).toEqual({
      kind: "passage",
      passageId: "a",
      kindling: { queueIds: ["a", "b"], index: 0 },
    });
  });
});

describe("screenAfterKindlingAdvance", () => {
  it("returns null when not passage with kindling", () => {
    expect(screenAfterKindlingAdvance({ kind: "threshold" })).toBeNull();
    expect(
      screenAfterKindlingAdvance({ kind: "passage", passageId: "x" }),
    ).toBeNull();
  });

  it("advances to next passage", () => {
    expect(
      screenAfterKindlingAdvance({
        kind: "passage",
        passageId: "a",
        kindling: { queueIds: ["a", "b"], index: 0 },
      }),
    ).toEqual({
      kind: "passage",
      passageId: "b",
      kindling: { queueIds: ["a", "b"], index: 1 },
    });
  });

  it("returns quietClose at end of queue", () => {
    expect(
      screenAfterKindlingAdvance({
        kind: "passage",
        passageId: "b",
        kindling: { queueIds: ["a", "b"], index: 1 },
      }),
    ).toEqual({ kind: "quietClose" });
  });
});

describe("noteScreenFromPassageAction", () => {
  it("omits returnToPassageId in kindling flow", () => {
    expect(
      noteScreenFromPassageAction(true, {
        passageId: "p1",
        displayRef: "Gen 1:1",
        reflectionId: "r1",
      }),
    ).toEqual({
      kind: "note",
      passageId: "p1",
      displayRef: "Gen 1:1",
      reflectionId: "r1",
    });
  });

  it("sets returnToPassageId in library flow", () => {
    expect(
      noteScreenFromPassageAction(false, {
        passageId: "p1",
        displayRef: "Gen 1:1",
      }),
    ).toEqual({
      kind: "note",
      passageId: "p1",
      displayRef: "Gen 1:1",
      returnToPassageId: "p1",
    });
  });
});
