export type CategoryKind = "expense" | "income";

export type Category = {
  id: number;
  member_unique_id: string;
  kind: CategoryKind;
  name: string;
  parent_id: number | null;
  sort_order: number;
  is_default: boolean;
  created_at: string;
};

export const MAX_CATEGORIES_PER_KIND = 99;

/** 대분류 + 소분류 기본 구조 (지출) */
export const DEFAULT_EXPENSE_TREE: ReadonlyArray<{
  major: string;
  minors: readonly string[];
}> = [
  { major: "식대", minors: ["식대(아점)", "식대(저녁)"] },
  {
    major: "교통비",
    minors: ["교통비(시내대중)", "교통비(시외대중)", "교통비(기타)"],
  },
  { major: "간식", minors: [] },
  { major: "용돈지급", minors: [] },
  { major: "부식", minors: [] },
  { major: "의류/신발", minors: [] },
  { major: "배움", minors: ["배움(온라인)", "배움(학원비)", "배움(기타)"] },
  { major: "통신비", minors: ["통신비(휴대폰)", "통신비(기타)"] },
  { major: "생활", minors: ["생활(기타)"] },
] as const;

/** 수입은 대분류로 관리 (소분류는 이후 추가 가능) */
export const DEFAULT_INCOME_TREE: ReadonlyArray<{
  major: string;
  minors: readonly string[];
}> = [
  { major: "월급", minors: [] },
  { major: "사업소득", minors: [] },
  { major: "아르바이트 소득", minors: [] },
  { major: "용돈수입", minors: [] },
  { major: "임시소득", minors: [] },
  { major: "지원금", minors: [] },
  { major: "기타", minors: [] },
] as const;

export type CategoryStat = {
  categoryId: number | null;
  name: string;
  amount: number;
  count: number;
};

export type CategoryGroup = {
  major: Category;
  minors: Category[];
};

export function isMajor(category: Category): boolean {
  return category.parent_id == null;
}

export function isMinor(category: Category): boolean {
  return category.parent_id != null;
}

export function groupCategories(categories: Category[]): CategoryGroup[] {
  const majors = categories
    .filter(isMajor)
    .sort((a, b) => a.sort_order - b.sort_order);

  return majors.map((major) => ({
    major,
    minors: categories
      .filter((item) => item.parent_id === major.id)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));
}
