import { demoCatalog } from "@/lib/demoCatalog";
import type { Category, ConditionGrade } from "@/lib/types";
import type { ProviderProduct, ProviderSearchResult } from "@/lib/providers/types";

const sampleImages: Record<Category, string> = {
  laptop: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?q=80&w=900&auto=format&fit=crop",
  monitor: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?q=80&w=900&auto=format&fit=crop",
  robot_vacuum: "https://images.unsplash.com/photo-1603618090561-412154b4bd1b?q=80&w=900&auto=format&fit=crop",
  cordless_vacuum: "https://images.unsplash.com/photo-1558317374-067fb5f30001?q=80&w=900&auto=format&fit=crop",
  air_purifier: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?q=80&w=900&auto=format&fit=crop",
  dehumidifier: "https://images.unsplash.com/photo-1586208958839-06c17cacdf08?q=80&w=900&auto=format&fit=crop"
};

const fixtures: Record<Category, Array<Omit<ProviderProduct, "keyword" | "category">>> = {
  laptop: [
    {
      source: "mock",
      source_product_id: "mock-laptop-ideapad-5",
      title: "레노버 아이디어패드 5 16GB 512GB Ryzen 7 Win11 반품-최상",
      brand: "Lenovo",
      model_name: "IdeaPad 5",
      image_url: sampleImages.laptop,
      source_url: "https://www.coupang.com/np/goldbox",
      coupang_url: "https://www.coupang.com/np/goldbox",
      affiliate_url: "https://link.coupang.com/a/dPyGuoKdSm",
      source_price: 742000,
      return_price: 742000,
      new_price: 969000,
      condition_grade: "최상",
      stock_count: 1
    },
    {
      source: "mock",
      source_product_id: "mock-laptop-tuf",
      title: "ASUS TUF Gaming i7 16GB 1TB RTX 4060 FreeDOS 반품-확인필요",
      brand: "ASUS",
      model_name: "TUF Gaming",
      image_url: sampleImages.laptop,
      source_url: "https://www.coupang.com/np/goldbox",
      coupang_url: "https://www.coupang.com/np/goldbox",
      source_price: 1180000,
      return_price: null,
      new_price: 1450000,
      condition_grade: "확인필요",
      stock_count: 2
    }
  ],
  monitor: [
    {
      source: "mock",
      source_product_id: "mock-monitor-qhd-27",
      title: "LG 27인치 QHD 모니터 144Hz IPS 반품-상",
      brand: "LG",
      model_name: "27QHD144",
      image_url: sampleImages.monitor,
      source_url: "https://www.coupang.com/np/goldbox",
      coupang_url: "https://www.coupang.com/np/goldbox",
      source_price: 249000,
      return_price: 229000,
      new_price: 319000,
      condition_grade: "상",
      stock_count: 3
    }
  ],
  robot_vacuum: [
    {
      source: "mock",
      source_product_id: "mock-robot-roborock",
      title: "로보락 로봇청소기 자동먼지비움 물걸레 도킹스테이션 반품-최상",
      brand: "Roborock",
      model_name: "Q Revo",
      image_url: sampleImages.robot_vacuum,
      source_url: "https://www.coupang.com/np/goldbox",
      coupang_url: "https://www.coupang.com/np/goldbox",
      source_price: 689000,
      return_price: 649000,
      new_price: 849000,
      condition_grade: "최상",
      stock_count: 1
    }
  ],
  cordless_vacuum: [
    {
      source: "mock",
      source_product_id: "mock-vacuum-jet",
      title: "삼성 제트 무선청소기 배터리 거치대 필터 포함 반품-상",
      brand: "Samsung",
      model_name: "Jet",
      image_url: sampleImages.cordless_vacuum,
      source_url: "https://www.coupang.com/np/goldbox",
      coupang_url: "https://www.coupang.com/np/goldbox",
      source_price: 319000,
      return_price: 299000,
      new_price: 429000,
      condition_grade: "상",
      stock_count: 4
    }
  ],
  air_purifier: [
    {
      source: "mock",
      source_product_id: "mock-air-winix",
      title: "위닉스 공기청정기 21평형 HEPA 필터 반품-미개봉",
      brand: "Winix",
      model_name: "Tower Prime",
      image_url: sampleImages.air_purifier,
      source_url: "https://www.coupang.com/np/goldbox",
      coupang_url: "https://www.coupang.com/np/goldbox",
      source_price: 189000,
      return_price: 179000,
      new_price: 249000,
      condition_grade: "미개봉",
      stock_count: 5
    }
  ],
  dehumidifier: [
    {
      source: "mock",
      source_product_id: "mock-dehumidifier-lg",
      title: "LG 제습기 20L 연속배수 반품-최상",
      brand: "LG",
      model_name: "D20",
      image_url: sampleImages.dehumidifier,
      source_url: "https://www.coupang.com/np/goldbox",
      coupang_url: "https://www.coupang.com/np/goldbox",
      source_price: 399000,
      return_price: 369000,
      new_price: 489000,
      condition_grade: "최상",
      stock_count: 2
    }
  ]
};

function matchesKeyword(title: string, keyword: string) {
  const normalizedTitle = title.toLowerCase().replace(/\s+/g, "");
  const normalizedKeyword = keyword.toLowerCase().replace(/\s+/g, "");
  return normalizedTitle.includes(normalizedKeyword) || normalizedKeyword.length < 3;
}

export async function searchMockProducts(keyword: string, category: Category): Promise<ProviderSearchResult> {
  const base = demoCatalog.filter((item) => item.category === category);
  const filtered = base.filter((item) => matchesKeyword(item.title, keyword));
  const selected = filtered.length > 0 ? filtered : base.slice(0, 6);
  const products = selected.map((item) => ({
    ...item,
    category,
    keyword,
    condition_grade: (item.condition_grade ?? "확인필요") as ConditionGrade,
    raw_json: { provider: "mock", keyword, fixture_id: item.source_product_id }
  }));

  return { status: "ok", products };
}
