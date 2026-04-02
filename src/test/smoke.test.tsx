import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";

describe("Smoke test", () => {
  it("renders a div with text", () => {
    const { container } = render(<div>Hello Nexus</div>);
    expect(container.textContent).toContain("Hello Nexus");
  });
});
