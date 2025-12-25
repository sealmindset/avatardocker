import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// TrainingPage has no Next.js-specific imports, so it is safe to render in a plain Node test env.

describe("TrainingPage gating", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("shows disabled message when training is not enabled", async () => {
    process.env.NEXT_PUBLIC_ENV_NAME = "prod";
    process.env.NEXT_PUBLIC_ENABLE_TRAINING = "true";

    const mod = await import("../app/training/page");
    const TrainingPage = mod.default;

    const html = renderToStaticMarkup(React.createElement(TrainingPage));
    expect(html).toContain("Training is disabled in this environment");
  });

  it("renders full training UI when enabled in non-prod", async () => {
    process.env.NEXT_PUBLIC_ENV_NAME = "local";
    process.env.NEXT_PUBLIC_ENABLE_TRAINING = "true";

    const mod = await import("../app/training/page");
    const TrainingPage = mod.default;

    const html = renderToStaticMarkup(React.createElement(TrainingPage));
    expect(html).toContain("PULSE Training (Phase A/B Stub)");
    expect(html).toContain("Submit Answer");
  });
});
