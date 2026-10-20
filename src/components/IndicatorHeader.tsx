'use client';

import Link from 'next/link';
import type { MouseEvent } from 'react';
import type { FeedbackContext } from '@/types';
import FeedbackButton from './FeedbackButton';

export default function IndicatorHeader({ title, subtitle, feedbackContext, isReturning = false, onReturnClick }: {
    title: string;
    subtitle?: string;
    feedbackContext: FeedbackContext;
    isReturning?: boolean;
    onReturnClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
    return (
        <header className="w-full sm:w-[96%] max-w-[1800px] mb-4 sm:mb-8 border-b-2 border-imperial-gold pb-4 mt-2 sm:mt-4 flex flex-col items-start gap-3 sm:flex-row-reverse sm:items-center sm:justify-between px-2">
            <div className="flex w-full items-stretch justify-end gap-2 sm:w-auto">
                <FeedbackButton context={feedbackContext} />
                <Link href="/" onClick={onReturnClick} aria-disabled={isReturning} tabIndex={isReturning ? -1 : undefined} className="flex shrink-0 items-center justify-center border-2 border-imperial-gold px-3 py-1 text-xs font-bold uppercase text-imperial-gold transition-colors hover:bg-imperial-gold hover:text-imperial-blue sm:px-4 sm:py-2 sm:text-base">Volver</Link>
            </div>
            <div className="w-full text-center sm:text-left">
                <h1 className="imperial-title text-xl sm:text-3xl font-bold tracking-widest text-imperial-gold leading-tight uppercase">
                    {title}
                </h1>
                {subtitle && <p className="text-imperial-cyan mt-1 font-bold text-xs sm:text-base">{subtitle}</p>}
            </div>
        </header>
    );
}
