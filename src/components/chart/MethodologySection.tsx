'use client';

import { useState } from 'react';
import { MethodologyItem } from '@/types/chart';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface MethodologySectionProps {
    methodology: MethodologyItem[];
    forceOpen?: boolean;
}

export default function MethodologySection({ methodology, forceOpen }: MethodologySectionProps) {
    const [isOpen, setIsOpen] = useState(false);
    const show = isOpen || forceOpen;

    return (
        <div className="mt-4 border-t border-imperial-gold/20 pt-1">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="no-capture w-full flex items-center justify-between py-2 px-2 text-imperial-gold hover:opacity-80 transition-opacity"
            >
                <span className="text-[10px] font-bold uppercase tracking-wider">Fuentes y metodología</span>
                {show ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {show && (
                <div className="px-2 pb-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
                    {methodology.map((item, idx) => (
                        <div key={idx} className="text-[7px] leading-[1.1]">
                            <span className="text-imperial-cyan font-bold uppercase">{item.title}:</span>{' '}
                            <span className="text-foreground/50">{item.description}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
