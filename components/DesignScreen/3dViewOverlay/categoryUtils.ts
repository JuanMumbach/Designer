import { ObjectCategory } from "../../../services/api";

export function getBreadcrumbPath(
  categoryId: string | null,
  categories: ObjectCategory[]
): string {
  if (!categoryId) return "All Categories";

  const path: string[] = [];
  let current: ObjectCategory | undefined = categories.find(c => c.id === categoryId);

  while (current) {
    path.unshift(current.categoryName);
    current = categories.find(c => c.id === current?.parentCategoryId);
  }

  return "All > " + path.join(" > ");
}
