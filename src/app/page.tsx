import { getIndicators } from '@/lib/indicators';
import IndicatorsTable from '@/components/IndicatorsTable';

export const revalidate = 21600; // 6 hours

export default async function Home() {
  const data = await getIndicators();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-4 sm:p-6 lg:p-10">
      <header className="w-[96%] max-w-[1800px] mb-8 text-center border-b-2 border-imperial-gold pb-4 mt-4">
        <h1 className="text-3xl sm:text-4xl font-bold uppercase tracking-widest text-imperial-gold">
          Monitorcillo de la Economia Argentina
        </h1>
        <p className="text-imperial-cyan mt-2 font-bold tracking-widest text-lg">(@Fierillo)</p>
      </header>
      <main className="w-[96%] max-w-[1800px] flex flex-col gap-8">
        <IndicatorsTable data={data} />
      </main>
    </div>
  );
}
