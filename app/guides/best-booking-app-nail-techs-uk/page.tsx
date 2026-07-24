import { MarketingArticle } from "@/components/marketing/marketing-article";
import { marketingMetadata } from "@/lib/marketing/types";
import { guideNail } from "@/lib/marketing/content";

export const revalidate = 3600;
export const metadata = marketingMetadata(guideNail);

export default function Page() {
  return <MarketingArticle page={guideNail} />;
}
