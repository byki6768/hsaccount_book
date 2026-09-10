import { supabase } from "@/lib/supabase/client";
import {
  Category,
  CategoryKind,
  DEFAULT_EXPENSE_TREE,
  DEFAULT_INCOME_TREE,
  MAX_CATEGORIES_PER_KIND,
  groupCategories,
  isMajor,
  isMinor,
} from "@/lib/categories";

export async function ensureDefaultCategories(
  memberUniqueId: string,
): Promise<{ expense: Category[]; income: Category[] }> {
  const { data: existing, error } = await supabase
    .from("categories")
    .select("*")
    .eq("member_unique_id", memberUniqueId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  let rows = (existing ?? []) as Category[];
  const hasExpenseMajor = rows.some((c) => c.kind === "expense" && isMajor(c));
  const hasIncomeMajor = rows.some((c) => c.kind === "income" && isMajor(c));

  if (!hasExpenseMajor) {
    await seedTree(memberUniqueId, "expense", DEFAULT_EXPENSE_TREE);
  }
  if (!hasIncomeMajor) {
    await seedTree(memberUniqueId, "income", DEFAULT_INCOME_TREE);
  }

  if (!hasExpenseMajor || !hasIncomeMajor) {
    const { data: refreshed, error: refreshError } = await supabase
      .from("categories")
      .select("*")
      .eq("member_unique_id", memberUniqueId)
      .order("sort_order", { ascending: true });

    if (refreshError) throw new Error(refreshError.message);
    rows = (refreshed ?? []) as Category[];
  }

  return {
    expense: rows.filter((c) => c.kind === "expense"),
    income: rows.filter((c) => c.kind === "income"),
  };
}

async function seedTree(
  memberUniqueId: string,
  kind: CategoryKind,
  tree: ReadonlyArray<{ major: string; minors: readonly string[] }>,
) {
  for (let majorIndex = 0; majorIndex < tree.length; majorIndex += 1) {
    const node = tree[majorIndex];
    const { data: major, error: majorError } = await supabase
      .from("categories")
      .insert({
        member_unique_id: memberUniqueId,
        kind,
        name: node.major,
        parent_id: null,
        sort_order: majorIndex + 1,
        is_default: true,
      })
      .select("*")
      .single();

    if (majorError) throw new Error(majorError.message);

    if (node.minors.length === 0) continue;

    const minors = node.minors.map((name, minorIndex) => ({
      member_unique_id: memberUniqueId,
      kind,
      name,
      parent_id: (major as Category).id,
      sort_order: minorIndex + 1,
      is_default: true,
    }));

    const { error: minorError } = await supabase.from("categories").insert(minors);
    if (minorError) throw new Error(minorError.message);
  }
}

export async function createMajorCategory(
  memberUniqueId: string,
  kind: CategoryKind,
  name: string,
): Promise<Category> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("대분류 이름을 입력하세요");

  const { count, error: countError } = await supabase
    .from("categories")
    .select("*", { count: "exact", head: true })
    .eq("member_unique_id", memberUniqueId)
    .eq("kind", kind)
    .is("parent_id", null);

  if (countError) throw new Error(countError.message);
  if ((count ?? 0) >= MAX_CATEGORIES_PER_KIND) {
    throw new Error(`대분류는 최대 ${MAX_CATEGORIES_PER_KIND}개까지 등록할 수 있습니다`);
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      member_unique_id: memberUniqueId,
      kind,
      name: trimmed,
      parent_id: null,
      sort_order: (count ?? 0) + 1,
      is_default: false,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("이미 같은 이름의 대분류가 있습니다");
    throw new Error(error.message);
  }

  return data as Category;
}

export async function createMinorCategory(
  memberUniqueId: string,
  kind: CategoryKind,
  majorId: number,
  name: string,
): Promise<Category> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("소분류 이름을 입력하세요");

  const { data: major, error: majorError } = await supabase
    .from("categories")
    .select("*")
    .eq("id", majorId)
    .eq("member_unique_id", memberUniqueId)
    .eq("kind", kind)
    .is("parent_id", null)
    .maybeSingle();

  if (majorError) throw new Error(majorError.message);
  if (!major) throw new Error("대분류를 선택하세요");

  const { count, error: countError } = await supabase
    .from("categories")
    .select("*", { count: "exact", head: true })
    .eq("member_unique_id", memberUniqueId)
    .eq("kind", kind)
    .eq("parent_id", majorId);

  if (countError) throw new Error(countError.message);
  if ((count ?? 0) >= MAX_CATEGORIES_PER_KIND) {
    throw new Error(`소분류는 대분류당 최대 ${MAX_CATEGORIES_PER_KIND}개까지 등록할 수 있습니다`);
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      member_unique_id: memberUniqueId,
      kind,
      name: trimmed,
      parent_id: majorId,
      sort_order: (count ?? 0) + 1,
      is_default: false,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("이미 같은 이름의 항목이 있습니다");
    throw new Error(error.message);
  }

  return data as Category;
}

