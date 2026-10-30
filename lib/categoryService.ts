import { Category, groupCategories, isMajor, isMinor } from "@/lib/categories";

type StatItem = { categoryId: number | null; name: string; amount: number; count: number };

function finalizeStats(
  stats: StatItem[],
  uncategorizedAmount: number,
  uncategorizedCount: number,
  uncategorizedLabel: string,
): StatItem[] {
  if (uncategorizedCount > 0) {
    stats.push({
      categoryId: null,
      name: uncategorizedLabel,
      amount: uncategorizedAmount,
      count: uncategorizedCount,
    });
  }
  return stats.sort((a, b) => b.amount - a.amount);
}

export function buildMajorStats(
  rows: Array<{ amount: number; category_id: number | null }>,
  categories: Category[],
  uncategorizedLabel: string,
) {
  const groups = groupCategories(categories);

  const map = new Map<number, StatItem>();
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
    const category =
      row.category_id == null ? undefined : categories.find((c) => c.id === row.category_id);
    const majorId = !category
      ? null
      : isMinor(category)
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
  if (stats.length === 0 && uncategorizedCount === 0) {
    return groups.map((group) => ({
      categoryId: group.major.id as number | null,
      name: group.major.name,
      amount: 0,
      count: 0,
    }));
  }

  return finalizeStats(stats, uncategorizedAmount, uncategorizedCount, uncategorizedLabel);
}

export function buildMinorStats(
  rows: Array<{ amount: number; category_id: number | null }>,
  categories: Category[],
  uncategorizedLabel: string,
) {
  const minors = categories.filter(isMinor);
  const map = new Map<number, StatItem>();

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
    } else {
      // Rows without a minor category (none, or linked only to a major)
      uncategorizedAmount += row.amount;
      uncategorizedCount += 1;
    }
  }

  const stats = Array.from(map.values()).filter((item) => item.amount > 0 || item.count > 0);
  if (stats.length === 0 && uncategorizedCount === 0) {
    return minors.map((minor) => ({
      categoryId: minor.id as number | null,
      name: minor.name,
      amount: 0,
      count: 0,
    }));
  }

  return finalizeStats(stats, uncategorizedAmount, uncategorizedCount, uncategorizedLabel);
}
