import Papa from "papaparse";
import * as XLSX from "xlsx";

export type ColumnType = "numeric" | "categorical" | "boolean" | "date" | "text";

export type ColumnStat = {
  name: string;
  type: ColumnType;
  missing: number;
  unique: number;
  min?: number;
  max?: number;
  mean?: number;
  std?: number;
  topValues?: { value: string; count: number }[];
};

export type DatasetSummary = {
  rows: number;
  cols: number;
  columns: ColumnStat[];
  sampleRows: Record<string, unknown>[];
  missingTotal: number;
  qualityScore: number; // 0..100
  targetCandidates: string[];
  taskHint: "classification" | "regression" | "unknown";
  rawRows: Record<string, unknown>[];
};

const isNumeric = (v: unknown) => v !== null && v !== "" && v !== undefined && !isNaN(Number(v));

const inferType = (values: unknown[]): ColumnType => {
  const non = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (non.length === 0) return "text";
  const numericCount = non.filter(isNumeric).length;
  if (numericCount / non.length > 0.9) return "numeric";
  const lower = non.map((v) => String(v).toLowerCase());
  if (lower.every((v) => ["true", "false", "0", "1", "yes", "no"].includes(v))) return "boolean";
  const unique = new Set(non.map(String));
  if (unique.size <= Math.max(20, non.length * 0.05)) return "categorical";
  if (non.every((v) => !isNaN(Date.parse(String(v))))) return "date";
  return "text";
};

const computeStat = (name: string, values: unknown[]): ColumnStat => {
  const total = values.length;
  const missing = values.filter(
    (v) => v === null || v === undefined || v === "" || v === "NA" || v === "NaN",
  ).length;
  const present = values.filter((v) => !(v === null || v === undefined || v === "" || v === "NA"));
  const type = inferType(present);
  const uniqueSet = new Set(present.map(String));
  const stat: ColumnStat = {
    name,
    type,
    missing,
    unique: uniqueSet.size,
  };
  if (type === "numeric") {
    const nums = present.map(Number).filter((n) => !isNaN(n));
    if (nums.length) {
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
      stat.mean = mean;
      stat.std = Math.sqrt(variance);
      stat.min = Math.min(...nums);
      stat.max = Math.max(...nums);
    }
  } else {
    const counts = new Map<string, number>();
    present.forEach((v) => {
      const s = String(v);
      counts.set(s, (counts.get(s) ?? 0) + 1);
    });
    stat.topValues = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([value, count]) => ({ value, count }));
  }
  void total;
  return stat;
};

const detectTargets = (columns: ColumnStat[]): string[] => {
  const keywords = [
    "target",
    "label",
    "class",
    "churn",
    "outcome",
    "result",
    "y",
    "price",
    "salary",
    "revenue",
    "score",
    "rating",
    "approved",
    "fraud",
    "default",
    "survived",
  ];
  const matches = columns.filter((c) => keywords.some((k) => c.name.toLowerCase().includes(k)));
  if (matches.length) return matches.map((c) => c.name);
  // Fallback: last column with low cardinality or numeric
  const last = columns[columns.length - 1];
  return last ? [last.name] : [];
};

const inferTask = (columns: ColumnStat[], targets: string[]): DatasetSummary["taskHint"] => {
  if (!targets.length) return "unknown";
  const t = columns.find((c) => c.name === targets[0]);
  if (!t) return "unknown";
  if (t.type === "boolean" || t.type === "categorical") return "classification";
  if (t.type === "numeric" && t.unique > 20) return "regression";
  if (t.type === "numeric") return "classification";
  return "unknown";
};

const buildSummary = (rows: Record<string, unknown>[]): DatasetSummary => {
  if (!rows.length) {
    return {
      rows: 0,
      cols: 0,
      columns: [],
      sampleRows: [],
      missingTotal: 0,
      qualityScore: 0,
      targetCandidates: [],
      taskHint: "unknown",
      rawRows: [],
    };
  }
  const colNames = Object.keys(rows[0]);
  const columns = colNames.map((name) =>
    computeStat(
      name,
      rows.map((r) => r[name]),
    ),
  );
  const missingTotal = columns.reduce((a, c) => a + c.missing, 0);
  const cells = rows.length * colNames.length || 1;
  const qualityScore = Math.round(
    Math.max(0, 100 - (missingTotal / cells) * 100 - (rows.length < 50 ? 15 : 0)),
  );
  const targets = detectTargets(columns);
  return {
    rows: rows.length,
    cols: colNames.length,
    columns,
    sampleRows: rows.slice(0, 5),
    missingTotal,
    qualityScore,
    targetCandidates: targets,
    taskHint: inferTask(columns, targets),
    rawRows: rows.slice(0, 1000),
  };
};

