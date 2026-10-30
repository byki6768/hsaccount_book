import type { CategoryKind } from "@/lib/categories";
import type { Locale } from "@/lib/i18n/locales";

export type CategoryTree = {
  majors: Array<{ name: string; minors: string[] }>;
};

/** Words that mark the catch-all "other" subcategory in each language. */
export const OTHER_MARKERS = ["기타", "Other", "その他"] as const;

export function containsOtherMarker(name: string): boolean {
  return OTHER_MARKERS.some((marker) => name.includes(marker));
}

export function otherMinorName(majorName: string, locale: Locale): string {
  if (locale === "en") return `${majorName} (Other)`;
  if (locale === "ja") return `${majorName}（その他）`;
  return `${majorName}(기타)`;
}

/** Example shown to the AI for the catch-all subcategory format. */
export const OTHER_MINOR_EXAMPLES: Record<Locale, string> = {
  ko: '"식비(기타)", "급여(기타)"',
  en: '"Food (Other)", "Salary (Other)"',
  ja: '"食費（その他）", "給与（その他）"',
};

export const DEFAULT_CATEGORY_TREES: Record<Locale, Record<CategoryKind, CategoryTree>> = {
  ko: {
    expense: {
      majors: [
        { name: "식비", minors: ["외식", "식료품", "식비(기타)"] },
        { name: "주거/통신", minors: ["관리비", "통신비", "주거/통신(기타)"] },
        { name: "생활용품", minors: ["생필품", "가전/가구", "생활용품(기타)"] },
        { name: "의류/미용", minors: ["의류", "미용", "의류/미용(기타)"] },
        { name: "건강/의료", minors: ["병원", "약국", "건강/의료(기타)"] },
        { name: "문화/여가", minors: ["여행", "취미", "문화/여가(기타)"] },
        { name: "교통/차량", minors: ["대중교통", "주유", "교통/차량(기타)"] },
        { name: "금융/기타", minors: ["보험", "경조사", "금융/기타(기타)"] },
      ],
    },
    income: {
      majors: [
        { name: "급여", minors: ["월급", "상여금", "급여(기타)"] },
        { name: "사업소득", minors: ["매출", "사업소득(기타)"] },
        { name: "부수입", minors: ["아르바이트", "부수입(기타)"] },
        { name: "금융소득", minors: ["이자", "배당", "금융소득(기타)"] },
        { name: "용돈", minors: ["가족", "용돈(기타)"] },
        { name: "환급", minors: ["세금환급", "환급(기타)"] },
        { name: "판매", minors: ["중고판매", "판매(기타)"] },
        { name: "기타수입", minors: ["지원금", "기타수입(기타)"] },
      ],
    },
  },
  en: {
    expense: {
      majors: [
        { name: "Food", minors: ["Dining out", "Groceries", "Food (Other)"] },
        { name: "Housing/Phone", minors: ["Utilities", "Phone/Internet", "Housing/Phone (Other)"] },
        { name: "Household", minors: ["Essentials", "Appliances/Furniture", "Household (Other)"] },
        { name: "Clothing/Beauty", minors: ["Clothing", "Beauty", "Clothing/Beauty (Other)"] },
        { name: "Health", minors: ["Hospital", "Pharmacy", "Health (Other)"] },
        { name: "Leisure", minors: ["Travel", "Hobbies", "Leisure (Other)"] },
        { name: "Transport", minors: ["Public transit", "Fuel", "Transport (Other)"] },
        { name: "Finance/Misc", minors: ["Insurance", "Gifts/Events", "Finance/Misc (Other)"] },
      ],
    },
    income: {
      majors: [
        { name: "Salary", minors: ["Monthly pay", "Bonus", "Salary (Other)"] },
        { name: "Business", minors: ["Sales", "Business (Other)"] },
        { name: "Side income", minors: ["Part-time", "Side income (Other)"] },
        { name: "Investment", minors: ["Interest", "Dividends", "Investment (Other)"] },
        { name: "Allowance", minors: ["Family", "Allowance (Other)"] },
        { name: "Refunds", minors: ["Tax refund", "Refunds (Other)"] },
        { name: "Sales", minors: ["Used items", "Sales (Other)"] },
        { name: "Misc income", minors: ["Grants", "Misc income (Other)"] },
      ],
    },
  },
  ja: {
    expense: {
      majors: [
        { name: "食費", minors: ["外食", "食料品", "食費（その他）"] },
        { name: "住居・通信", minors: ["管理費", "通信費", "住居・通信（その他）"] },
        { name: "日用品", minors: ["生活必需品", "家電・家具", "日用品（その他）"] },
        { name: "衣服・美容", minors: ["衣服", "美容", "衣服・美容（その他）"] },
        { name: "健康・医療", minors: ["病院", "薬局", "健康・医療（その他）"] },
        { name: "趣味・娯楽", minors: ["旅行", "趣味", "趣味・娯楽（その他）"] },
        { name: "交通・車", minors: ["公共交通", "ガソリン", "交通・車（その他）"] },
        { name: "金融・その他", minors: ["保険", "冠婚葬祭", "金融・その他（その他）"] },
      ],
    },
    income: {
      majors: [
        { name: "給与", minors: ["月給", "賞与", "給与（その他）"] },
        { name: "事業所得", minors: ["売上", "事業所得（その他）"] },
        { name: "副収入", minors: ["アルバイト", "副収入（その他）"] },
        { name: "金融所得", minors: ["利息", "配当", "金融所得（その他）"] },
        { name: "お小遣い", minors: ["家族", "お小遣い（その他）"] },
        { name: "還付", minors: ["税金還付", "還付（その他）"] },
        { name: "販売", minors: ["中古販売", "販売（その他）"] },
        { name: "その他収入", minors: ["給付金", "その他収入（その他）"] },
      ],
    },
  },
};
