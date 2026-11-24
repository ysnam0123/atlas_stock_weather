import { Suspense } from "react";
import { StockScreen } from "@/features/stock/stock-screen";

/** 주소의 티커는 요청마다 다르다. cacheComponents에서는 Suspense 안에서 읽는다 */
async function Stock({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return <StockScreen symbol={decodeURIComponent(symbol).toUpperCase()} />;
}

export default function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  return (
    <Suspense>
      <Stock params={params} />
    </Suspense>
  );
}
