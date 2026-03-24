import { describe, it, expect } from "vitest";
import { bwColor, bwPageTheme } from "../useBWMode";

describe("bwColor", () => {
  it("returns color unchanged when BW mode is off", () => {
    expect(bwColor("#3b82f6", false)).toBe("#3b82f6");
    expect(bwColor("rgba(59,130,246,0.5)", false)).toBe("rgba(59,130,246,0.5)");
  });

  it("converts hex color to grayscale in BW mode", () => {
    const result = bwColor("#3b82f6", true);
    // Should be a grayscale hex (all three channels equal)
    expect(result).toMatch(/^#([0-9a-f]{2})\1\1$/i);
  });

  it("converts hex color with alpha to grayscale preserving alpha", () => {
    const result = bwColor("#3b82f680", true);
    // Should end with the alpha hex "80"
    expect(result).toMatch(/^#[0-9a-f]{6}80$/i);
  });

  it("converts rgba to grayscale rgba in BW mode", () => {
    const result = bwColor("rgba(59,130,246,0.5)", true);
    // Should produce rgba(gray,gray,gray,0.5) where all three channels are the same
    const match = result.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/);
    expect(match).toBeTruthy();
    if (match) {
      expect(match[1]).toBe(match[2]);
      expect(match[2]).toBe(match[3]);
      expect(match[4]).toBe("0.5");
    }
  });

  it("converts rgb to grayscale rgb in BW mode", () => {
    const result = bwColor("rgb(59,130,246)", true);
    const match = result.match(/rgb\((\d+),(\d+),(\d+)\)/);
    expect(match).toBeTruthy();
    if (match) {
      expect(match[1]).toBe(match[2]);
      expect(match[2]).toBe(match[3]);
    }
  });

  it("passes through CSS variables unchanged", () => {
    expect(bwColor("var(--tx-1)", true)).toBe("var(--tx-1)");
    expect(bwColor("var(--accent)", true)).toBe("var(--accent)");
  });

  it("converts linear-gradient hex colors in BW mode", () => {
    const result = bwColor("linear-gradient(90deg,#16a34a,#22c55e)", true);
    // The gradient should still start with linear-gradient
    expect(result).toMatch(/^linear-gradient/);
    // Original colors should be replaced (not present)
    expect(result).not.toContain("#16a34a");
    expect(result).not.toContain("#22c55e");
  });

  it("converts linear-gradient rgba colors in BW mode", () => {
    const result = bwColor("linear-gradient(90deg,rgba(59,130,246,0.5),transparent)", true);
    expect(result).toMatch(/^linear-gradient/);
    // Original blue rgba should be converted
    expect(result).not.toContain("rgba(59,130,246");
  });

  it("handles empty string", () => {
    expect(bwColor("", true)).toBe("");
  });

  it("handles null-ish gracefully", () => {
    // @ts-expect-error testing edge case
    expect(bwColor(undefined, true)).toBeUndefined();
  });

  it("preserves semantic profit/loss colors when BW is off", () => {
    expect(bwColor("#22c55e", false)).toBe("#22c55e");
    expect(bwColor("#ef4444", false)).toBe("#ef4444");
  });
});

describe("bwPageTheme", () => {
  const theme = {
    accent: "#818cf8",
    dim: "rgba(129,140,248,0.08)",
    border: "rgba(129,140,248,0.18)",
    glow: "rgba(129,140,248,0.12)",
    name: "Indigo" as const,
  };

  it("returns theme unchanged when BW mode is off", () => {
    const result = bwPageTheme(theme, false);
    expect(result).toBe(theme); // same reference
  });

  it("converts colors to grayscale when BW mode is on", () => {
    const result = bwPageTheme(theme, true);
    // accent should be grayscale hex
    expect(result.accent).toMatch(/^#([0-9a-f]{2})\1\1$/i);
    // name should be preserved
    expect(result.name).toBe("Indigo");
    // dim should be converted rgba
    expect(result.dim).not.toContain("129,140,248");
  });

  it("preserves non-color properties like name", () => {
    const result = bwPageTheme(theme, true);
    expect(result.name).toBe("Indigo");
  });
});
