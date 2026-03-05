'use client';

import { MethodologyItem } from '@/types/chart';

interface MethodologySectionProps {
    methodology: MethodologyItem[];
}

export default function MethodologySection({ methodology }: MethodologySectionProps) {
    return (
        <div className="mt-2 pt-2 border-t border-imperial-gold/30 shrink-0 px-2 pb-1">
            <h3 className="text-imperial-gold font-bold text-[10px] mb-1">Fuentes y metodología</h3>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px]">
                {methodology.map((item, idx) => (
                    <div key={idx} className="leading-tight">
                        <span className="text-imperial-cyan font-bold">{item.title}:</span>{' '}
                        <span className="text-foreground/80">{item.description}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
