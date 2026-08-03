export const COMPARE_PRODUCTS_ERROR_CODE = "COMPARE_PRODUCTS_FAILED";
export const COMPARE_PRODUCTS_ERROR_MESSAGE = "비교 상품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";

export type CompareProductsErrorPayload = {
  ok: false;
  products: [];
  error: typeof COMPARE_PRODUCTS_ERROR_CODE;
  message: typeof COMPARE_PRODUCTS_ERROR_MESSAGE;
};

/** Keep backend diagnostics out of the public comparison response. */
export function getCompareProductsErrorPayload(_error: unknown): CompareProductsErrorPayload {
  return {
    ok: false,
    products: [],
    error: COMPARE_PRODUCTS_ERROR_CODE,
    message: COMPARE_PRODUCTS_ERROR_MESSAGE
  };
}
