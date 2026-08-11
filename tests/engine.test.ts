import { describe, it, expect } from "vitest";
import { parseDockerfile, analyze, suggestSlimBase, dockerignoreFor, demo, inspect, run } from "../src/engine";

describe("container-diet", () => {
  it("parses Dockerfile lines", () => {
    const lines = parseDockerfile("FROM node:20\n# comment\nRUN echo hi\n");
    expect(lines).toEqual(["FROM node:20", "RUN echo hi"]);
  });

  it("suggests slim base", () => {
    const s = suggestSlimBase("FROM node:20");
    expect(s?.detail).toContain("alpine");
  });

  it("analyzes bloated Dockerfile", () => {
    const r = analyze(`FROM ubuntu:22.04
COPY . .
RUN apt-get update && apt-get install -y git curl
RUN npm install`);
    expect(r.suggestions.length).toBeGreaterThan(1);
    expect(r.potentialSizeMb).toBeLessThan(r.estimatedSizeMb);
    expect(r.author).toContain("zAx4hub");
  });

  it("dockerignore + demo/inspect/run", () => {
    expect(dockerignoreFor(["coverage"])).toContain(".git");
    expect(demo().baseImage).toBeTruthy();
    expect(inspect().name).toBe("container-diet");
    expect(run({}).suggestions.length).toBeGreaterThan(0);
  });
});
