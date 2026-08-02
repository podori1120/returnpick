import type { Category, JsonValue } from "@/lib/types";

export type ProductSpecSource = {
  category: Category;
  spec_json: Record<string, JsonValue>;
};

export type ProductSpecRow = {
  key: string;
  label: string;
  value: string;
  isConfirmedInTitle: boolean;
};

type SpecDefinition = {
  key: string;
  label: string;
  format?: (value: JsonValue | undefined) => string | null;
};

const definitions: Record<Category, SpecDefinition[]> = {
  laptop: [
    { key: "cpu", label: "CPU" },
    { key: "ram", label: "RAM" },
    { key: "ssd", label: "저장장치" },
    { key: "gpu", label: "그래픽" },
    { key: "os", label: "운영체제" },
    { key: "weight", label: "무게" }
  ],
  monitor: [
    { key: "size", label: "화면 크기" },
    { key: "resolution", label: "해상도" },
    { key: "refresh_rate", label: "주사율" },
    { key: "panel", label: "패널" }
  ],
  robot_vacuum: [
    { key: "auto_empty", label: "자동 먼지비움", format: formatBooleanSpec },
    { key: "mop", label: "물걸레", format: formatBooleanSpec },
    { key: "dock_station", label: "도킹 스테이션", format: formatBooleanSpec }
  ],
  cordless_vacuum: [
    { key: "stand", label: "거치대", format: formatBooleanSpec },
    { key: "battery", label: "배터리", format: formatBooleanSpec },
    { key: "filter", label: "필터", format: formatBooleanSpec }
  ],
  air_purifier: [
    { key: "coverage", label: "사용 면적" },
    { key: "filter", label: "필터", format: formatBooleanSpec }
  ],
  dehumidifier: [{ key: "capacity", label: "제습 용량" }]
};

function formatBooleanSpec(value: JsonValue | undefined) {
  if (value === true) return "상품명에 표기됨";
  return "상품명에 미표기";
}

function formatValue(value: JsonValue | undefined, formatter?: SpecDefinition["format"]) {
  if (formatter) return formatter(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

export function getProductSpecRows(product: ProductSpecSource): ProductSpecRow[] {
  return (definitions[product.category] ?? []).map((definition) => {
    const rawValue = product.spec_json?.[definition.key];
    const formatted = formatValue(rawValue, definition.format);
    return {
      key: definition.key,
      label: definition.label,
      value: formatted ?? "확인필요",
      isConfirmedInTitle: formatted !== null && (definition.format ? rawValue === true : true)
    };
  });
}

export function formatProductSpecSummary(product: ProductSpecSource) {
  return getProductSpecRows(product)
    .filter((row) => row.isConfirmedInTitle)
    .map((row) => `${row.label} ${row.value}`)
    .join(" · ");
}
