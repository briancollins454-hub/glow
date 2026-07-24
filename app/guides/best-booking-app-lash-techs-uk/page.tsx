import { MarketingArticle } from "@/components/marketing/marketing-article";
import { marketingMetadata } from "@/lib/marketing/types";
import { guideLash } from "@/lib/marketing/content";

export const revalidate = 3600;
export const metadata = marketingMetadata(guideLash);

export default function Page() {
  return <MarketingArticle page={guideLash} />;
}
