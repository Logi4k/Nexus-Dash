/**
 * Theme Token Compliance Tests
 *
 * Verifies that FilterBar, SettingsModal, CommandPalette, and Modal
 * use theme-aware CSS variable tokens instead of hardcoded hex colors.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";

// ── Source-level checks: no hardcoded colors in component files ──────────────

const COMPONENTS_DIR = path.resolve(__dirname, "..");

const TARGET_FILES = [
  "FilterBar.tsx",
  "SettingsModal.tsx",
  "CommandPalette.tsx",
  "Modal.tsx",
];

/**
 * Patterns that indicate hardcoded colors bypassing the theme system.
 * Excludes:
 *  - Comments (lines starting with // or *)
 *  - Theme preview swatches (intentionally use literal colors for preview)
 *  - Semantic colors (profit green #22c55e, loss red #ef4444, warn amber #f59e0b)
 *  - Avatar colors (AVATAR_COLORS array — decorative, not theme-dependent)
 *  - Black overlays (bg-black/55, rgba(0,0,0,...)) — these are universal dark overlays
 */
function getHardcodedColorViolations(source: string, filename: string): string[] {
  const violations: string[] = [];
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;

    // Skip AVATAR_COLORS array definition (decorative avatar colors)
    if (trimmed.startsWith('"#') && lines.slice(Math.max(0, i - 10), i).some(l => l.includes("AVATAR_COLORS"))) continue;

    // Skip theme preview swatches in SettingsModal (intentionally hardcoded for preview)
    if (filename === "SettingsModal.tsx") {
      // Mini preview swatches use literal dark/light colors to show theme preview
      if (trimmed.includes('value === "dark"') || trimmed.includes('value === "bw"')) continue;
      if (trimmed.includes('"#080a10"') || trimmed.includes('"#f0f2f5"') || trimmed.includes('"#111318"') || trimmed.includes('"#ffffff"')) {
        // Check if this is inside the preview swatch section
        const context = lines.slice(Math.max(0, i - 5), i + 1).join(" ");
        if (context.includes("preview swatch") || context.includes("Mini preview")) continue;
      }
    }

    // Check for text-white class usage
    if (/\btext-white\b/.test(line) && !trimmed.startsWith("//")) {
      violations.push(`Line ${i + 1}: text-white found — use text-tx-1 instead: ${trimmed.substring(0, 80)}`);
    }

    // Check for Tailwind arbitrary color classes like bg-[#...], text-[#...], border-[#...]
    const arbitraryColorRegex = /(?:bg|text|border|ring|outline|shadow|from|to|via)-\[#[0-9a-fA-F]+\]/g;
    const arbitraryMatches = line.match(arbitraryColorRegex);
    if (arbitraryMatches) {
      for (const match of arbitraryMatches) {
        violations.push(`Line ${i + 1}: Arbitrary Tailwind color class "${match}" — use theme token instead: ${trimmed.substring(0, 80)}`);
      }
    }

    // Check for inline style color properties with hardcoded hex values
    // Match: color: "#xxxxxx" or background: "#xxxxxx" patterns in inline styles
    const inlineHexRegex = /(?:color|background|backgroundColor|borderColor)\s*:\s*["']#[0-9a-fA-F]{3,8}["']/gi;
    const inlineHexMatches = line.match(inlineHexRegex);
    if (inlineHexMatches) {
      for (const match of inlineHexMatches) {
        // Allow semantic colors
        const hex = match.match(/#[0-9a-fA-F]+/)?.[0]?.toLowerCase();
        const allowedSemanticHex = ["#22c55e", "#ef4444", "#f59e0b", "#16a34a", "#dc2626", "#d97706", "#b45309", "#b91c1c", "#15803d"];
        if (hex && allowedSemanticHex.includes(hex)) continue;

        // Allow avatar colors (checking context)
        const isAvatarSection = lines.slice(Math.max(0, i - 15), i + 1).some(l =>
          l.includes("avatarColor") || l.includes("AVATAR_COLORS")
        );
        if (isAvatarSection) continue;

        // Allow theme preview section
        const isPreviewSection = lines.slice(Math.max(0, i - 10), i + 1).some(l =>
          l.includes("preview swatch") || l.includes("Mini preview")
        );
        if (isPreviewSection) continue;

        violations.push(`Line ${i + 1}: Inline style with hardcoded hex "${match}" — use theme token: ${trimmed.substring(0, 80)}`);
      }
    }

    // Check for inline style with rgba(255,255,255,...) — should use theme surface-rgb/border-rgb
    if (/style\s*=/.test(line) || /style\s*:\s*\{/.test(lines.slice(Math.max(0, i - 3), i + 1).join(" "))) {
      if (/rgba\(\s*255\s*,\s*255\s*,\s*255/.test(line)) {
        // Allow theme preview swatches
        const isPreviewSection = lines.slice(Math.max(0, i - 10), i + 1).some(l =>
          l.includes("preview swatch") || l.includes("Mini preview")
        );
        if (!isPreviewSection) {
          violations.push(`Line ${i + 1}: Inline rgba(255,255,255,...) — use theme variable (surface-rgb/border-rgb): ${trimmed.substring(0, 80)}`);
        }
      }
    }

    // Check for inline style color: "#f8fafc" (hardcoded white-ish)
    if (/["']#f8fafc["']/.test(line)) {
      violations.push(`Line ${i + 1}: Hardcoded #f8fafc — use text-tx-1 or var(--tx-1): ${trimmed.substring(0, 80)}`);
    }

    // Check for inline style color: "#0a0c18" or "#0d1118" (hardcoded dark background)
    if (/["']#0a0c1[8a]["']/.test(line) || /["']#0d111[8a]["']/.test(line)) {
      violations.push(`Line ${i + 1}: Hardcoded dark bg hex — use bg-bg-base or var(--bg-base): ${trimmed.substring(0, 80)}`);
    }
  }

  return violations;
}

describe("Theme token compliance — source-level checks", () => {
  for (const file of TARGET_FILES) {
    describe(file, () => {
      const filePath = path.join(COMPONENTS_DIR, file);

      it("file exists", () => {
        expect(fs.existsSync(filePath)).toBe(true);
      });

      it("contains no hardcoded color violations", () => {
        const source = fs.readFileSync(filePath, "utf-8");
        const violations = getHardcodedColorViolations(source, file);
        if (violations.length > 0) {
          throw new Error(
            `Found ${violations.length} hardcoded color violation(s) in ${file}:\n` +
            violations.map(v => `  • ${v}`).join("\n")
          );
        }
      });

      it("does not use text-white class", () => {
        const source = fs.readFileSync(filePath, "utf-8");
        const lines = source.split("\n");
        const textWhiteLines = lines
          .map((line, i) => ({ line: line.trim(), num: i + 1 }))
          .filter(({ line }) => !line.startsWith("//") && !line.startsWith("*"))
          .filter(({ line }) => /\btext-white\b/.test(line));
        expect(textWhiteLines).toEqual([]);
      });

      it("does not use arbitrary Tailwind color classes (bg-[#...], text-[#...], border-[#...])", () => {
        const source = fs.readFileSync(filePath, "utf-8");
        const regex = /(?:bg|text|border|ring|outline|from|to|via)-\[#[0-9a-fA-F]+\]/g;
        const matches = source.match(regex);
        expect(matches).toBeNull();
      });
    });
  }
});

// ── Render checks: CommandPalette ────────────────────────────────────────────

describe("CommandPalette — render check", () => {
  it("renders without crashing and uses theme classes", async () => {
    const { default: CommandPalette } = await import("@/components/CommandPalette");
    const items = [
      {
        id: "test",
        label: "Test Item",
        description: "A test",
        group: "Tests",
        Icon: () => <span data-testid="icon">icon</span>,
        run: vi.fn(),
      },
    ];

    const { container } = render(
      <CommandPalette open={true} onClose={vi.fn()} items={items} />
    );

    // Verify the command palette rendered
    expect(screen.getByPlaceholderText(/jump to/i)).toBeInTheDocument();
    expect(screen.getByText("Test Item")).toBeInTheDocument();

    // No hardcoded Tailwind color classes in rendered HTML
    const html = container.innerHTML;
    const arbitraryColors = html.match(/(?:bg|text|border)-\[#[0-9a-fA-F]+\]/g);
    expect(arbitraryColors).toBeNull();

    // No text-white class
    expect(html).not.toMatch(/\btext-white\b/);
  });

  it("shows 'No matches found' with theme text class, not text-white", async () => {
    const { default: CommandPalette } = await import("@/components/CommandPalette");

    render(
      <CommandPalette open={true} onClose={vi.fn()} items={[]} />
    );

    const noMatchText = screen.getByText("No matches found");
    expect(noMatchText).toBeInTheDocument();
    expect(noMatchText.className).toContain("text-tx-1");
    expect(noMatchText.className).not.toContain("text-white");
  });
});

// ── Render checks: Modal ─────────────────────────────────────────────────────

describe("Modal — render check", () => {
  it("renders with theme border classes instead of white opacity", async () => {
    const { default: Modal } = await import("@/components/Modal");

    render(
      <Modal open={true} onClose={vi.fn()} title="Test Modal">
        <p>Content</p>
      </Modal>
    );

    expect(screen.getByText("Test Modal")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();

    // Modal uses createPortal to document.body, so check body innerHTML
    const html = document.body.innerHTML;
    // Should have theme border classes
    expect(html).toContain("border-border");
    // Should NOT have border-white/[0.10]
    expect(html).not.toMatch(/border-white\/\[0\.10?\]/);
  });
});