export async function parseFile(file: File): Promise<DatasetSummary> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const text = await file.text();
    const result = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    });
    return buildSummary(result.data);
  }
  if (name.endsWith(".json")) {
    const text = await file.text();
    let parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed) && typeof parsed === "object" && parsed) {
      const vals = Object.values(parsed as Record<string, unknown>);
      if (Array.isArray(vals[0])) parsed = vals[0];
    }
    return buildSummary(parsed as Record<string, unknown>[]);
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    return buildSummary(rows);
  }
  throw new Error("Unsupported file type. Use CSV, XLSX, JSON, or TXT.");
}

/* ---------- Mock ML lab (heuristic, runs client-side) ---------- */

export type ModelResult = {
  name: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  trainMs: number;
};

const seededRand = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

export function runModelLab(summary: DatasetSummary): ModelResult[] {
  // Heuristic "accuracy" derived from data quality, size, and task suitability.
  const base = Math.min(
    0.98,
    0.6 + summary.qualityScore / 250 + Math.min(summary.rows, 5000) / 50000,
  );
  const rand = seededRand(summary.rows * summary.cols + summary.qualityScore);
  const models = [
    { name: "Random Forest", boost: 0.06 },
    { name: "XGBoost", boost: 0.05 },
    { name: "Decision Tree", boost: 0.0 },
    { name: "Logistic Regression", boost: -0.02 },
    { name: "KNN", boost: -0.05 },
    { name: "SVM", boost: -0.03 },
  ];
  return models
    .map((m) => {
      const noise = (rand() - 0.5) * 0.04;
      const acc = Math.max(0.55, Math.min(0.995, base + m.boost + noise));
      const prec = Math.max(0.5, Math.min(0.995, acc - rand() * 0.03));
      const rec = Math.max(0.5, Math.min(0.995, acc - rand() * 0.04));
      const f1 = (2 * prec * rec) / (prec + rec);
      return {
        name: m.name,
        accuracy: acc,
        precision: prec,
        recall: rec,
        f1,
        trainMs: Math.round(80 + rand() * 600),
      };
    })
    .sort((a, b) => b.accuracy - a.accuracy);
}

export type FeatureImportance = {
  name: string;
  importance: number; // 0..1
  correlation: number; // -1..1
};

export function computeFeatureImportance(summary: DatasetSummary): FeatureImportance[] {
  const target = summary.targetCandidates[0];
  const targetCol = summary.columns.find((c) => c.name === target);
  const features = summary.columns.filter((c) => c.name !== target);
  const rand = seededRand(summary.cols * 17 + summary.rows);

  const scored = features.map((f) => {
    let corr = 0;
    if (targetCol && targetCol.type === "numeric" && f.type === "numeric") {
      const xs = summary.rawRows.map((r) => Number(r[f.name])).filter((n) => !isNaN(n));
      const ys = summary.rawRows.map((r) => Number(r[targetCol.name])).filter((n) => !isNaN(n));
      const n = Math.min(xs.length, ys.length);
      if (n > 2) {
        const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
        const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
        let num = 0;
        let dx = 0;
        let dy = 0;
        for (let i = 0; i < n; i++) {
          const a = xs[i] - mx;
          const b = ys[i] - my;
          num += a * b;
          dx += a * a;
          dy += b * b;
        }
        const denom = Math.sqrt(dx * dy);
        corr = denom === 0 ? 0 : num / denom;
      }
    } else {
      corr = (rand() - 0.5) * 1.4;
      corr = Math.max(-1, Math.min(1, corr));
    }
    // Penalize missing and very high cardinality
    const missingPenalty = f.missing / (summary.rows || 1);
    const cardinalityPenalty = f.type === "text" ? 0.4 : 0;
    const importance = Math.max(
      0.05,
      Math.min(1, Math.abs(corr) + rand() * 0.25 - missingPenalty - cardinalityPenalty),
    );
    return { name: f.name, importance, correlation: corr };
  });
  // Normalize so top = 1
  const max = Math.max(...scored.map((s) => s.importance), 0.01);
  return scored
    .map((s) => ({ ...s, importance: s.importance / max }))
    .sort((a, b) => b.importance - a.importance);
}

export function summaryForPrompt(summary: DatasetSummary) {
  return {
    rows: summary.rows,
    cols: summary.cols,
    quality: summary.qualityScore,
    missing: summary.missingTotal,
    task: summary.taskHint,
    target_candidates: summary.targetCandidates,
    columns: summary.columns.map((c) => ({
      name: c.name,
      type: c.type,
      missing: c.missing,
      unique: c.unique,
      ...(c.mean !== undefined
        ? {
            mean: Number(c.mean.toFixed(3)),
            std: Number((c.std ?? 0).toFixed(3)),
            min: c.min,
            max: c.max,
          }
        : { top: c.topValues }),
    })),
    sample_rows: summary.sampleRows,
  };
}
