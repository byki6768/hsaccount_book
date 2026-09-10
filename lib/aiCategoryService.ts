import type { Category, CategoryKind } from "@/lib/categories";
import { groupCategories, isMajor } from "@/lib/categories";
import type { AiCategoryTree } from "@/lib/aiCategories";
import { generateCategoryTree } from "@/lib/aiCategories";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchMemberCategories(
  supabase: SupabaseClient,
  memberUniqueId: string,
): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("member_unique_id", memberUniqueId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Category[];
}

async function seedAiTree(
  supabase: SupabaseClient,
  memberUniqueId: string,
  kind: CategoryKind,
  tree: AiCategoryTree,
) {
  for (let majorIndex = 0; majorIndex < tree.majors.length; majorIndex += 1) {
    const node = tree.majors[majorIndex];
    const { data: major, error: majorError } = await supabase
      .from("categories")
      .insert({
        member_unique_id: memberUniqueId,
        kind,
        name: node.name.trim(),
        parent_id: null,
        sort_order: majorIndex + 1,
        is_default: true,
      })
      .select("*")
      .single();

    if (majorError) throw new Error(majorError.message);

    const minors = node.minors.map((name, minorIndex) => ({
      member_unique_id: memberUniqueId,
      kind,
      name: name.trim(),
      parent_id: (major as Category).id,
      sort_order: minorIndex + 1,
      is_default: true,
    }));

    const { error: minorError } = await supabase.from("categories").insert(minors);
    if (minorError) throw new Error(minorError.message);
  }
}

export async function ensureAiCategoryTrees(
  supabase: SupabaseClient,
  memberUniqueId: string,
): Promise<{
  categories: Category[];
  expenseTree: AiCategoryTree;
  incomeTree: AiCategoryTree;
  generated: { expense: boolean; income: boolean };
}> {
  let categories = await fetchMemberCategories(supabase, memberUniqueId);
  const generated = { expense: false, income: false };

  const needsTree = (kind: CategoryKind) => {
    const majors = categories.filter((c) => c.kind === kind && isMajor(c));
    if (majors.length !== 8) return true;
    return majors.some((major) => {
      const minors = categories.filter((c) => c.parent_id === major.id);
      if (minors.length < 2 || minors.length > 4) return true;
      const last = [...minors].sort((a, b) => a.sort_order - b.sort_order).at(-1);
      return !last?.name.includes("기타");
    });
  };

  async function replaceKind(kind: CategoryKind) {
    const table = kind === "expense" ? "expenses" : "incomes";
    const { error: unlinkError } = await supabase
      .from(table)
      .update({ category_id: null })
      .eq("member_unique_id", memberUniqueId);
    if (unlinkError) throw new Error(unlinkError.message);

    const { error: minorClearError } = await supabase
      .from("categories")
      .delete()
      .eq("member_unique_id", memberUniqueId)
      .eq("kind", kind)
      .not("parent_id", "is", null);
    if (minorClearError) throw new Error(minorClearError.message);

    const { error: majorClearError } = await supabase
      .from("categories")
      .delete()
      .eq("member_unique_id", memberUniqueId)
      .eq("kind", kind)
      .is("parent_id", null);
    if (majorClearError) throw new Error(majorClearError.message);

    const tree = await generateCategoryTree(kind);
    await seedAiTree(supabase, memberUniqueId, kind, tree);
  }

  if (needsTree("expense")) {
    await replaceKind("expense");
    generated.expense = true;
  }

  if (needsTree("income")) {
    await replaceKind("income");
    generated.income = true;
  }

  if (generated.expense || generated.income) {
    categories = await fetchMemberCategories(supabase, memberUniqueId);
  }

  return {
    categories,
    expenseTree: toAiTree(categories, "expense"),
    incomeTree: toAiTree(categories, "income"),
    generated,
  };
}

export function toAiTree(categories: Category[], kind: CategoryKind): AiCategoryTree {
  const groups = groupCategories(categories.filter((c) => c.kind === kind));
  return {
    majors: groups.map((group) => ({
      name: group.major.name,
      minors: group.minors.map((m) => m.name),
    })),
  };
}

export function findMinorCategoryId(
  categories: Category[],
  kind: CategoryKind,
  majorName: string | null,
  minorName: string | null,
): number | null {
  const groups = groupCategories(categories.filter((c) => c.kind === kind));

  const major =
    groups.find((g) => g.major.name === majorName) ??
    groups.find((g) => majorName && g.major.name.includes(majorName)) ??
    null;

  if (!major) {
    const fallback = groups[0];
    if (!fallback) return null;
    const other =
      fallback.minors.find((m) => m.name.includes("기타")) ?? fallback.minors.at(-1);
    return other?.id ?? fallback.major.id;
  }

  const minor =
    major.minors.find((m) => m.name === minorName) ??
    major.minors.find((m) => minorName && m.name.includes(minorName)) ??
    major.minors.find((m) => m.name.includes("기타")) ??
    major.minors.at(-1);

  return minor?.id ?? major.major.id;
}
