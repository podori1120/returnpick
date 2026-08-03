import * as ts from "typescript";

const RECOMMENDATION_ENTRY = {
  path: "/recommend",
  changeFrequency: "daily",
  priority: 0.86
};

function getPropertyValue(objectLiteral, propertyName) {
  const property = objectLiteral.properties.find(
    (candidate) =>
      ts.isPropertyAssignment(candidate) &&
      ((ts.isIdentifier(candidate.name) && candidate.name.text === propertyName) ||
        (ts.isStringLiteral(candidate.name) && candidate.name.text === propertyName))
  );

  if (!property || !ts.isPropertyAssignment(property)) return undefined;
  const value = property.initializer;
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
  if (ts.isNumericLiteral(value)) return Number(value.text);
  return undefined;
}

export function getStaticSitemapEntries(source) {
  const sourceFile = ts.createSourceFile("app/sitemap.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let entriesArray;

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "entries" &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      entriesArray = node.initializer;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  if (!entriesArray) return [];

  return entriesArray.elements.flatMap((element) => {
    if (!ts.isObjectLiteralExpression(element)) return [];
    return [
      {
        path: getPropertyValue(element, "path"),
        changeFrequency: getPropertyValue(element, "changeFrequency"),
        priority: getPropertyValue(element, "priority")
      }
    ];
  });
}

export function getRecommendationSitemapEntries(source) {
  return getStaticSitemapEntries(source).filter((entry) => entry.path === RECOMMENDATION_ENTRY.path);
}

export function hasExactRecommendationSitemapEntry(source) {
  const entries = getRecommendationSitemapEntries(source);
  return (
    entries.length === 1 &&
    entries[0].changeFrequency === RECOMMENDATION_ENTRY.changeFrequency &&
    entries[0].priority === RECOMMENDATION_ENTRY.priority
  );
}

export function commentOutRecommendationSitemapEntry(source) {
  const entryText = `{ path: "${RECOMMENDATION_ENTRY.path}", changeFrequency: "${RECOMMENDATION_ENTRY.changeFrequency}", priority: ${RECOMMENDATION_ENTRY.priority} },`;
  return source.replace(entryText, `// ${entryText}`);
}

export function removeRecommendationSitemapEntry(source) {
  const entryText = `{ path: "${RECOMMENDATION_ENTRY.path}", changeFrequency: "${RECOMMENDATION_ENTRY.changeFrequency}", priority: ${RECOMMENDATION_ENTRY.priority} },`;
  return source.replace(entryText, "");
}
