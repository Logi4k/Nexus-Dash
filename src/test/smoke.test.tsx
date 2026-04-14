import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

describe("Smoke test", () => {
  it("renders a div with text", () => {
    render(<div>Hello Nexus</div>);
    expect(screen.getByText("Hello Nexus")).toBeInTheDocument();
  });
});
