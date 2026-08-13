import type { Category } from "@/lib/types";

export type SearchIntentIcon =
  | "laptop"
  | "monitor"
  | "robot"
  | "cordless"
  | "air"
  | "dehumidifier"
  | "study"
  | "gaming";

export type SearchIntentLanding = {
  slug: string;
  category: Category;
  label: string;
  icon: SearchIntentIcon;
  seoTitle: string;
  seoDescription: string;
  intro: string;
  searchQueries: string[];
  excludeQueries?: string[];
  /** Each group must match one alternative in the product identity fields. */
  requiredIdentityQueryGroups?: string[][];
  searchLabel: string;
  comparePoints: Array<{ title: string; detail: string }>;
  faqs: Array<{ question: string; answer: string }>;
};

export const searchIntentLandings: SearchIntentLanding[] = [
  {
    slug: "return-laptop",
    category: "laptop",
    label: "반품 노트북",
    icon: "laptop",
    seoTitle: "반품 노트북 추천, 가격보다 먼저 볼 체크포인트",
    seoDescription: "반품 노트북을 고를 때 RAM·SSD·운영체제·배터리와 반품 근거를 확인하는 방법을 정리하고 검수된 딜을 비교합니다.",
    intro: "반품 노트북은 같은 모델명이라도 메모리, 저장장치, 운영체제와 배터리 상태가 다를 수 있습니다. 리턴픽은 확인된 가격 근거와 상품명 스펙을 먼저 맞춰 보고, 모호한 반품 정보는 확인필요로 남깁니다.",
    searchQueries: ["노트북", "laptop", "그램", "갤럭시북", "아이디어패드", "맥북"],
    searchLabel: "노트북·그램·갤럭시북·맥북",
    comparePoints: [
      { title: "세부 사양", detail: "CPU, RAM, SSD, GPU와 화면 크기가 내가 찾는 구성과 같은지 확인합니다." },
      { title: "운영체제", detail: "Windows 포함 여부와 FreeDOS 설치 비용을 최종 가격에 함께 반영합니다." },
      { title: "배터리·구성품", detail: "배터리 상태와 충전기, 외관·힌지 흔적은 수령 직후 확인할 항목으로 남깁니다." }
    ],
    faqs: [
      { question: "반품 노트북은 새상품보다 얼마나 저렴해야 하나요?", answer: "할인율만으로 결정하지 않고 같은 모델의 확인된 기준가, 반품등급, 배터리와 구성품 위험을 함께 봅니다. 확인되지 않은 반품가는 계산에 임의로 넣지 않습니다." },
      { question: "반품등급이 없으면 비교할 수 있나요?", answer: "상품명 스펙과 가격 비교는 가능하지만 반품등급과 반품가는 확인필요로 표시하고 보수적인 판정만 제공합니다. 결제 전 쿠팡 상품 페이지를 다시 확인해야 합니다." }
    ]
  },
  {
    slug: "galaxy-book",
    category: "laptop",
    label: "갤럭시북",
    icon: "laptop",
    seoTitle: "갤럭시북 반품 상품, 구매 전 사양과 가격 확인",
    seoDescription: "갤럭시북 반품 상품의 CPU·RAM·SSD·화면 구성과 가격 근거, 확인필요 정보를 구분해 살펴봅니다.",
    intro: "갤럭시북은 세대와 화면 크기, 메모리·저장장치 구성이 비슷해 보여도 모델번호에 따라 사용감과 가격 기준이 달라집니다. 검색 결과에서 같은 구성인지 먼저 확인하세요.",
    searchQueries: ["갤럭시북", "Galaxy Book"],
    searchLabel: "갤럭시북·Galaxy Book",
    comparePoints: [
      { title: "모델번호", detail: "갤럭시북 세대와 화면 크기, CPU 계열이 동일한지 상품 상세에서 맞춥니다." },
      { title: "RAM·SSD", detail: "8GB·16GB와 256GB·512GB 차이는 체감과 가격을 바꾸므로 분리해 비교합니다." },
      { title: "충전기·배터리", detail: "정품 충전기 포함 여부와 반품 배터리 상태는 쿠팡의 현재 상품 설명에서 확인합니다." }
    ],
    faqs: [
      { question: "갤럭시북은 상품명만 보고 사도 되나요?", answer: "상품명만으로는 세대와 세부 구성 차이를 확정할 수 없습니다. 모델번호와 RAM·SSD, 운영체제를 함께 확인해야 합니다." },
      { question: "가격이 비어 있는 이유는 무엇인가요?", answer: "공식 가격 비교 API에서 동일 SKU를 확인하지 못했거나 아직 연결하지 않은 상태일 수 있습니다. 확인되지 않은 숫자는 표시하지 않습니다." }
    ]
  },
  {
    slug: "lg-gram",
    category: "laptop",
    label: "LG 그램",
    icon: "laptop",
    seoTitle: "LG 그램 반품 상품 추천과 구매 전 확인사항",
    seoDescription: "LG 그램 반품 상품의 화면 크기, RAM·SSD, 무게와 배터리·외관 위험을 확인하고 검수 딜을 비교합니다.",
    intro: "LG 그램은 가벼움과 배터리 사용성이 핵심이라 화면 크기와 무게, 배터리 상태를 함께 봐야 합니다. 이름이 비슷한 상품을 섞지 않고 확인된 모델만 비교합니다.",
    searchQueries: ["LG 그램", "lg gram", "그램"],
    searchLabel: "LG 그램·gram",
    comparePoints: [
      { title: "화면 크기·무게", detail: "13·14·15·16인치와 실제 휴대성을 좌우하는 무게가 목적에 맞는지 봅니다." },
      { title: "메모리와 저장장치", detail: "RAM과 SSD가 상품명·상세 사양에 명확히 적혀 있는지 확인합니다." },
      { title: "배터리와 힌지", detail: "반품 노트북의 배터리 지속시간, 화면 흔들림과 힌지 흔적을 수령 후 점검합니다." }
    ],
    faqs: [
      { question: "그램 반품은 무게만 확인하면 되나요?", answer: "무게 외에도 화면 크기, 메모리, 저장장치, 충전기와 배터리 상태가 실제 만족도를 좌우합니다. 모델번호를 기준으로 확인하세요." },
      { question: "반품 상품의 배터리 수명도 알 수 있나요?", answer: "공개 근거가 있는 경우에만 반영하고, 없으면 사용 배터리 위험으로 남깁니다. 구매 후 배터리 상태를 먼저 점검하세요." }
    ]
  },
  {
    slug: "vivobook-laptop",
    category: "laptop",
    label: "비보북 노트북",
    icon: "laptop",
    seoTitle: "비보북 노트북 구매 전 모델·CPU·구성 확인 가이드",
    seoDescription: "비보북 노트북의 모델번호, CPU, RAM·SSD, 운영체제와 배터리·국내 AS 정보를 확인하는 기준을 정리합니다.",
    intro: "비보북은 같은 제품군에서도 모델번호와 CPU, RAM·SSD, 운영체제가 달라질 수 있습니다. 리턴픽은 구매 가능한 것으로 확인된 상품만 노출하며, 확인되지 않은 사양·배터리·국내 AS 정보는 확인필요로 남깁니다.",
    searchQueries: ["비보북", "Vivobook", "ASUS"],
    requiredIdentityQueryGroups: [["비보북", "Vivobook"]],
    searchLabel: "비보북·Vivobook·ASUS 노트북",
    comparePoints: [
      { title: "모델과 CPU", detail: "정확한 모델번호와 CPU 세대·등급이 찾는 용도와 맞는지 확인합니다." },
      { title: "RAM·SSD·운영체제", detail: "메모리와 저장장치 용량, Windows 등 운영체제 포함 여부를 분리해 봅니다." },
      { title: "배터리·국내 AS", detail: "배터리 상태와 충전기, 국내 AS 또는 보증 범위가 공개됐는지 확인하고 없으면 확인필요로 둡니다." }
    ],
    faqs: [
      { question: "비보북은 이름만으로 세부 사양을 알 수 있나요?", answer: "알기 어렵습니다. 모델번호를 기준으로 CPU, RAM·SSD와 운영체제를 맞추고, 확인되지 않은 값은 확인필요로 남겨야 합니다." },
      { question: "배터리와 AS 정보가 없으면 어떻게 보나요?", answer: "구매 가능한 것으로 확인된 상품만 비교 대상이 되며, 배터리·충전기·국내 AS 근거가 없으면 결론을 단정하지 않습니다." }
    ]
  },
  {
    slug: "lg-gram-pro",
    category: "laptop",
    label: "LG 그램 프로",
    icon: "laptop",
    seoTitle: "LG 그램 프로 구매 전 크기·무게·구성 확인 가이드",
    seoDescription: "LG 그램 프로의 화면 크기와 무게, 디스플레이, RAM·SSD, 배터리 정보를 확인하는 기준을 정리합니다.",
    intro: "LG 그램 프로는 화면 크기와 무게뿐 아니라 디스플레이 구성, RAM·SSD와 배터리 조건을 함께 봐야 합니다. 리턴픽은 구매 가능한 것으로 확인된 상품만 노출하며, 확인되지 않은 값은 확인필요로 남깁니다.",
    searchQueries: ["LG 그램 프로", "그램 프로", "LG 그램", "LG Gram Pro"],
    requiredIdentityQueryGroups: [["LG 그램", "LG Gram"], ["프로", "Pro"]],
    searchLabel: "LG 그램 프로·그램 프로·LG 그램",
    comparePoints: [
      { title: "화면 크기·무게", detail: "화면 크기와 본체 무게가 휴대와 작업 공간에 맞는지 모델별로 확인합니다." },
      { title: "디스플레이", detail: "해상도와 패널, 밝기 등 디스플레이 세부 구성이 명확히 확인되는지 봅니다." },
      { title: "RAM·SSD·배터리", detail: "메모리와 저장장치 용량, 배터리 상태와 충전기 조건을 함께 확인하고 모호한 값은 확인필요로 둡니다." }
    ],
    faqs: [
      { question: "LG 그램 프로는 화면 크기만 비교하면 되나요?", answer: "아닙니다. 화면 크기와 무게, 디스플레이, RAM·SSD, 배터리와 충전기 조건을 같은 모델 기준으로 맞춰야 합니다." },
      { question: "배터리 정보가 확인되지 않으면 어떻게 판단하나요?", answer: "확인된 근거가 없는 배터리 상태를 추정하지 않습니다. 구매 가능한 것으로 확인된 상품이라도 해당 값은 확인필요로 남기고 조건을 다시 확인해야 합니다." }
    ]
  },
  {
    slug: "galaxy-book-pro",
    category: "laptop",
    label: "갤럭시북 프로",
    icon: "laptop",
    seoTitle: "갤럭시북 프로 구매 전 모델번호·구성 확인 가이드",
    seoDescription: "갤럭시북 프로의 모델번호, CPU, RAM·SSD, 운영체제와 충전기·배터리 조건을 확인하는 기준을 정리합니다.",
    intro: "갤럭시북 프로는 세대와 화면 구성에 따라 모델번호, CPU, RAM·SSD와 운영체제가 달라질 수 있습니다. 리턴픽은 구매 가능한 것으로 확인된 상품만 노출하며, 확인되지 않은 구성·충전기·배터리 정보는 확인필요로 남깁니다.",
    searchQueries: ["갤럭시북 프로", "갤럭시북 5 프로", "Galaxy Book Pro"],
    requiredIdentityQueryGroups: [["갤럭시북", "Galaxy Book"], ["프로", "Pro"]],
    searchLabel: "갤럭시북 프로·갤럭시북 5 프로·Galaxy Book Pro",
    comparePoints: [
      { title: "모델번호·CPU", detail: "모델번호와 세대, CPU 계열이 검색하려는 갤럭시북 프로 구성과 같은지 확인합니다." },
      { title: "RAM·SSD·운영체제", detail: "RAM·SSD 용량과 Windows 등 운영체제 포함 여부를 상품 정보에서 분리해 맞춥니다." },
      { title: "충전기·배터리", detail: "정품 충전기 포함 여부와 배터리 상태·보증 정보가 확인되는지 보고 모호하면 확인필요로 둡니다." }
    ],
    faqs: [
      { question: "갤럭시북 프로는 제품군 이름만으로 비교할 수 있나요?", answer: "제품군 이름만으로는 세대와 세부 구성을 확정하기 어렵습니다. 모델번호, CPU, RAM·SSD와 운영체제를 함께 확인해야 합니다." },
      { question: "충전기나 배터리 정보가 없으면 어떻게 하나요?", answer: "구성품과 배터리 상태를 추정하지 않고 확인필요로 남깁니다. 해당 근거를 확인할 수 있는 경우에만 구매 판단에 반영합니다." }
    ]
  },
  {
    slug: "student-laptop",
    category: "laptop",
    label: "대학생 노트북",
    icon: "study",
    seoTitle: "대학생 노트북 추천, 반품 상품 구매 기준 정리",
    seoDescription: "대학생·사무용 노트북을 고를 때 필요한 RAM·SSD·무게·운영체제와 반품 상품 확인 항목을 정리합니다.",
    intro: "대학생용 노트북은 과도한 성능보다 휴대성, 배터리, 문서 작업에 충분한 RAM·SSD와 운영체제가 중요합니다. 반품 할인보다 매일 쓸 구성과 추가 비용을 먼저 비교하세요.",
    searchQueries: ["노트북", "그램", "갤럭시북", "아이디어패드", "맥북"],
    excludeQueries: ["게이밍", "리전", "TUF", "빅터스", "RTX", "GTX", "MSI"],
    searchLabel: "휴대·문서·온라인 수업용",
    comparePoints: [
      { title: "문서 작업 여유", detail: "여러 브라우저 탭과 문서 앱을 함께 쓸 수 있는 RAM과 SSD 구성을 확인합니다." },
      { title: "휴대와 충전", detail: "무게, 충전기, 배터리 상태와 콘센트 없는 환경에서의 사용성을 봅니다." },
      { title: "처음 설정할 비용", detail: "FreeDOS라면 운영체제 설치와 라이선스 비용을 구매 예산에 포함합니다." }
    ],
    faqs: [
      { question: "대학생 노트북은 RAM 몇 GB가 적당한가요?", answer: "사용하는 프로그램에 따라 다르지만 브라우저·문서 작업에서는 RAM과 SSD 구성이 핵심입니다. 리턴픽은 제목에서 읽힌 사양만 표시하고 불명확한 값은 확인필요로 둡니다." },
      { question: "반품 노트북을 처음 사도 되나요?", answer: "반품등급, 배터리, 화면·키보드·포트와 구성품을 확인할 수 있는 판매 조건인지 먼저 확인한 뒤 결정하는 것이 좋습니다." }
    ]
  },
  {
    slug: "gaming-laptop",
    category: "laptop",
    label: "게이밍 노트북",
    icon: "gaming",
    seoTitle: "게이밍 노트북 반품 상품, GPU와 발열 체크",
    seoDescription: "게이밍 노트북 반품 상품의 RTX GPU, RAM·SSD, 발열·소음과 반품 위험을 확인하고 가격을 비교합니다.",
    intro: "게이밍 노트북은 GPU와 냉각 상태, 어댑터 구성에 따라 체감 성능과 수리 부담이 크게 달라집니다. 큰 할인율만 보지 않고 사용 흔적과 보증 조건을 함께 살펴보세요.",
    searchQueries: ["게이밍 노트북", "리전", "TUF", "빅터스", "RTX"],
    searchLabel: "리전·TUF·빅터스·RTX",
    comparePoints: [
      { title: "GPU와 화면", detail: "RTX 모델과 화면 해상도·주사율이 원하는 게임과 맞는지 확인합니다." },
      { title: "발열·소음", detail: "고부하 사용 흔적, 팬 소음과 과열 위험은 할인율만으로 상쇄되지 않을 수 있습니다." },
      { title: "어댑터·보증", detail: "고출력 정품 어댑터와 AS·보증 범위를 상품 페이지에서 확인합니다." }
    ],
    faqs: [
      { question: "게이밍 노트북 반품은 왜 더 조심해야 하나요?", answer: "고성능 부품과 냉각 장치가 포함되어 발열·팬·배터리·어댑터 상태의 영향을 크게 받습니다. 수령 후 고부하 점검이 필요합니다." },
      { question: "RTX 숫자가 같으면 같은 상품인가요?", answer: "아닙니다. GPU 외에도 전력 설정, CPU, 화면, RAM·SSD와 모델 세대가 달라질 수 있어 정확한 모델번호를 확인해야 합니다." }
    ]
  },
  {
    slug: "qhd-monitor",
    category: "monitor",
    label: "QHD 모니터",
    icon: "monitor",
    seoTitle: "QHD 모니터 반품 딜, 패널과 주사율 확인",
    seoDescription: "QHD 모니터 반품 상품의 화면 크기, 패널 상태, 주사율과 케이블·스탠드 구성, 가격을 비교합니다.",
    intro: "QHD 모니터는 해상도만 같아도 패널, 주사율, 입력단자와 스탠드가 다를 수 있습니다. 반품 구매 전 실제 모델과 불량 화소·빛샘 확인 조건을 함께 봅니다.",
    searchQueries: ["QHD", "2560 1440", "qhd 모니터"],
    searchLabel: "QHD·2560×1440·모니터",
    comparePoints: [
      { title: "패널 상태", detail: "불량 화소, 빛샘, 멍과 외관 손상에 대한 확인 조건이 있는지 봅니다." },
      { title: "주사율·입력", detail: "정격 주사율을 지원하는 HDMI·DP 포트와 케이블 구성을 확인합니다." },
      { title: "스탠드·구성품", detail: "정품 스탠드와 전원 어댑터 누락 여부를 가격 차이에 반영합니다." }
    ],
    faqs: [
      { question: "QHD면 27인치 모니터가 모두 같은가요?", answer: "화면 크기, 패널 방식, 주사율, 밝기와 입력단자가 다릅니다. 정확한 모델명과 상세 사양을 맞춰야 합니다." },
      { question: "반품 모니터는 무엇을 먼저 테스트하나요?", answer: "수령 직후 단색 화면으로 불량 화소와 빛샘을 확인하고, 정격 해상도·주사율과 모든 입력단자를 테스트하세요." }
    ]
  },
  {
    slug: "4k-monitor",
    category: "monitor",
    label: "4K 모니터",
    icon: "monitor",
    seoTitle: "4K 모니터 반품 상품 추천과 패널 체크리스트",
    seoDescription: "4K 모니터 반품 상품의 UHD 해상도, 패널·HDR·입력 구성과 불량 위험을 확인해 가격을 비교합니다.",
    intro: "4K 모니터는 높은 해상도만으로는 충분하지 않습니다. PC·콘솔 연결에 필요한 포트, 주사율과 패널 상태를 정확한 모델 기준으로 비교하세요.",
    searchQueries: ["4K", "UHD", "4k 모니터"],
    searchLabel: "4K·UHD·고해상도 모니터",
    comparePoints: [
      { title: "해상도와 주사율", detail: "4K 입력과 원하는 주사율을 실제 포트가 지원하는지 확인합니다." },
      { title: "패널·HDR", detail: "HDR 지원 표기와 밝기, 불량 화소·빛샘 확인 조건을 분리해 봅니다." },
      { title: "케이블과 스탠드", detail: "고대역폭 케이블과 정품 스탠드가 포함되는지 구매 전 확인합니다." }
    ],
    faqs: [
      { question: "4K 모니터 반품 구매에서 가장 큰 위험은 무엇인가요?", answer: "패널 불량과 구성품 누락, 원하는 주사율을 지원하지 않는 포트가 대표적입니다. 수령 당일 연결 테스트를 권합니다." },
      { question: "4K 가격 비교는 어떻게 하나요?", answer: "같은 모델번호와 화면 크기, 주사율을 기준으로 비교합니다. 다른 모델의 최저가를 같은 상품의 기준가로 사용하지 않습니다." }
    ]
  },
  {
    slug: "odyssey-monitor",
    category: "monitor",
    label: "삼성 오디세이 모니터",
    icon: "monitor",
    seoTitle: "삼성 오디세이 모니터 구매 전 패널·주사율 확인 가이드",
    seoDescription: "삼성 오디세이 모니터의 패널, 주사율, 포트와 스탠드, 불량 화소 확인 기준을 정리합니다.",
    intro: "삼성 오디세이 모니터는 패널과 주사율만으로 판단하지 않고 포트, 스탠드와 불량 화소 확인 조건을 함께 살펴야 합니다. 리턴픽은 구매 가능한 것으로 확인된 상품만 노출하며, 확인되지 않은 값은 확인필요로 남깁니다.",
    searchQueries: ["삼성 오디세이", "오디세이", "Odyssey"],
    requiredIdentityQueryGroups: [["삼성", "Samsung"], ["오디세이", "Odyssey"]],
    searchLabel: "삼성 오디세이·오디세이·Odyssey 모니터",
    comparePoints: [
      { title: "패널 상태", detail: "패널 방식과 화면 손상, 빛샘·멍 등 상태 확인 조건이 명확한지 봅니다." },
      { title: "주사율·포트", detail: "필요한 주사율을 HDMI·DisplayPort 등 실제 입력 포트와 케이블이 지원하는지 확인합니다." },
      { title: "스탠드·불량 화소", detail: "정품 스탠드 포함 여부와 불량 화소 확인·교환 조건이 공개됐는지 살펴봅니다." }
    ],
    faqs: [
      { question: "삼성 오디세이 모니터는 주사율만 보면 되나요?", answer: "아닙니다. 패널 상태와 입력 포트, 스탠드 구성, 불량 화소 확인 조건을 같은 모델 기준으로 함께 봐야 합니다." },
      { question: "불량 화소 확인 조건이 없으면 어떻게 판단하나요?", answer: "확인되지 않은 패널 상태를 정상으로 가정하지 않습니다. 구매 가능한 것으로 확인된 상품이어도 해당 조건은 확인필요로 남기고 수령 후 점검 기준을 확인해야 합니다." }
    ]
  },
  {
    slug: "robot-vacuum",
    category: "robot_vacuum",
    label: "로봇청소기",
    icon: "robot",
    seoTitle: "로봇청소기 반품 딜, 도킹과 물걸레 구성 확인",
    seoDescription: "로봇청소기 반품 상품의 도킹스테이션, 자동먼지비움, 물걸레, 센서와 소모품 비용을 비교합니다.",
    intro: "로봇청소기는 본체만 저렴해도 도킹스테이션과 물걸레·소모품이 빠지면 실제 비용이 커집니다. 모델 세대와 구성품이 일치하는지 먼저 확인합니다.",
    searchQueries: ["로봇청소기", "로보락", "드리미", "샤오미"],
    searchLabel: "로보락·드리미·샤오미",
    comparePoints: [
      { title: "도킹 기능", detail: "자동 먼지비움, 물걸레 세척·건조와 물통·전원선이 포함되는지 봅니다." },
      { title: "센서·배터리", detail: "라이다·카메라 센서와 배터리 상태를 반품 위험과 함께 확인합니다." },
      { title: "소모품·앱", detail: "필터·브러시·먼지봉투 비용과 국내 앱·AS 지원 여부를 비교합니다." }
    ],
    faqs: [
      { question: "로봇청소기는 도킹스테이션이 꼭 필요한가요?", answer: "모델에 따라 자동 비움·물걸레 관리 기능이 달라집니다. 본체와 도크가 같은 구성인지 상품 상세에서 확인하세요." },
      { question: "반품 로봇청소기는 어떤 테스트가 필요한가요?", answer: "지도 생성, 장애물 회피, 도킹 복귀, 흡입·물걸레, 누수와 배터리 충전을 순서대로 점검하는 것이 좋습니다." }
    ]
  },
  {
    slug: "premium-robot-vacuum",
    category: "robot_vacuum",
    label: "프리미엄 로봇청소기",
    icon: "robot",
    seoTitle: "프리미엄 로봇청소기 구매 전 도크·물걸레·AS 확인 가이드",
    seoDescription: "프리미엄 로봇청소기의 도크, 물걸레, 센서, 배터리, 소모품과 국내 AS를 확인하는 기준을 정리합니다.",
    intro: "프리미엄 로봇청소기는 본체 기능뿐 아니라 도크와 물걸레 구성, 센서·배터리 상태, 소모품과 국내 AS 조건을 함께 확인해야 합니다. 리턴픽은 구매 가능한 것으로 확인된 상품만 노출하며, 확인되지 않은 값은 확인필요로 남깁니다.",
    searchQueries: ["로보락", "드리미", "로봇청소기", "Roborock", "Dreame"],
    requiredIdentityQueryGroups: [
      ["로보락", "Roborock", "드리미", "Dreame"],
      ["Q Revo", "S8", "L10s", "L20", "X30", "Ultra", "MaxV", "울트라"]
    ],
    searchLabel: "로보락·드리미·로봇청소기",
    comparePoints: [
      { title: "도크·물걸레", detail: "자동 먼지비움과 물걸레 세척·건조, 물통과 도크 구성품이 모델에 맞게 포함되는지 봅니다." },
      { title: "센서·배터리", detail: "라이다·카메라 등 센서 구성과 배터리 상태, 충전·도킹 동작을 확인합니다." },
      { title: "소모품·국내 AS", detail: "필터·브러시·먼지봉투 등 소모품과 국내 AS·보증 조건이 확인되는지 살펴보고 없으면 확인필요로 둡니다." }
    ],
    faqs: [
      { question: "로봇청소기는 본체 기능만 비교하면 되나요?", answer: "아닙니다. 도크와 물걸레 구성, 센서·배터리, 소모품과 국내 AS 조건을 함께 확인해야 실제 사용 조건을 판단할 수 있습니다." },
      { question: "국내 AS나 소모품 정보가 확인되지 않으면 어떻게 하나요?", answer: "지원 범위와 비용을 추정하지 않습니다. 구매 가능한 것으로 확인된 상품이라도 관련 값은 확인필요로 남기고 확인된 근거가 있을 때만 비교에 반영합니다." }
    ]
  },
  {
    slug: "cordless-vacuum",
    category: "cordless_vacuum",
    label: "무선청소기",
    icon: "cordless",
    seoTitle: "무선청소기 반품 상품, 배터리와 구성품 비교",
    seoDescription: "무선청소기 반품 상품의 배터리, 헤드·거치대, 필터와 소모품 비용을 확인하고 검수 딜을 비교합니다.",
    intro: "무선청소기는 본체보다 배터리와 헤드·거치대, 필터 상태가 사용 만족도를 좌우합니다. 누락된 구성품을 새로 사야 한다면 할인폭이 줄어들 수 있습니다.",
    searchQueries: ["무선청소기", "다이슨", "삼성 제트", "코드제로"],
    searchLabel: "다이슨·삼성 제트·코드제로",
    comparePoints: [
      { title: "배터리", detail: "배터리 개수와 교체 가능 여부, 충전기 포함 여부를 확인합니다." },
      { title: "헤드·거치대", detail: "메인 브러시, 침구·틈새 도구와 거치대가 모두 포함되는지 봅니다." },
      { title: "필터 비용", detail: "필터와 롤러 상태가 불명확하면 교체 비용을 할인액에서 제외해 판단합니다." }
    ],
    faqs: [
      { question: "무선청소기 반품의 배터리는 어떻게 확인하나요?", answer: "완충 후 일반 모드 사용 시간과 급격한 잔량 저하, 충전 중 이상 발열을 확인하세요. 공개된 배터리 정보가 없으면 확인필요로 둡니다." },
      { question: "구성품 하나가 빠져도 할인 상품인가요?", answer: "누락된 헤드·거치대·충전기는 별도 비용과 사용 불편을 만들 수 있습니다. 리턴픽은 확인 가능한 구성품 근거를 우선합니다." }
    ]
  },
  {
    slug: "air-purifier",
    category: "air_purifier",
    label: "공기청정기",
    icon: "air",
    seoTitle: "공기청정기 반품 딜, 필터와 사용 면적 확인",
    seoDescription: "공기청정기 반품 상품의 사용 면적, 필터 모델·비용, 센서와 소음 위험을 확인하고 가격을 비교합니다.",
    intro: "공기청정기는 본체 가격이 낮아도 필터를 바로 교체해야 하면 실구매 비용이 달라집니다. 사용 면적과 필터 모델, 냄새·소음 상태를 함께 살펴보세요.",
    searchQueries: ["공기청정기", "삼성 공기청정기", "LG 공기청정기", "위닉스"],
    searchLabel: "삼성·LG·위닉스·필터",
    comparePoints: [
      { title: "사용 면적", detail: "권장 사용 면적과 공간 크기가 맞는지, 모델 연식이 최신인지 확인합니다." },
      { title: "필터 교체비", detail: "필터 포함 여부와 정품 필터 모델·가격을 반품 할인과 함께 계산합니다." },
      { title: "센서·냄새·소음", detail: "자동 모드 반응과 팬 소음, 냄새는 수령 후 확인해야 할 위험으로 표시합니다." }
    ],
    faqs: [
      { question: "공기청정기 반품에서 필터를 꼭 확인해야 하나요?", answer: "필터가 이미 사용됐거나 모델이 다르면 추가 비용이 생깁니다. 필터 모델과 교체 주기를 상품 설명에서 확인하세요." },
      { question: "공기청정기 가격만으로 좋은 딜을 고를 수 있나요?", answer: "사용 면적, 필터 비용, 센서·소음과 냄새 위험을 함께 봐야 합니다. 가격이 비어 있으면 확인된 기준가 없이 임의 계산하지 않습니다." }
    ]
  },
  {
    slug: "dehumidifier",
    category: "dehumidifier",
    label: "제습기",
    icon: "dehumidifier",
    seoTitle: "제습기 반품 상품, 용량과 누수·소음 점검",
    seoDescription: "제습기 반품 상품의 일일 제습량, 물통·연속배수, 누수와 압축기 소음을 확인하고 가격을 비교합니다.",
    intro: "제습기는 물통 용량과 일일 제습량을 구분해야 하고, 반품 상품은 누수·소음·배수 구성품을 꼭 확인해야 합니다. 공간에 맞는 용량과 수령 후 테스트를 함께 안내합니다.",
    searchQueries: ["제습기", "위닉스 제습기", "LG 제습기", "삼성 제습기"],
    searchLabel: "위닉스·LG·삼성·대용량",
    comparePoints: [
      { title: "일일 제습량", detail: "리터 표기가 물통 용량인지 일일 제습량인지 구분하고 공간에 맞춥니다." },
      { title: "물통·배수", detail: "물통 파손, 호스와 마개, 연속배수 구성품 포함 여부를 확인합니다." },
      { title: "압축기·누수", detail: "압축기 소음과 진동, 물이 실제로 모이는지와 연결부 누수를 점검합니다." }
    ],
    faqs: [
      { question: "제습기의 L 표기는 무엇을 뜻하나요?", answer: "상품마다 물통 용량과 일일 제습량 표기가 다를 수 있습니다. 어떤 기준인지 상품 상세에서 확인해야 합니다." },
      { question: "반품 제습기는 언제 테스트하나요?", answer: "수령 직후 제습 작동, 습도 센서, 물통 감지, 연속배수와 누수, 압축기 소음을 확인하는 것이 좋습니다." }
    ]
  }
];

export function getSearchIntentLanding(slug: string) {
  return searchIntentLandings.find((landing) => landing.slug === slug) ?? null;
}
