import { MarketingArticle } from "@/components/marketing/marketing-article";
import { marketingMetadata } from "@/lib/marketing/types";
import { vsFresha } from "@/lib/marketing/content";

export const revalidate = 3600;
export const metadata = marketingMetadata(vsFresha);

export default function Page() {
  return <MarketingArticle page={vsFresha} />;
}
