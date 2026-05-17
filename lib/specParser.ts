import type { Category, JsonValue } from "@/lib/types";

type Specs = Record<string, JsonValue>;

function firstMatch(title: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match?.[1]) return match[1].trim();
    if (match?.[0]) return match[0].trim();
  }
  return null;
}

function hasAny(title: string, tokens: string[]) {
  const normalized = title.toLowerCase();
  return tokens.some((token) => normalized.includes(token.toLowerCase()));
}

export function parseSpecsFromTitle(title: string, category: Category): Specs {
  const normalized = title.replace(/\s+/g, " ").trim();
  const specs: Specs = {};

  if (category === "laptop") {
    const ram = firstMatch(normalized, [/(\d{1,2})\s?GB\s?(?:RAM|램|메모리)?/i]);
    const ssd = firstMatch(normalized, [/(\d{3,4}\s?GB|\d\s?TB)\s?(?:SSD|저장|NVMe)?/i]);
    const cpu = firstMatch(normalized, [
      /(Ultra\s?[3579])/i,
      /(i[3579]-?\d{0,5}[A-Z]{0,3})/i,
      /(Ryzen\s?[3579]\s?\d{0,4}[A-Z]{0,3})/i
    ]);
    const gpu = firstMatch(normalized, [/(RTX\s?\d{4})/i, /(GTX\s?\d{4})/i, /(Arc\s?[A-Z]?\d{3})/i]);
    const weight = firstMatch(normalized, [/(\d(?:\.\d{1,2})?)\s?kg/i]);

    if (ram) specs.ram = ram.toUpperCase().replace(/\s+/g, "");
    if (ssd) specs.ssd = ssd.toUpperCase().replace(/\s+/g, "");
    if (cpu) specs.cpu = cpu.replace(/\s+/g, " ");
    if (gpu) specs.gpu = gpu.toUpperCase().replace(/\s+/g, " ");
    if (weight) specs.weight = `${weight}kg`;
    specs.os = hasAny(normalized, ["FreeDOS", "프리도스"]) ? "FreeDOS" : hasAny(normalized, ["Windows", "Win11", "윈도우"]) ? "Windows" : null;
    return specs;
  }

  if (category === "monitor") {
    const size = firstMatch(normalized, [/(\d{2})\s?(?:인치|형|")/i]);
    const refreshRate = firstMatch(normalized, [/(\d{2,3})\s?Hz/i]);
    const resolution = firstMatch(normalized, [/(FHD|QHD|UHD|4K|WQHD)/i]);
    if (size) specs.size = `${size}인치`;
    if (resolution) specs.resolution = resolution.toUpperCase();
    if (refreshRate) specs.refresh_rate = `${refreshRate}Hz`;
    if (hasAny(normalized, ["IPS", "VA", "OLED"])) specs.panel = firstMatch(normalized, [/(IPS|VA|OLED)/i]);
    return specs;
  }

  if (category === "robot_vacuum") {
    specs.auto_empty = hasAny(normalized, ["자동먼지비움", "자동 먼지", "오토엠티", "auto empty"]);
    specs.mop = hasAny(normalized, ["물걸레", "mop"]);
    specs.dock_station = hasAny(normalized, ["도킹", "도크", "스테이션", "dock"]);
    return specs;
  }

  if (category === "cordless_vacuum") {
    specs.stand = hasAny(normalized, ["거치대", "스탠드"]);
    specs.battery = hasAny(normalized, ["배터리", "battery"]);
    specs.filter = hasAny(normalized, ["필터", "filter"]);
    return specs;
  }

  if (category === "air_purifier") {
    const coverage = firstMatch(normalized, [/(\d{1,3})\s?(?:평형|평|㎡|m2)/i]);
    if (coverage) specs.coverage = coverage;
    specs.filter = hasAny(normalized, ["필터", "헤파", "HEPA"]);
    return specs;
  }

  if (category === "dehumidifier") {
    const capacity = firstMatch(normalized, [/(\d{1,2}(?:\.\d)?)\s?(?:L|리터)/i]);
    if (capacity) specs.capacity = `${capacity}L`;
    return specs;
  }

  return specs;
}
