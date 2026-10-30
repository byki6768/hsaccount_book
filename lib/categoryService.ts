import { Category, groupCategories, isMajor, isMinor } from "@/lib/categories";

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
