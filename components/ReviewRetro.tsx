
import React, { useState } from 'react';
import { Lock, Award, Sparkles, Brain } from 'lucide-react';
import { getWeeklyStatus } from '../utils/learning';
import { SynthesisModal } from './SynthesisModal';

interface ReviewRetroProps {
    stats: {
        weeklyReviewedCount: number;
        weeklyMasteryAvg: number;
        topConcept: string;
        weeklyConcepts: string[];
    };
    virtualNow: number;
    onNavigateToPage: (id: string) => void;
}

export const ReviewRetro: React.FC<ReviewRetroProps> = ({ stats, virtualNow, onNavigateToPage }) => {
    const [showSynthesisModal, setShowSynthesisModal] = useState(false);
    const { isUnlocked, message: lockMessage } = getWeeklyStatus(virtualNow, stats.weeklyReviewedCount);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-indigo-600 rounded-2xl p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
                
                <div className="mb-6 md:mb-0 relative z-10">
                    <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                        Weekly Retrospective
                        {!isUnlocked && <Lock className="w-5 h-5 text-indigo-300" />}
                    </h2>
                    <p className="text-indigo-100 text-sm max-w-md">Reflecting on what you've learned solidifies neural pathways. Review your activity for the last 7 days.</p>
                </div>
                <div className="flex gap-4 relative z-10">
                    <div className="text-center bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                        <div className="text-3xl font-bold">{stats.weeklyReviewedCount}</div>
                        <div className="text-[10px] uppercase font-bold text-indigo-200">Blocks Reviewed</div>
                    </div>
                    <div className="text-center bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                        <div className="text-3xl font-bold">{stats.weeklyMasteryAvg}%</div>
                        <div className="text-[10px] uppercase font-bold text-indigo-200">Avg Mastery</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center space-x-2 mb-4 text-gray-500 text-xs font-bold uppercase tracking-wider">
                            <Award className="w-4 h-4 text-amber-500" />
                            <span>Most Valuable Concept (MVC)</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 mb-2">{stats.topConcept}</div>
                        <p className="text-sm text-gray-500">This concept had the most activity this week. You are building strong density here.</p>
                    </div>
                </div>

                <div className={`bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl border ${isUnlocked ? 'border-indigo-200' : 'border-gray-200'} shadow-sm relative overflow-hidden group`}>
                        <div className="flex items-center space-x-2 mb-4 text-indigo-600 text-xs font-bold uppercase tracking-wider relative z-10">
                        <Sparkles className="w-4 h-4" />
                        <span>Synthesis & Reflection</span>
                    </div>
                    
                    <p className="text-sm text-gray-700 mb-6 relative z-10">
                        Generate a unique lesson plan to connect this week's concepts ({stats.weeklyConcepts.length} topics).
                    </p>

                    {isUnlocked ? (
                        <button 
                            onClick={() => setShowSynthesisModal(true)}
                            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 relative z-10"
                        >
                            <Brain className="w-4 h-4" />
                            <span>Start Guided Reflection</span>
                        </button>
                    ) : (
                        <div className="relative z-10">
                            <button disabled className="w-full bg-gray-200 text-gray-400 font-bold py-3 rounded-xl cursor-not-allowed flex items-center justify-center gap-2">
                                <Lock className="w-4 h-4" />
                                <span>Locked</span>
                            </button>
                            <p className="text-xs text-center mt-2 text-gray-400 font-medium">
                                {lockMessage}
                            </p>
                        </div>
                    )}
                    
                    {!isUnlocked && <div className="absolute inset-0 bg-gray-100/50 backdrop-grayscale pointer-events-none"></div>}
                </div>
            </div>

            <SynthesisModal 
                isOpen={showSynthesisModal} 
                onClose={() => setShowSynthesisModal(false)}
                onPageCreated={(id) => {
                    setShowSynthesisModal(false);
                    onNavigateToPage(id);
                }}
                stats={stats}
            />
        </div>
    );
};
