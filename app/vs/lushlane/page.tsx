import { MarketingArticle } from "@/components/marketing/marketing-article";
import { marketingMetadata } from "@/lib/marketing/types";
import { vsLushlane } from "@/lib/marketing/content";

export const revalidate = 3600;
export const metadata = marketingMetadata(vsLushlane);

export default function Page() {
  return <MarketingArticle page={vsLushlane} />;
}