export function buildMajorStats(
  rows: Array<{ amount: number; category_id: number | null }>,
  categories: Category[],
) {
  const groups = groupCategories(categories);
  const minorToMajor = new Map<number, number>();
  for (const group of groups) {
    for (const minor of group.minors) {
      minorToMajor.set(minor.id, group.major.id);
    }
  }

  const map = new Map<number, { categoryId: number; name: string; amount: number; count: number }>();
  for (const group of groups) {
    map.set(group.major.id, {
      categoryId: group.major.id,
      name: group.major.name,
      amount: 0,
      count: 0,
    });
  }

  let uncategorizedAmount = 0;
  let uncategorizedCount = 0;

  for (const row of rows) {
    if (row.category_id == null) {
      uncategorizedAmount += row.amount;
      uncategorizedCount += 1;
      continue;
    }

    const category = categories.find((c) => c.id === row.category_id);
    if (!category) {
      uncategorizedAmount += row.amount;
      uncategorizedCount += 1;
      continue;
    }

    const majorId = isMinor(category)
      ? category.parent_id!
      : isMajor(category)
        ? category.id
        : null;

    if (majorId == null || !map.has(majorId)) {
      uncategorizedAmount += row.amount;
      uncategorizedCount += 1;
      continue;
    }

    const current = map.get(majorId)!;
    current.amount += row.amount;
    current.count += 1;
  }

  const stats = Array.from(map.values()).filter((item) => item.amount > 0 || item.count > 0);

  if (uncategorizedCount > 0) {
    stats.push({
      categoryId: null as unknown as number,
      name: "미분류",
      amount: uncategorizedAmount,
      count: uncategorizedCount,
    });
  }

  if (stats.length === 0) {
    return groups.map((group) => ({
      categoryId: group.major.id,
      name: group.major.name,
      amount: 0,
      count: 0,
    }));
  }

  return stats
    .map((item) => ({
      categoryId: item.name === "미분류" ? null : item.categoryId,
      name: item.name,
      amount: item.amount,
      count: item.count,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function buildMinorStats(
  rows: Array<{ amount: number; category_id: number | null }>,
  categories: Category[],
) {
  const minors = categories.filter(isMinor);
  const map = new Map<number, { categoryId: number; name: string; amount: number; count: number }>();

  for (const minor of minors) {
    map.set(minor.id, {
      categoryId: minor.id,
      name: minor.name,
      amount: 0,
      count: 0,
    });
  }

  let uncategorizedAmount = 0;
  let uncategorizedCount = 0;

  for (const row of rows) {
    if (row.category_id != null && map.has(row.category_id)) {
      const current = map.get(row.category_id)!;
      current.amount += row.amount;
      current.count += 1;
    } else if (row.category_id != null) {
      // 대분류만 연결된 경우 등
      const major = categories.find((c) => c.id === row.category_id && isMajor(c));
      if (major) {
        uncategorizedAmount += row.amount;
        uncategorizedCount += 1;
      } else {
        uncategorizedAmount += row.amount;
        uncategorizedCount += 1;
      }
    } else {
      uncategorizedAmount += row.amount;
      uncategorizedCount += 1;
    }
  }

  const stats = Array.from(map.values()).filter((item) => item.amount > 0 || item.count > 0);

  if (uncategorizedCount > 0) {
    stats.push({
      categoryId: null as unknown as number,
      name: "미분류",
      amount: uncategorizedAmount,
      count: uncategorizedCount,
    });
  }

  if (stats.length === 0) {
    return minors.map((minor) => ({
      categoryId: minor.id,
      name: minor.name,
      amount: 0,
      count: 0,
    }));
  }

  return stats
    .map((item) => ({
      categoryId: item.name === "미분류" ? null : item.categoryId,
      name: item.name,
      amount: item.amount,
      count: item.count,
    }))
    .sort((a, b) => b.amount - a.amount);
}
