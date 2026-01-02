
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TimeContextType {
    virtualNow: number;
    advanceTime: (days: number) => void;
    resetTime: () => void;
}

const TimeContext = createContext<TimeContextType>({
    virtualNow: Date.now(),
    advanceTime: () => {},
    resetTime: () => {},
});

export const useTime = () => useContext(TimeContext);

export const TimeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Initialize from storage or default to 0 offset
    const [offset, setOffset] = useState<number>(() => {
        const stored = localStorage.getItem('eduforge_time_offset');
        return stored ? parseInt(stored, 10) : 0;
    });

    const virtualNow = Date.now() + offset;

    const advanceTime = (days: number) => {
        const ms = days * 24 * 60 * 60 * 1000;
        const newOffset = offset + ms;
        setOffset(newOffset);
        localStorage.setItem('eduforge_time_offset', newOffset.toString());
    };

    const resetTime = () => {
        setOffset(0);
        localStorage.removeItem('eduforge_time_offset');
    };

    return (
        <TimeContext.Provider value={{ virtualNow, advanceTime, resetTime }}>
            {children}
        </TimeContext.Provider>
    );
};
