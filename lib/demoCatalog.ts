import type { Category, ConditionGrade } from "@/lib/types";

export type DemoProduct = {
  source: string;
  source_product_id: string;
  category: Category;
  keyword: string;
  title: string;
  brand: string;
  model_name: string;
  image_url: string;
  source_url: string;
  coupang_url: string;
  affiliate_url: string;
  source_price: number;
  return_price: number | null;
  new_price: number;
  naver_lowest_price: number;
  condition_grade: ConditionGrade;
  stock_count: number | null;
  public_note: string;
};

const images: Record<Category, string> = {
  laptop: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?q=80&w=900&auto=format&fit=crop",
  monitor: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?q=80&w=900&auto=format&fit=crop",
  robot_vacuum: "https://images.unsplash.com/photo-1603618090561-412154b4bd1b?q=80&w=900&auto=format&fit=crop",
  cordless_vacuum: "https://images.unsplash.com/photo-1558317374-067fb5f30001?q=80&w=900&auto=format&fit=crop",
  air_purifier: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?q=80&w=900&auto=format&fit=crop",
  dehumidifier: "https://images.unsplash.com/photo-1586208958839-06c17cacdf08?q=80&w=900&auto=format&fit=crop"
};

function product(input: Omit<DemoProduct, "source" | "image_url" | "source_url" | "coupang_url" | "affiliate_url">): DemoProduct {
  const slug = input.source_product_id.replace(/^seed-/, "");
  return {
    ...input,
    source: "mock",
    image_url: images[input.category],
    source_url: `https://example.com/coupang/${slug}`,
    coupang_url: `https://example.com/coupang/${slug}`,
    affiliate_url: `https://example.com/deeplink/${slug}`
  };
}

