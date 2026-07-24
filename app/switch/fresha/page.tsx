import { MarketingArticle } from "@/components/marketing/marketing-article";
import { marketingMetadata } from "@/lib/marketing/types";
import { switchFresha } from "@/lib/marketing/content";

export const revalidate = 3600;
export const metadata = marketingMetadata(switchFresha);

export default function Page() {
  return <MarketingArticle page={switchFresha} />;
}
