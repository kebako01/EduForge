
import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useTime } from '../contexts/TimeContext';
import { Block, BlockType, HabitBlock, TaskBlock } from '../types';
import SafeBlockRenderer from './SafeBlockRenderer';
import { Flame, CheckSquare, Brain, Sun, CalendarDays, ArrowRight, ListTodo, Plus, Sparkles } from 'lucide-react';

interface LifeForgeProps {
    onNavigate: (pageId: string) => void;
    onOpenAI: () => void; // Function to open the AI modal
    isEmbedded?: boolean; // NEW: Removes outer layout for usage in Tabs
}

export const LifeForge: React.FC<LifeForgeProps> = ({ onNavigate, onOpenAI, isEmbedded = false }) => {
    const { virtualNow } = useTime();

    const data = useLiveQuery(async () => {
        const pages = await db.pages.toArray();
        const now = virtualNow;

        // 1. Gather all Habits
        const habits: { block: HabitBlock, pageId: string }[] = [];
        // 2. Gather all Active Tasks
        const tasks: { block: TaskBlock, pageId: string }[] = [];
        // 3. Count Review Items
        let reviewCount = 0;

        pages.forEach(p => {
            p.blocks.forEach(b => {
                if (b.type === BlockType.HABIT) {
                    habits.push({ block: b as HabitBlock, pageId: p.id });
                }
                if (b.type === BlockType.TASK) {
                    const task = b as TaskBlock;
                    if (!task.isCompleted) tasks.push({ block: task, pageId: p.id });
                }
                // Check for reviews due
                if (b.srs && b.srs.nextReviewDue && b.srs.nextReviewDue <= now) {
                    reviewCount++;
                }
            });
        });

        // Sort Habits: Completed today move to bottom? No, keep fixed order usually, but here let's sort by streak desc
        habits.sort((a,b) => b.block.streak - a.block.streak);

        // Sort Tasks: Due date asc
        tasks.sort((a,b) => (a.block.dueDate || Infinity) - (b.block.dueDate || Infinity));

        return { habits, tasks, reviewCount };
    }, [virtualNow]);

    if (!data) return null;

    const dateStr = new Date(virtualNow).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    // Conditional Wrapper: If embedded, return clean content. If standalone, return full page layout.
    const Content = (
        <div className={`space-y-8 md:space-y-12 ${isEmbedded ? 'animate-in fade-in slide-in-from-bottom-4 duration-500' : 'max-w-5xl mx-auto'}`}>
            
            {/* Header (Simplified if embedded) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    {!isEmbedded && (
                        <div className="flex items-center space-x-2 text-indigo-600 mb-1 font-bold text-sm uppercase tracking-wider">
                            <Sun className="w-4 h-4" />
                            <span>Daily Dashboard</span>
                        </div>
                    )}
                    <h2 className={`${isEmbedded ? 'text-xl' : 'text-2xl md:text-3xl'} font-bold text-gray-900 tracking-tight`}>
                        {isEmbedded ? "Today's Focus" : "Life Forge"}
                    </h2>
                    <p className="text-gray-500 mt-1 flex items-center gap-2">
                        <CalendarDays className="w-4 h-4" />
                        {dateStr}
                    </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4">
                    {/* Create Habit Button */}
                    <button 
                        onClick={onOpenAI}
                        className="bg-white border border-gray-200 text-gray-700 font-bold px-4 py-3 rounded-xl shadow-sm hover:bg-gray-50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Design Routine</span>
                    </button>

                    {/* Quick Review Status (Hide if embedded in ReviewHub, as Hub shows this elsewhere) */}
                    {!isEmbedded && (
                        <div className="bg-white px-5 py-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 justify-center sm:justify-start">
                            <div className={`p-2 rounded-full ${data.reviewCount > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                <Brain className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xl font-bold text-gray-900 leading-none">{data.reviewCount}</div>
                                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">Reviews</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Section 1: Rituals (Habits) */}
            <section>
                <div className="flex items-center gap-2 mb-4 text-gray-900 font-bold text-lg">
                    <Flame className="w-5 h-5 text-orange-500" />
                    <h2>Daily Rituals</h2>
                </div>
                
                {data.habits.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 border-dashed flex flex-col items-center">
                        <div className="p-3 bg-gray-50 rounded-full mb-3">
                            <Sparkles className="w-6 h-6 text-indigo-400" />
                        </div>
                        <h3 className="font-bold text-gray-900">No Habits Defined</h3>
                        <p className="text-gray-500 text-sm mt-1 mb-4 max-w-sm">
                            Use the AI Architect to create a "Morning Routine" or "Wellness Protocol" page containing habit blocks.
                        </p>
                        <button 
                            onClick={onOpenAI}
                            className="text-indigo-600 font-bold text-sm hover:underline"
                        >
                            Open AI Architect &rarr;
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {data.habits.map((item) => (
                            <div key={item.block.id} className="transform transition-all hover:-translate-y-1">
                                {/* Direct rendering of HabitBlock via SafeBlockRenderer to ensure consistency */}
                                <SafeBlockRenderer block={item.block} pageId={item.pageId} />
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Section 2: Active Projects (Tasks) */}
            <section>
                <div className="flex items-center gap-2 mb-4 text-gray-900 font-bold text-lg">
                    <ListTodo className="w-5 h-5 text-indigo-500" />
                    <h2>Task Queue</h2>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    {data.tasks.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">
                            All active tasks completed. Freedom!
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {data.tasks.map((item) => (
                                <div key={item.block.id} className="p-2 hover:bg-gray-50 transition-colors">
                                    <SafeBlockRenderer block={item.block} pageId={item.pageId} />
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">
                        {data.tasks.length} Pending
                    </div>
                </div>
            </section>

        </div>
    );

    if (isEmbedded) return Content;

    return (
        <div className="flex-1 h-screen overflow-y-auto bg-gray-50 p-4 md:p-8">
            {Content}
        </div>
    );
};