const baseDemoCatalog: DemoProduct[] = [
  product({
    source_product_id: "seed-galaxybook4-ultra5",
    category: "laptop",
    keyword: "갤럭시북",
    title: "삼성 갤럭시북4 16GB 512GB Core Ultra 5 Win11 반품-최상",
    brand: "Samsung",
    model_name: "Galaxy Book4",
    source_price: 879000,
    return_price: 859000,
    new_price: 1199000,
    naver_lowest_price: 1168000,
    condition_grade: "최상",
    stock_count: 2,
    public_note: "반품등급과 가격 차이가 모두 확인된 사무·학습용 후보입니다."
  }),
  product({
    source_product_id: "seed-galaxybook4-pro",
    category: "laptop",
    keyword: "갤럭시북",
    title: "삼성 갤럭시북4 프로 16GB 1TB Ultra 7 Win11 반품-상",
    brand: "Samsung",
    model_name: "Galaxy Book4 Pro",
    source_price: 1289000,
    return_price: 1249000,
    new_price: 1699000,
    naver_lowest_price: 1620000,
    condition_grade: "상",
    stock_count: 1,
    public_note: "고해상도 작업과 휴대성을 같이 보는 사용자에게 맞는 고급형 후보입니다."
  }),
  product({
    source_product_id: "seed-lg-gram-14",
    category: "laptop",
    keyword: "LG 그램",
    title: "LG 그램 14 16GB 512GB Ultra 5 Win11 1.1kg 반품-최상",
    brand: "LG",
    model_name: "Gram 14",
    source_price: 969000,
    return_price: 929000,
    new_price: 1390000,
    naver_lowest_price: 1320000,
    condition_grade: "최상",
    stock_count: 2,
    public_note: "가벼운 노트북을 찾는 대학생·출장용 후보입니다."
  }),
  product({
    source_product_id: "seed-lg-gram-16",
    category: "laptop",
    keyword: "LG 그램",
    title: "LG 그램 16 16GB 1TB Ultra 7 Win11 1.2kg 반품-미개봉",
    brand: "LG",
    model_name: "Gram 16",
    source_price: 1399000,
    return_price: 1349000,
    new_price: 1790000,
    naver_lowest_price: 1720000,
    condition_grade: "미개봉",
    stock_count: 1,
    public_note: "미개봉 등급이면 가격 차이가 작아도 안정성이 높은 편입니다."
  }),
  product({
    source_product_id: "seed-lenovo-ideapad5",
    category: "laptop",
    keyword: "레노버 아이디어패드",
    title: "레노버 아이디어패드 5 16GB 512GB Ryzen 7 Win11 반품-최상",
    brand: "Lenovo",
    model_name: "IdeaPad 5",
    source_price: 742000,
    return_price: 742000,
    new_price: 969000,
    naver_lowest_price: 965000,
    condition_grade: "최상",
    stock_count: 1,
    public_note: "사무, 대학생, 재택용으로 균형이 좋은 후보입니다."
  }),
  product({
    source_product_id: "seed-lenovo-legion5",
    category: "laptop",
    keyword: "레노버 리전",
    title: "레노버 리전 5 i7 16GB 1TB RTX 4060 FreeDOS 반품-상",
    brand: "Lenovo",
    model_name: "Legion 5",
    source_price: 1199000,
    return_price: 1149000,
    new_price: 1599000,
    naver_lowest_price: 1510000,
    condition_grade: "상",
    stock_count: 2,
    public_note: "게이밍 노트북은 발열과 사용 흔적 확인이 꼭 필요합니다."
  }),
  product({
    source_product_id: "seed-hp-victus-16",
    category: "laptop",
    keyword: "HP 빅터스",
    title: "HP 빅터스 16 Ryzen 7 16GB 512GB RTX 4050 FreeDOS 반품-최상",
    brand: "HP",
    model_name: "Victus 16",
    source_price: 989000,
    return_price: 949000,
    new_price: 1299000,
    naver_lowest_price: 1230000,
    condition_grade: "최상",
    stock_count: 3,
    public_note: "성능 대비 가격이 괜찮지만 OS 설치 비용을 확인해야 합니다."
  }),
  product({
    source_product_id: "seed-asus-tuf-a15",
    category: "laptop",
    keyword: "ASUS TUF",
    title: "ASUS TUF A15 Ryzen 7 16GB 1TB RTX 4060 FreeDOS 반품-확인필요",
    brand: "ASUS",
    model_name: "TUF A15",
    source_price: 1180000,
    return_price: null,
    new_price: 1450000,
    naver_lowest_price: 1390000,
    condition_grade: "확인필요",
    stock_count: 2,
    public_note: "반품가와 등급 확인 전에는 보류해야 하는 후보입니다."
  }),
  product({
    source_product_id: "seed-msi-cyborg",
    category: "laptop",
    keyword: "MSI 노트북",
    title: "MSI 사이보그 i5 16GB 512GB RTX 4050 FreeDOS 반품-상",
    brand: "MSI",
    model_name: "Cyborg",
    source_price: 839000,
    return_price: 799000,
    new_price: 1099000,
    naver_lowest_price: 1050000,
    condition_grade: "상",
    stock_count: 2,
    public_note: "입문 게이밍용으로 가격 차이가 있으면 검토할 만합니다."
  }),
  product({
    source_product_id: "seed-macbook-air-m2",
    category: "laptop",
    keyword: "맥북",
    title: "애플 맥북에어 M2 8GB 256GB 반품-최상",
    brand: "Apple",
    model_name: "MacBook Air M2",
    source_price: 969000,
    return_price: 939000,
    new_price: 1190000,
    naver_lowest_price: 1130000,
    condition_grade: "최상",
    stock_count: 1,
    public_note: "RAM 8GB 모델이라 가벼운 작업 중심으로 봐야 합니다."
  }),
  product({
    source_product_id: "seed-lg-qhd-27-144",
    category: "monitor",
    keyword: "QHD 모니터",
    title: "LG 27인치 QHD 모니터 144Hz IPS 반품-상",
    brand: "LG",
    model_name: "27QHD144",
    source_price: 249000,
    return_price: 229000,
    new_price: 319000,
    naver_lowest_price: 312000,
    condition_grade: "상",
    stock_count: 3,
    public_note: "QHD 144Hz 조합은 재택과 게임을 함께 쓰기 좋습니다."
  }),
  product({
    source_product_id: "seed-samsung-4k-32",
    category: "monitor",
    keyword: "4K 모니터",
    title: "삼성 32인치 4K UHD 모니터 60Hz 반품-미개봉",
    brand: "Samsung",
    model_name: "U32",
    source_price: 289000,
    return_price: 279000,
    new_price: 389000,
    naver_lowest_price: 374000,
    condition_grade: "미개봉",
    stock_count: 1,
    public_note: "문서 작업과 콘솔 연결용으로 무난한 4K 모니터 후보입니다."
  }),
  product({
    source_product_id: "seed-dell-qhd-27",
    category: "monitor",
    keyword: "27인치 모니터",
    title: "Dell 27인치 QHD 모니터 75Hz IPS 반품-최상",
    brand: "Dell",
    model_name: "S2722D",
    source_price: 199000,
    return_price: 189000,
    new_price: 279000,
    naver_lowest_price: 259000,
    condition_grade: "최상",
    stock_count: 4,
    public_note: "사무용 27인치 QHD로 가격 차이가 좋은 후보입니다."
  }),
  product({
    source_product_id: "seed-alienware-240hz",
    category: "monitor",
    keyword: "144Hz 모니터",
    title: "Alienware 27인치 FHD 240Hz 모니터 반품-상",
    brand: "Dell",
    model_name: "AW272",
    source_price: 349000,
    return_price: 329000,
    new_price: 489000,
    naver_lowest_price: 469000,
    condition_grade: "상",
    stock_count: 2,
    public_note: "고주사율 모니터는 패널 상태 확인 후 판단해야 합니다."
  }),
  product({
    source_product_id: "seed-benq-qhd-165",
    category: "monitor",
    keyword: "QHD 모니터",
    title: "BenQ 32인치 QHD 모니터 165Hz VA 반품-확인필요",
    brand: "BenQ",
    model_name: "EX3210R",
    source_price: 319000,
    return_price: null,
    new_price: 469000,
    naver_lowest_price: 449000,
    condition_grade: "확인필요",
    stock_count: 2,
    public_note: "패널과 반품등급 확인 전에는 게시 보류가 맞습니다."
  }),
  product({
    source_product_id: "seed-roborock-qrevo",
    category: "robot_vacuum",
    keyword: "로보락",
    title: "로보락 Q Revo 로봇청소기 자동먼지비움 물걸레 도킹스테이션 반품-최상",
    brand: "Roborock",
    model_name: "Q Revo",
    source_price: 689000,
    return_price: 649000,
    new_price: 849000,
    naver_lowest_price: 835000,
    condition_grade: "최상",
    stock_count: 1,
    public_note: "도킹스테이션 포함 여부가 확인되면 매력적인 후보입니다."
  }),
  product({
    source_product_id: "seed-roborock-s8",
    category: "robot_vacuum",
    keyword: "로보락",
    title: "로보락 S8 Plus 자동먼지비움 물걸레 로봇청소기 반품-상",
    brand: "Roborock",
    model_name: "S8 Plus",
    source_price: 719000,
    return_price: 679000,
    new_price: 929000,
    naver_lowest_price: 899000,
    condition_grade: "상",
    stock_count: 2,
    public_note: "브러시와 물걸레 패드 상태 확인이 필요합니다."
  }),
  product({
    source_product_id: "seed-dreame-l10s",
    category: "robot_vacuum",
    keyword: "드리미 로봇청소기",
    title: "드리미 L10s Ultra 자동먼지비움 물걸레 도킹스테이션 반품-최상",
    brand: "Dreame",
    model_name: "L10s Ultra",
    source_price: 629000,
    return_price: 599000,
    new_price: 829000,
    naver_lowest_price: 799000,
    condition_grade: "최상",
    stock_count: 2,
    public_note: "구성품이 온전하면 가격 차이가 꽤 좋은 로봇청소기 후보입니다."
  }),
  product({
    source_product_id: "seed-xiaomi-x10",
    category: "robot_vacuum",
    keyword: "샤오미 로봇청소기",
    title: "샤오미 X10 로봇청소기 자동먼지비움 물걸레 반품-상",
    brand: "Xiaomi",
    model_name: "X10",
    source_price: 279000,
    return_price: 259000,
    new_price: 389000,
    naver_lowest_price: 369000,
    condition_grade: "상",
    stock_count: 3,
    public_note: "입문형 자동먼지비움 모델로 소모품 상태를 봐야 합니다."
  }),
  product({
    source_product_id: "seed-dyson-v12",
    category: "cordless_vacuum",
    keyword: "다이슨 무선청소기",
    title: "다이슨 V12 무선청소기 배터리 거치대 필터 포함 반품-상",
    brand: "Dyson",
    model_name: "V12",
    source_price: 519000,
    return_price: 489000,
    new_price: 699000,
    naver_lowest_price: 679000,
    condition_grade: "상",
    stock_count: 2,
    public_note: "배터리와 필터 구성품 확인이 된 경우에만 추천합니다."
  }),
  product({
    source_product_id: "seed-dyson-v15",
    category: "cordless_vacuum",
    keyword: "다이슨 무선청소기",
    title: "다이슨 V15 무선청소기 배터리 거치대 필터 반품-최상",
    brand: "Dyson",
    model_name: "V15",
    source_price: 689000,
    return_price: 649000,
    new_price: 899000,
    naver_lowest_price: 859000,
    condition_grade: "최상",
    stock_count: 1,
    public_note: "고가 모델이라 배터리 상태 확인이 특히 중요합니다."
  }),
  product({
    source_product_id: "seed-samsung-jet",
    category: "cordless_vacuum",
    keyword: "삼성 제트",
    title: "삼성 제트 무선청소기 배터리 거치대 필터 포함 반품-상",
    brand: "Samsung",
    model_name: "Jet",
    source_price: 319000,
    return_price: 299000,
    new_price: 429000,
    naver_lowest_price: 409000,
    condition_grade: "상",
    stock_count: 4,
    public_note: "필터와 배터리 포함 여부가 확인되면 부담이 낮은 후보입니다."
  }),
  product({
    source_product_id: "seed-lg-cordzero-a9",
    category: "cordless_vacuum",
    keyword: "LG 코드제로",
    title: "LG 코드제로 A9 무선청소기 배터리 거치대 필터 반품-최상",
    brand: "LG",
    model_name: "CordZero A9",
    source_price: 429000,
    return_price: 399000,
    new_price: 589000,
    naver_lowest_price: 559000,
    condition_grade: "최상",
    stock_count: 2,
    public_note: "거치대와 배터리 구성이 명확할 때 추천할 수 있습니다."
  }),
  product({
    source_product_id: "seed-winix-air-21",
    category: "air_purifier",
    keyword: "위닉스 공기청정기",
    title: "위닉스 공기청정기 21평형 HEPA 필터 반품-미개봉",
    brand: "Winix",
    model_name: "Tower Prime",
    source_price: 189000,
    return_price: 179000,
    new_price: 249000,
    naver_lowest_price: 239000,
    condition_grade: "미개봉",
    stock_count: 4,
    public_note: "필터 비용까지 감안해도 가격 차이가 의미 있는 생활가전 후보입니다."
  }),
  product({
    source_product_id: "seed-samsung-air-cube",
    category: "air_purifier",
    keyword: "삼성 공기청정기",
    title: "삼성 큐브 공기청정기 30평형 HEPA 필터 반품-최상",
    brand: "Samsung",
    model_name: "Cube",
    source_price: 329000,
    return_price: 309000,
    new_price: 459000,
    naver_lowest_price: 439000,
    condition_grade: "최상",
    stock_count: 2,
    public_note: "필터 잔량 확인 후 거실용으로 검토할 만합니다."
  }),
  product({
    source_product_id: "seed-lg-air-puricare",
    category: "air_purifier",
    keyword: "LG 공기청정기",
    title: "LG 퓨리케어 공기청정기 24평형 필터 반품-상",
    brand: "LG",
    model_name: "PuriCare",
    source_price: 289000,
    return_price: 269000,
    new_price: 399000,
    naver_lowest_price: 379000,
    condition_grade: "상",
    stock_count: 3,
    public_note: "센서 반응과 필터 상태 확인이 핵심입니다."
  }),
  product({
    source_product_id: "seed-winix-dehumidifier-17",
    category: "dehumidifier",
    keyword: "위닉스 제습기",
    title: "위닉스 제습기 17L 연속배수 반품-최상",
    brand: "Winix",
    model_name: "DN17",
    source_price: 269000,
    return_price: 249000,
    new_price: 349000,
    naver_lowest_price: 329000,
    condition_grade: "최상",
    stock_count: 3,
    public_note: "여름철 전에 가격 차이가 좋은 제습기 후보입니다."
  }),
  product({
    source_product_id: "seed-lg-dehumidifier-20",
    category: "dehumidifier",
    keyword: "LG 제습기",
    title: "LG 제습기 20L 연속배수 반품-최상",
    brand: "LG",
    model_name: "D20",
    source_price: 399000,
    return_price: 369000,
    new_price: 489000,
    naver_lowest_price: 469000,
    condition_grade: "최상",
    stock_count: 2,
    public_note: "여름철 수요가 오르기 전 가격 차이가 좋은 제습기 후보입니다."
  }),
  product({
    source_product_id: "seed-samsung-dehumidifier-18",
    category: "dehumidifier",
    keyword: "삼성 제습기",
    title: "삼성 제습기 18L 연속배수 반품-미개봉",
    brand: "Samsung",
    model_name: "AD18",
    source_price: 349000,
    return_price: 329000,
    new_price: 449000,
    naver_lowest_price: 429000,
    condition_grade: "미개봉",
    stock_count: 1,
    public_note: "미개봉이면 누수 리스크가 낮아 상대적으로 보기 좋습니다."
  })
];

