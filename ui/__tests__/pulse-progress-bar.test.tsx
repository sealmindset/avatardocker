import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import PulseProgressBar from "@/components/SbnProgressBar";

describe("PulseProgressBar", () => {
  it("renders all five PULSE Selling steps", () => {
    const html = renderToStaticMarkup(<PulseProgressBar currentStep={1} />);

    expect(html).toContain("Probe");
    expect(html).toContain("Understand");
    expect(html).toContain("Link");
    expect(html).toContain("Simplify");
    expect(html).toContain("Earn");
  });
});
