
import React, { useState, useMemo } from 'react';
import { CheckCircle2, Sparkles, Brain, ArrowRight, Star, ThumbsUp, Activity, Trophy, Zap, ShieldCheck, Flame, Hexagon, Layers, Map, LayoutDashboard } from 'lucide-react';
import { calculateSessionXP } from '../utils/gamification';

interface LessonClosureProps {
    masteryGain: number;
    blocksCompleted: number;
    onComplete: () => void; // Trigger the parent lock immediately
}

export const LessonClosure: React.FC<LessonClosureProps> = ({ masteryGain, blocksCompleted, onComplete }) => {
    const [step, setStep] = useState<'reflection' | 'summary'>('reflection');
    const [summary, setSummary] = useState('');
    const [confidence, setConfidence] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Calculate XP Reward on mount
    const xpEarned = useMemo(() => calculateSessionXP(blocksCompleted, masteryGain), [blocksCompleted, masteryGain]);

    const handleFinish = () => {
        setIsSubmitting(true);
        // Simulate save delay then trigger parent lock
        setTimeout(() => {
            setIsSubmitting(false);
            onComplete(); // IMMEDIATE LOCK
        }, 800);
    };

    return (
        <div className="my-16 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Main Card Container - Premium Light Style */}
            <div className="relative bg-white rounded-3xl shadow-[0_20px_50px_-12px_rgba(99,102,241,0.15)] border border-gray-100 overflow-hidden p-1">
                
                {/* Subtle Background Gradients */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-50 rounded-full blur-3xl pointer-events-none opacity-60"></div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-50 rounded-full blur-3xl pointer-events-none opacity-60"></div>

                <div className="relative p-8 md:p-10 flex flex-col items-center">
                    
                    {/* XP Badge (New Hero Reward) */}
                    <div className="mb-6 relative group cursor-default">
                        <div className="absolute inset-0 bg-amber-200 rounded-full blur-xl opacity-40 animate-pulse"></div>
                        <div className="relative bg-gradient-to-br from-amber-100 to-white p-1 rounded-full shadow-lg border border-amber-200">
                            <div className="bg-white rounded-full p-4 flex flex-col items-center justify-center w-24 h-24 border border-amber-100">
                                <div className="text-amber-500"><Star className="w-6 h-6 fill-amber-500" /></div>
                                <div className="font-bold text-gray-900 text-lg leading-none mt-1">+{xpEarned}</div>
                                <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">XP</div>
                            </div>
                        </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-2 text-center">Victory!</h2>
                    <p className="text-gray-500 text-sm font-medium mb-10 text-center max-w-sm">
                        You've successfully strengthened your neural pathways and earned Hero Experience.
                    </p>

                    {/* Stats Grid - Floating Pills */}
                    <div className="grid grid-cols-3 gap-4 w-full mb-10">
                        <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-md transition-all group">
                            <div className="text-indigo-500 mb-1 group-hover:scale-110 transition-transform"><Layers className="w-5 h-5" /></div>
                            <div className="text-xl font-bold text-gray-900">{blocksCompleted}</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Blocks</div>
                        </div>
                        <div className="flex flex-col items-center justify-center p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 hover:bg-emerald-50 hover:shadow-md transition-all group">
                            <div className="text-emerald-500 mb-1 group-hover:scale-110 transition-transform"><Zap className="w-5 h-5 fill-current" /></div>
                            <div className="text-xl font-bold text-emerald-700">+{masteryGain}%</div>
                            <div className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-wider">Mastery</div>
                        </div>
                        <div className="flex flex-col items-center justify-center p-4 bg-purple-50/50 rounded-2xl border border-purple-100 hover:bg-purple-50 hover:shadow-md transition-all group">
                            <div className="text-purple-500 mb-1 group-hover:scale-110 transition-transform"><Hexagon className="w-5 h-5 fill-current" /></div>
                            <div className="text-xl font-bold text-purple-700">Rare</div>
                            <div className="text-[10px] font-bold text-purple-600/70 uppercase tracking-wider">Loot</div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="w-full h-px bg-gray-100 mb-8"></div>

                    {/* Interactive Section */}
                    <div className="w-full">
                        {step === 'reflection' ? (
                            <div className="animate-in fade-in slide-in-from-right-8 duration-300">
                                <div className="text-center mb-6">
                                    <h3 className="font-bold text-gray-800 text-lg mb-1">Rate this encounter</h3>
                                    <p className="text-gray-400 text-xs">Difficulty rating calibrates future quests.</p>
                                </div>

                                <div className="flex justify-between gap-3 mb-8">
                                    {[1, 2, 3, 4, 5].map((level) => {
                                        const isSelected = confidence === level;
                                        return (
                                            <button
                                                key={level}
                                                onClick={() => setConfidence(level)}
                                                className={`
                                                    flex-1 h-14 rounded-xl font-bold text-lg transition-all duration-200 border-2
                                                    ${isSelected 
                                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105' 
                                                        : 'bg-white border-gray-100 text-gray-400 hover:border-indigo-200 hover:text-indigo-500 hover:bg-indigo-50'}
                                                `}
                                            >
                                                {level}
                                            </button>
                                        );
                                    })}
                                </div>
                                
                                <div className="flex justify-between text-xs font-bold text-gray-300 uppercase px-2 mb-6">
                                    <span>Tough Battle</span>
                                    <span>Easy Win</span>
                                </div>

                                <button 
                                    onClick={() => setStep('summary')}
                                    disabled={confidence === null}
                                    className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
                                >
                                    <span>Claim Rewards</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="animate-in fade-in slide-in-from-right-8 duration-300">
                                <div className="text-center mb-6">
                                    <h3 className="font-bold text-gray-800 text-lg mb-1">Scribe your Knowledge</h3>
                                    <p className="text-gray-400 text-xs">Summarize to boost retention bonus by 40%.</p>
                                </div>

                                <div className="relative mb-6">
                                    <textarea
                                        value={summary}
                                        onChange={(e) => setSummary(e.target.value)}
                                        placeholder="The core concept I mastered was..."
                                        className="w-full h-32 p-5 border-2 border-gray-100 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none resize-none text-base bg-white text-gray-700 shadow-inner placeholder:text-gray-300"
                                        autoFocus
                                    />
                                    <div className="absolute bottom-4 right-4 text-gray-300 text-xs font-mono">{summary.length} chars</div>
                                </div>

                                <button 
                                    onClick={handleFinish}
                                    disabled={summary.length < 5 || isSubmitting}
                                    className={`
                                        w-full py-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 shadow-xl hover:-translate-y-0.5
                                        ${isSubmitting ? 'bg-emerald-500 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700'}
                                        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                                    `}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <ShieldCheck className="w-5 h-5 animate-pulse" />
                                            <span>Syncing Profile...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-5 h-5" />
                                            <span>Complete Quest</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>

                </div>
            </div>
            
            {/* Dismiss option for power users */}
            <div className="text-center mt-6">
                <button onClick={onComplete} className="text-gray-300 text-xs hover:text-gray-500 font-medium transition-colors">
                    Skip reflection (Forfeit Bonus XP)
                </button>
            </div>
        </div>
    );
};