type GeneratedSeed = {
  category: Category;
  keyword: string;
  brand: string;
  model: string;
  basePrice: number;
  specs: string[];
  note: string;
};

const generatedSeeds: GeneratedSeed[] = [
  { category: "laptop", keyword: "갤럭시북", brand: "Samsung", model: "갤럭시북4", basePrice: 1180000, specs: ["16GB 512GB Core Ultra 5 Win11", "16GB 1TB Core Ultra 7 Win11", "32GB 1TB Core Ultra 7 Win11"], note: "사무와 학습용으로 무난한 삼성 노트북 후보입니다." },
  { category: "laptop", keyword: "LG 그램", brand: "LG", model: "그램", basePrice: 1390000, specs: ["14 16GB 512GB Ultra 5 Win11 1.1kg", "16 16GB 1TB Ultra 7 Win11 1.2kg", "17 32GB 1TB Ultra 7 Win11 1.35kg"], note: "휴대성과 화면 크기를 함께 보는 사용자에게 맞습니다." },
  { category: "laptop", keyword: "레노버 아이디어패드", brand: "Lenovo", model: "아이디어패드 Slim", basePrice: 890000, specs: ["16GB 512GB Ryzen 5 Win11", "16GB 1TB Ryzen 7 Win11", "32GB 1TB Ryzen 7 FreeDOS"], note: "가격 대비 성능이 좋아 검토할 만한 노트북 후보입니다." },
  { category: "laptop", keyword: "레노버 리전", brand: "Lenovo", model: "리전 5", basePrice: 1490000, specs: ["i5 16GB 512GB RTX 4050 FreeDOS", "i7 16GB 1TB RTX 4060 FreeDOS", "i7 32GB 1TB RTX 4070 FreeDOS"], note: "게이밍 노트북은 발열과 사용 흔적 확인이 중요합니다." },
  { category: "laptop", keyword: "HP 빅터스", brand: "HP", model: "빅터스 16", basePrice: 1290000, specs: ["Ryzen 5 16GB 512GB RTX 4050 FreeDOS", "Ryzen 7 16GB 1TB RTX 4060 FreeDOS", "i7 32GB 1TB RTX 4060 Win11"], note: "성능 대비 가격이 맞으면 좋은 게이밍 입문 후보입니다." },
  { category: "laptop", keyword: "ASUS TUF", brand: "ASUS", model: "TUF Gaming", basePrice: 1390000, specs: ["Ryzen 5 16GB 512GB RTX 4050 FreeDOS", "Ryzen 7 16GB 1TB RTX 4060 FreeDOS", "i7 32GB 1TB RTX 4070 FreeDOS"], note: "OS 설치 비용과 외관 상태를 함께 봐야 합니다." },
  { category: "laptop", keyword: "맥북", brand: "Apple", model: "맥북에어", basePrice: 1390000, specs: ["M2 8GB 256GB", "M2 16GB 512GB", "M3 16GB 512GB"], note: "RAM 용량과 배터리 상태를 특히 확인해야 합니다." },
  { category: "laptop", keyword: "MSI 노트북", brand: "MSI", model: "스텔스", basePrice: 1490000, specs: ["i5 16GB 512GB RTX 4050 FreeDOS", "i7 16GB 1TB RTX 4060 FreeDOS", "i7 32GB 1TB RTX 4070 FreeDOS"], note: "게이밍·작업용 후보는 소음과 발열 상태를 봐야 합니다." },
  { category: "monitor", keyword: "QHD 모니터", brand: "LG", model: "울트라기어", basePrice: 399000, specs: ["27인치 QHD 144Hz IPS", "27인치 QHD 165Hz IPS", "32인치 QHD 165Hz VA"], note: "QHD 고주사율은 재택과 게임 겸용으로 보기 좋습니다." },
  { category: "monitor", keyword: "4K 모니터", brand: "Samsung", model: "ViewFinity", basePrice: 459000, specs: ["27인치 4K UHD 60Hz IPS", "32인치 4K UHD 60Hz VA", "32인치 4K UHD 144Hz IPS"], note: "4K 모니터는 패널 상태와 포트 구성을 확인해야 합니다." },
  { category: "monitor", keyword: "144Hz 모니터", brand: "Dell", model: "Alienware", basePrice: 529000, specs: ["27인치 FHD 240Hz IPS", "27인치 QHD 165Hz IPS", "32인치 QHD 165Hz VA"], note: "고주사율 제품은 불량화소와 빛샘 확인이 핵심입니다." },
  { category: "monitor", keyword: "27인치 모니터", brand: "BenQ", model: "Mobiuz", basePrice: 349000, specs: ["27인치 FHD 144Hz IPS", "27인치 QHD 75Hz IPS", "27인치 QHD 165Hz IPS"], note: "27인치 제품은 해상도와 스탠드 구성품을 함께 봐야 합니다." },
  { category: "robot_vacuum", keyword: "로보락", brand: "Roborock", model: "로보락", basePrice: 929000, specs: ["Q Revo 자동먼지비움 물걸레 도킹스테이션", "S8 Plus 자동먼지비움 물걸레 도킹스테이션", "S8 MaxV Ultra 자동먼지비움 물걸레 도킹스테이션"], note: "도킹스테이션과 물걸레 구성품 확인이 중요합니다." },
  { category: "robot_vacuum", keyword: "드리미 로봇청소기", brand: "Dreame", model: "드리미", basePrice: 849000, specs: ["L10s Ultra 자동먼지비움 물걸레 도킹스테이션", "L20 Ultra 자동먼지비움 물걸레 도킹스테이션", "X30 Ultra 자동먼지비움 물걸레 도킹스테이션"], note: "브러시와 소모품 상태까지 확인해야 하는 후보입니다." },
  { category: "robot_vacuum", keyword: "샤오미 로봇청소기", brand: "Xiaomi", model: "샤오미", basePrice: 489000, specs: ["X10 자동먼지비움 물걸레", "X20 Plus 자동먼지비움 물걸레 도킹스테이션", "S10 Plus 물걸레 도킹스테이션"], note: "입문형은 소모품 가격과 센서 상태를 함께 봐야 합니다." },
  { category: "cordless_vacuum", keyword: "다이슨 무선청소기", brand: "Dyson", model: "다이슨", basePrice: 899000, specs: ["V12 배터리 거치대 필터", "V15 배터리 거치대 필터", "Gen5 배터리 거치대 필터"], note: "배터리 상태와 필터 구성품이 가격 판단의 핵심입니다." },
  { category: "cordless_vacuum", keyword: "삼성 제트", brand: "Samsung", model: "삼성 제트", basePrice: 599000, specs: ["제트 200W 배터리 거치대 필터", "비스포크 제트 220W 배터리 거치대 필터", "제트 AI 250W 배터리 거치대 필터"], note: "거치대와 배터리 포함 여부가 확인되면 보기 좋습니다." },
  { category: "cordless_vacuum", keyword: "LG 코드제로", brand: "LG", model: "코드제로", basePrice: 649000, specs: ["A9 배터리 거치대 필터", "A9S 배터리 거치대 필터", "오브제컬렉션 배터리 거치대 필터"], note: "흡입부와 배터리 상태를 함께 확인해야 합니다." },
  { category: "air_purifier", keyword: "삼성 공기청정기", brand: "Samsung", model: "큐브", basePrice: 499000, specs: ["20평형 HEPA 필터", "30평형 HEPA 필터", "40평형 HEPA 필터"], note: "필터 잔량과 센서 반응을 같이 확인해야 합니다." },
  { category: "air_purifier", keyword: "LG 공기청정기", brand: "LG", model: "퓨리케어", basePrice: 549000, specs: ["19평형 필터", "24평형 필터", "36평형 필터"], note: "평형과 필터 비용을 함께 봐야 하는 생활가전 후보입니다." },
  { category: "air_purifier", keyword: "위닉스 공기청정기", brand: "Winix", model: "타워", basePrice: 329000, specs: ["18평형 HEPA 필터", "21평형 HEPA 필터", "30평형 HEPA 필터"], note: "필터 교체 비용까지 감안해도 가격 차이가 있으면 좋습니다." },
  { category: "dehumidifier", keyword: "위닉스 제습기", brand: "Winix", model: "위닉스 제습기", basePrice: 389000, specs: ["12L 연속배수", "17L 연속배수", "21L 연속배수"], note: "여름철 전 가격 차이가 나면 빠르게 볼 만한 후보입니다." },
  { category: "dehumidifier", keyword: "LG 제습기", brand: "LG", model: "LG 제습기", basePrice: 529000, specs: ["16L 연속배수", "20L 연속배수", "23L 연속배수"], note: "물통 누수와 컴프레서 소음 확인이 필요합니다." },
  { category: "dehumidifier", keyword: "삼성 제습기", brand: "Samsung", model: "삼성 제습기", basePrice: 489000, specs: ["14L 연속배수", "18L 연속배수", "22L 연속배수"], note: "미개봉이나 최상 등급이면 상대적으로 안정적인 편입니다." }
];

