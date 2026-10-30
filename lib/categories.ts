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
