import type { Category, SourcedProduct } from "@/lib/types";

type IdentityProduct = Pick<SourcedProduct, "id" | "source_product_id" | "category" | "title">;

export type ManualImportConflict = {
  code: "EXISTING_COUPANG_PRODUCT_ID" | "EXISTING_TITLE_CATEGORY";
  product_id: string;
};

export function getManualImportTitleKey(category: Category, title: string) {
  return `${category}:${title.trim().toLowerCase()}`;
}

export function findManualImportConflict(
  products: IdentityProduct[],
  input: { sourceProductId: string; category: Category; title: string }
): ManualImportConflict | null {
  const sameCoupangProduct = products.find((product) => product.source_product_id === input.sourceProductId);
  if (sameCoupangProduct) {
    return { code: "EXISTING_COUPANG_PRODUCT_ID", product_id: sameCoupangProduct.id };
  }

  const titleKey = getManualImportTitleKey(input.category, input.title);
  const sameTitleCategory = products.find(
    (product) => getManualImportTitleKey(product.category, product.title) === titleKey
  );
  if (sameTitleCategory) {
    return { code: "EXISTING_TITLE_CATEGORY", product_id: sameTitleCategory.id };
  }

  return null;
}
