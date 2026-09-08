export type IndicatorPageProps = {
    params: Promise<{
        id: string;
    }>;
    searchParams?: Promise<{
        view?: string;
        mode?: string;
    }>;
};