const grades: ConditionGrade[] = ["미개봉", "최상", "상", "확인필요"];
const generatedVariants = [0, 1, 2, 3] as const;

function roundPrice(value: number) {
  return Math.round(value / 1000) * 1000;
}

function generatedCatalog() {
  return generatedSeeds.flatMap((seed, seedIndex) =>
    seed.specs.flatMap((spec, specIndex) =>
      generatedVariants.map((variant) => {
        const grade = grades[(seedIndex + specIndex + variant) % grades.length];
        const newPrice = roundPrice(seed.basePrice + specIndex * seed.basePrice * 0.16 + variant * seed.basePrice * 0.045);
        const naverLowestPrice = roundPrice(newPrice * (0.92 - (specIndex % 2) * 0.015));
        const hasReturnPrice = grade !== "확인필요";
        const returnPrice = hasReturnPrice ? roundPrice(naverLowestPrice * (0.7 + variant * 0.03 + specIndex * 0.014)) : null;
        const sourcePrice = returnPrice ?? roundPrice(naverLowestPrice * (0.86 + variant * 0.018));
        const id = `seed-auto-${seed.category}-${seedIndex}-${specIndex}-${variant}`;
        return product({
          source_product_id: id,
          category: seed.category,
          keyword: seed.keyword,
          title: `${seed.brand} ${seed.model} ${spec} 반품-${grade}`,
          brand: seed.brand,
          model_name: seed.model,
          source_price: sourcePrice,
          return_price: returnPrice,
          new_price: newPrice,
          naver_lowest_price: naverLowestPrice,
          condition_grade: grade,
          stock_count: variant === 0 ? 1 : variant === 3 ? null : 2 + ((seedIndex + specIndex + variant) % 5),
          public_note:
            grade === "확인필요"
              ? `${seed.note} 반품가와 등급은 공개 근거가 확인되기 전까지 확인필요로 둡니다.`
              : `${seed.note} 반품가 기준으로 가격 차이가 계산된 데모 후보입니다.`
        });
      })
    )
  );
}

function uniqueBySourceId(products: DemoProduct[]) {
  const seen = new Set<string>();
  return products.filter((item) => {
    if (seen.has(item.source_product_id)) return false;
    seen.add(item.source_product_id);
    return true;
  });
}

export const demoCatalog: DemoProduct[] = uniqueBySourceId([...baseDemoCatalog, ...generatedCatalog()]);

export function getDemoCatalogByCategory(category: Category) {
  return demoCatalog.filter((product) => product.category === category);
}
