import { MarketingArticle } from "@/components/marketing/marketing-article";
import { marketingMetadata } from "@/lib/marketing/types";
import { vsSalonbooking } from "@/lib/marketing/content";

export const revalidate = 3600;
export const metadata = marketingMetadata(vsSalonbooking);

export default function Page() {
  return <MarketingArticle page={vsSalonbooking} />;
}
