import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Pipeline Navigation Context Tests
 * Ensures the pipeline page preserves the last visited pipeline
 * instead of always falling back to the default pipeline.
 */

const pipelineSrc = readFileSync(
  resolve(__dirname, "../client/src/pages/Pipeline.tsx"),
  "utf-8"
);
const dealDetailSrc = readFileSync(
  resolve(__dirname, "../client/src/pages/DealDetail.tsx"),
  "utf-8"
);

describe("Pipeline Navigation — Last Visited Pipeline Preservation", () => {
  it("Pipeline.tsx must read lastVisitedPipelineId from sessionStorage on load", () => {
    expect(pipelineSrc).toContain('sessionStorage.getItem("lastVisitedPipelineId")');
  });

  it("Pipeline.tsx must write lastVisitedPipelineId to sessionStorage when pipeline changes", () => {
    expect(pipelineSrc).toContain('sessionStorage.setItem("lastVisitedPipelineId"');
  });

  it("Pipeline initialization must check lastVisited BEFORE defaultPipelinePref", () => {
    const lastVisitedIdx = pipelineSrc.indexOf('sessionStorage.getItem("lastVisitedPipelineId")');
    const defaultPrefIdx = pipelineSrc.indexOf("defaultPipelinePref.data?.value");
    expect(lastVisitedIdx).toBeGreaterThan(-1);
    expect(defaultPrefIdx).toBeGreaterThan(-1);
    // lastVisited must come before defaultPref in the initialization useEffect
    expect(lastVisitedIdx).toBeLessThan(defaultPrefIdx);
  });

  it("Pipeline initialization must still have fallback to first sales pipeline", () => {
    // The fallback logic must exist after both lastVisited and defaultPref checks
    expect(pipelineSrc).toContain('pipelineType === "sales"');
    expect(pipelineSrc).toContain("pipelines.data[0]?.id");
  });

  it("Pipeline must validate lastVisited pipeline exists and is not archived", () => {
    // After reading from sessionStorage, must check the pipeline exists
    const initBlock = pipelineSrc.slice(
      pipelineSrc.indexOf("sessionStorage.getItem"),
      pipelineSrc.indexOf("sessionStorage.getItem") + 300
    );
    expect(initBlock).toContain("isArchived");
  });

  it("DealDetail back button must navigate to /pipeline (sessionStorage handles the rest)", () => {
    // DealDetail navigates to /pipeline, and Pipeline.tsx reads sessionStorage
    expect(dealDetailSrc).toContain('setLocation("/pipeline")');
  });
});

describe("Pipeline Navigation — No Regression", () => {
  it("Pipeline must still support default pipeline preference as second priority", () => {
    expect(pipelineSrc).toContain("default_pipeline_id");
    expect(pipelineSrc).toContain("defaultPipelinePref");
  });

  it("Pipeline must still have the set-default-pipeline mutation", () => {
    expect(pipelineSrc).toContain("setDefaultPipelineMut");
    expect(pipelineSrc).toContain("Funil padrão salvo");
  });

  it("selectedPipelineId state must still exist for pipeline selector", () => {
    expect(pipelineSrc).toContain("selectedPipelineId, setSelectedPipelineId");
  });
});
