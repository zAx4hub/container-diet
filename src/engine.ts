/** container-diet — image shrink recommendations by zAx4hub */

export type Layer = { index: number; instruction: string; kind: string; estimatedMb: number };
export type Suggestion = { priority: "high" | "medium" | "low"; title: string; detail: string; savingsMb: number };

export type Report = {
  project: string;
  author: string;
  summary: string;
  baseImage: string;
  layers: Layer[];
  suggestions: Suggestion[];
  estimatedSizeMb: number;
  potentialSizeMb: number;
  metrics: Record<string, number>;
};

const AUTHOR = "zAx4hub";

const SLIM_MAP: Record<string, string> = {
  "node:": "node:20-alpine",
  "python:": "python:3.12-slim",
  "golang:": "golang:1.22-alpine",
  "ubuntu:": "debian:bookworm-slim",
  "debian:": "debian:bookworm-slim",
  "nginx:": "nginx:alpine",
};

const BLOAT_PACKAGES = ["curl", "wget", "git", "vim", "build-essential", "python3-dev", "gcc", "make"];

export function parseDockerfile(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

export function classify(instruction: string): Layer {
  const upper = instruction.toUpperCase();
  let kind = "other";
  let estimatedMb = 5;
  if (upper.startsWith("FROM ")) {
    kind = "from";
    estimatedMb = instruction.toLowerCase().includes("alpine") ? 40 : instruction.toLowerCase().includes("slim") ? 80 : 200;
  } else if (upper.startsWith("RUN ")) {
    kind = "run";
    estimatedMb = 25;
    for (const pkg of BLOAT_PACKAGES) {
      if (instruction.toLowerCase().includes(pkg)) estimatedMb += 18;
    }
    if (/apt-get|apk|yum/.test(instruction) && !/rm\s+-rf\s+\/var\/lib\/apt/.test(instruction)) estimatedMb += 30;
  } else if (upper.startsWith("COPY ") || upper.startsWith("ADD ")) {
    kind = "copy";
    estimatedMb = instruction.includes("node_modules") || instruction.includes(".") ? 80 : 15;
  } else if (upper.startsWith("ENV ") || upper.startsWith("ARG ")) {
    kind = "meta";
    estimatedMb = 0;
  } else if (upper.startsWith("WORKDIR ") || upper.startsWith("USER ") || upper.startsWith("EXPOSE ") || upper.startsWith("CMD ") || upper.startsWith("ENTRYPOINT ")) {
    kind = "meta";
    estimatedMb = 0;
  }
  return { index: 0, instruction, kind, estimatedMb };
}

export function suggestSlimBase(fromLine: string): Suggestion | null {
  const image = fromLine.replace(/^FROM\s+/i, "").split(/\s+/)[0] ?? "";
  for (const [prefix, slim] of Object.entries(SLIM_MAP)) {
    if (image.startsWith(prefix) && image !== slim && !image.includes("alpine") && !image.includes("slim")) {
      return {
        priority: "high",
        title: "Switch to slim/alpine base",
        detail: `Replace \`${image}\` with \`${slim}\``,
        savingsMb: 120,
      };
    }
  }
  return null;
}

export function analyze(dockerfile: string): Report {
  const lines = parseDockerfile(dockerfile);
  const layers = lines.map((instruction, index) => ({ ...classify(instruction), index }));
  const from = layers.find((l) => l.kind === "from");
  const baseImage = from?.instruction.replace(/^FROM\s+/i, "").split(/\s+/)[0] ?? "unknown";
  const suggestions: Suggestion[] = [];
  if (from) {
    const s = suggestSlimBase(from.instruction);
    if (s) suggestions.push(s);
  }
  const multiFrom = layers.filter((l) => l.kind === "from").length;
  if (multiFrom < 2 && layers.some((l) => /gcc|build-essential|go build|npm (ci|install)/i.test(l.instruction))) {
    suggestions.push({
      priority: "high",
      title: "Use multi-stage build",
      detail: "Compile/install in a builder stage; copy only artifacts to runtime stage.",
      savingsMb: 200,
    });
  }
  for (const layer of layers) {
    if (layer.kind === "run" && /apt-get install/i.test(layer.instruction) && !/rm\s+-rf\s+\/var\/lib\/apt/.test(layer.instruction)) {
      suggestions.push({
        priority: "medium",
        title: "Clean apt cache in same RUN",
        detail: `Layer #${layer.index}: append && rm -rf /var/lib/apt/lists/*`,
        savingsMb: 40,
      });
    }
    if (layer.kind === "copy" && /\s\.\s/.test(layer.instruction)) {
      suggestions.push({
        priority: "medium",
        title: "Add .dockerignore",
        detail: "Avoid copying .git, node_modules, tests, and docs into the image context.",
        savingsMb: 90,
      });
    }
  }
  if (layers.some((l) => /curl|wget|git|vim/.test(l.instruction.toLowerCase()))) {
    suggestions.push({
      priority: "low",
      title: "Drop debug packages from runtime",
      detail: "Keep curl/git/vim out of the final stage unless required at runtime.",
      savingsMb: 35,
    });
  }
  const estimatedSizeMb = layers.reduce((a, l) => a + l.estimatedMb, 0);
  const savings = suggestions.reduce((a, s) => a + s.savingsMb, 0);
  const potentialSizeMb = Math.max(20, estimatedSizeMb - savings);
  return {
    project: "container-diet",
    author: AUTHOR,
    summary: `base=${baseImage} layers=${layers.length} est=${estimatedSizeMb}MB → ~${potentialSizeMb}MB (${suggestions.length} tips)`,
    baseImage,
    layers,
    suggestions,
    estimatedSizeMb,
    potentialSizeMb,
    metrics: { layers: layers.length, suggestions: suggestions.length, savingsMb: savings },
  };
}

export function run(input: { dockerfile?: string } = {}): Report {
  return analyze(input.dockerfile ?? DEMO_DOCKERFILE);
}

const DEMO_DOCKERFILE = `FROM node:20
WORKDIR /app
COPY . .
RUN apt-get update && apt-get install -y git curl vim
RUN npm install
CMD ["node", "server.js"]
`;

export function demo(): Report {
  return analyze(DEMO_DOCKERFILE);
}

export function dockerignoreFor(paths: string[]): string {
  const defaults = [".git", "node_modules", "**/__pycache__", "*.md", "tests", ".env", "dist"];
  return [...new Set([...defaults, ...paths])].join("\n") + "\n";
}

export function inspect() {
  return {
    name: "container-diet",
    author: AUTHOR,
    oneLiner: "Image shrink recommendations",
    version: "0.1.0",
    features: ["Dockerfile parse", "slim base map", "multi-stage advice", "apt cache cleanup", ".dockerignore"],
    commands: ["demo", "run", "inspect"],
  };
}
