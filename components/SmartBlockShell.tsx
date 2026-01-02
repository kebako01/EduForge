import React, { useState, useEffect, useRef } from 'react';
import { Check, X, HelpCircle, ArrowRight, ArrowLeft, Clock, Lightbulb, BookOpen, RotateCcw, Award, Trophy, Layers, Share2, Anchor } from 'lucide-react';
import { SRSData, BlockState } from '../types';
import { MarkdownRenderer } from '../utils/markdown';
import { processSessionCompletion } from '../utils/learning';
import { useTime } from '../contexts/TimeContext';

interface VariationResult {
    id: string;
    status: BlockState['status'];
    attempts: number;
}

interface SmartBlockShellProps {
    children: (context: { 
        status: 'idle' | 'correct' | 'incorrect' | 'revealed'; 
        disabled: boolean;
        showSolution: boolean; 
        onInteract: () => void;
    }) => React.ReactNode;
    
    // Core Data
    id: string; 
    type: string;
    srsData?: SRSData;
    
    // Persistence
    initialState?: BlockState;
    
    // Feedback Content
    hints?: string[];
    explanation?: string; 
    explanationSteps?: { title: string; content: string }[];

    // Logic
    onVerify: () => Promise<{ isCorrect: boolean; feedback?: string }>;
    onCommitSRS?: (newSRS: SRSData) => void;
    onPersistState?: (state: BlockState) => void;

    // Variation / Pagination
    variationCount?: number; 
    activeVariationIndex?: number;
    allVariationsCompleted?: boolean;
    resultsSummary?: VariationResult[];
    onVariationChange?: (index: number) => void;
    onResetBlock?: () => void;
}

type BlockStatus = 'idle' | 'incorrect' | 'correct' | 'revealed';

// --- SUB-COMPONENT: Standardized Block Header (The HUD) ---
const BlockHeader: React.FC<{ 
    srsData?: SRSData; 
    variationCount: number;
    activeVariationIndex?: number;
    canGoPrev: boolean;
    canGoNext: boolean;
    onPrev: () => void;
    onNext: () => void;
    onVariationSelect: (idx: number) => void;
    allVariationsCompleted: boolean;
    onViewSummary: () => void;
}> = ({ srsData, variationCount, activeVariationIndex = 0, canGoPrev, canGoNext, onPrev, onNext, onVariationSelect, allVariationsCompleted, onViewSummary }) => {
    
    const [showTooltip, setShowTooltip] = useState(false);

    if (!srsData) return null;

    // Critical Threshold < 2.0 days (matches new FSRS logic)
    const isCritical = (srsData.stability || 100) < 2.0;

    return (
        <div className="border-b border-gray-100 bg-white/50 px-8 py-5 rounded-t-2xl flex flex-col gap-3">
            {/* Top Row: Meta Tags & Navigation */}
            <div className="flex items-center justify-between">
                
                <div className="flex items-center gap-2 relative z-20">
                    {/* Level Badge with Improved Tooltip UX */}
                    <div className="relative">
                        <div 
                            onMouseEnter={() => setShowTooltip(true)}
                            onMouseLeave={() => setShowTooltip(false)}
                            onClick={() => setShowTooltip(!showTooltip)}
                            className={`
                                flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded border cursor-help transition-all uppercase tracking-wider select-none
                                ${isCritical 
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' 
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100'}
                            `}
                        >
                            {isCritical ? <Anchor className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
                            <span>Level {srsData.level}</span>
                        </div>
                        
                        {/* Tooltip: Conditionally rendered via State (Fixes accidental hover bug) */}
                        {showTooltip && (
                            <div className="absolute left-0 bottom-full mb-2 w-56 bg-gray-900 text-white text-[10px] leading-relaxed p-3 rounded-xl shadow-xl normal-case z-50 animate-in fade-in zoom-in-95 duration-200">
                                <div className="font-bold mb-1 text-indigo-300 uppercase tracking-wider">
                                    {isCritical ? "⚠️ Repair Mode" : "✨ Optimal Flow"}
                                </div>
                                {isCritical 
                                    ? "We detected a stability drop (< 2 days). The system has temporarily reduced complexity to reinforce your foundation." 
                                    : "Your mastery is verified. The system is presenting this concept at its standard complexity level."}
                                
                                {/* Tiny Arrow */}
                                <div className="absolute bottom-[-4px] left-4 w-2 h-2 bg-gray-900 rotate-45"></div>
                            </div>
                        )}
                    </div>

                    <span className="text-gray-300 text-xs">•</span>

                    {/* Concept Name (Uppercase Category Style) */}
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate max-w-[200px]">
                        {srsData.name || "CONCEPT"}
                    </span>
                    
                    {/* Interleaving Indicator */}
                    {srsData.integratedLevels && srsData.integratedLevels.length > 0 && (
                        <>
                             <span className="text-gray-300 text-xs">•</span>
                             <div className="flex items-center space-x-1 text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded" title="Integrated Concepts">
                                <Share2 className="w-3 h-3" />
                                <span>Mixed Lvl {srsData.integratedLevels.join(', ')}</span>
                             </div>
                        </>
                    )}
                </div>

                {/* Pagination Controls */}
                {variationCount > 1 && (
                     <div className="flex items-center space-x-2">
                         {allVariationsCompleted && (
                             <button onClick={onViewSummary} className="text-amber-500 hover:text-amber-600 transition-colors" title="View Summary">
                                 <Trophy className="w-4 h-4" />
                             </button>
                         )}
                         <div className="flex items-center space-x-1">
                             <button onClick={onPrev} disabled={!canGoPrev} className="p-1 text-gray-300 hover:text-indigo-600 disabled:opacity-20 transition-colors">
                                 <ArrowLeft className="w-4 h-4" />
                             </button>
                             <div className="flex space-x-1">
                                 {Array.from({ length: variationCount }).map((_, idx) => (
                                     <button
                                         key={idx}
                                         onClick={() => onVariationSelect(idx)}
                                         className={`w-1.5 h-1.5 rounded-full transition-all ${idx === activeVariationIndex ? 'bg-indigo-600 w-3' : 'bg-gray-200 hover:bg-gray-300'}`}
                                     />
                                 ))}
                             </div>
                             <button onClick={onNext} disabled={!canGoNext} className="p-1 text-gray-300 hover:text-indigo-600 disabled:opacity-20 transition-colors">
                                 <ArrowRight className="w-4 h-4" />
                             </button>
                         </div>
                     </div>
                )}
            </div>

            {/* Bottom Row: The Learning Objective (The "Question Context") */}
            {srsData.objective && (
                <h3 className="text-lg font-bold text-gray-900 leading-tight">
                    {srsData.objective}
                </h3>
            )}
        </div>
    );
};

const SmartBlockShell: React.FC<SmartBlockShellProps> = ({
    children,
    id,
    type,
    srsData,
    initialState,
    hints = [],
    explanation,
    explanationSteps,
    onVerify,
    onCommitSRS,
    onPersistState,
    variationCount = 0,
    activeVariationIndex = 0,
    allVariationsCompleted = false,
    resultsSummary = [],
    onVariationChange,
    onResetBlock
}) => {
    
    const { virtualNow } = useTime();
    
    const [status, setStatus] = useState<BlockStatus>(initialState?.status || 'idle');
    const [attempts, setAttempts] = useState(initialState?.attempts || 0);
    const [isInteractionDirty, setIsInteractionDirty] = useState(false);
    
    const [hintIndex, setHintIndex] = useState(-1);
    const [showExplanationModal, setShowExplanationModal] = useState(false);
    const [nextDueDisplay, setNextDueDisplay] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'exercise' | 'summary'>('exercise');

    // HEURISTIC FSRS: Time Tracking
    const startTimeRef = useRef<number>(Date.now());
    
    // Reset Logic
    useEffect(() => {
        setStatus(initialState?.status || 'idle');
        setAttempts(initialState?.attempts || 0);
        setIsInteractionDirty(false);
        setHintIndex(-1);
        setShowExplanationModal(false);
        setViewMode('exercise');
        updateNextDueDisplay(srsData?.nextReviewDue);
        
        // Reset Timer on load
        startTimeRef.current = Date.now();
    }, [id, initialState]); 

    const handleInteract = () => {
        if (status === 'idle' || status === 'incorrect') {
            setIsInteractionDirty(true);
            if (status === 'incorrect') setStatus('idle'); 
        }
    };

    const persistCurrentState = (newStatus: BlockStatus, newAttempts: number) => {
        if (onPersistState) {
            onPersistState({
                status: newStatus,
                attempts: newAttempts,
                lastInteractionAt: Date.now()
            });
        }
    };

    const handleCheck = async () => {
        if (!isInteractionDirty && status !== 'idle') return;

        const result = await onVerify();
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        // Calculate Duration
        const timeSpent = Date.now() - startTimeRef.current;

        if (result.isCorrect) {
            setStatus('correct');
            persistCurrentState('correct', newAttempts);
            if (onCommitSRS) {
                // PASS META-DATA for Heuristic Grading
                const newSRS = processSessionCompletion(srsData, true, newAttempts, virtualNow, {
                    timeSpent,
                    hintsUsed: hintIndex + 1,
                    blockType: type
                });
                onCommitSRS(newSRS);
                updateNextDueDisplay(newSRS.nextReviewDue);
            }
        } else {
            setStatus('incorrect');
            persistCurrentState('incorrect', newAttempts);
            setIsInteractionDirty(false); 
        }
    };

    const handleSeeAnswer = () => {
        setStatus('revealed');
        persistCurrentState('revealed', attempts);
        
        const timeSpent = Date.now() - startTimeRef.current;

        if (onCommitSRS) {
            // Revealed is considered incorrect for SRS purposes, but we still track context
            const newSRS = processSessionCompletion(srsData, false, attempts, virtualNow, {
                timeSpent,
                hintsUsed: hints.length, // Max penalty
                blockType: type
            });
            onCommitSRS(newSRS);
            updateNextDueDisplay(newSRS.nextReviewDue);
        }
    };

    const handleContinue = () => {
        setShowExplanationModal(false);
        if (variationCount > 0 && activeVariationIndex !== undefined && activeVariationIndex < variationCount - 1) {
            if (onVariationChange) onVariationChange(activeVariationIndex + 1);
        } else {
            setViewMode('summary');
        }
    };

    const updateNextDueDisplay = (dueTimestamp?: number) => {
        if (!dueTimestamp) {
             setNextDueDisplay(null);
             return;
        }
        const date = new Date(dueTimestamp);
        const now = new Date(virtualNow);
        const diffTime = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
        
        let dueText = "";
        if (diffDays <= 0) dueText = "Soon"; 
        else if (diffDays === 1) dueText = "Tomorrow";
        else dueText = `${diffDays}d`;
        setNextDueDisplay(dueText);
    };

    const canGoPrev = activeVariationIndex !== undefined && activeVariationIndex > 0;
    const canGoNext = activeVariationIndex !== undefined && activeVariationIndex < variationCount - 1;

    const steps = (explanationSteps && explanationSteps.length > 0) 
        ? explanationSteps 
        : (explanation 
            ? [{ title: "Analysis", content: explanation }] 
            : [{ title: "Solution", content: "Review the solution above to understand the concept." }]);

    if (viewMode === 'summary') {
         // UI FIX: Construct an effective summary by merging props with local state
         const effectiveSummary = resultsSummary.map((res, idx) => {
             if (idx === activeVariationIndex) {
                 if (res.status === 'idle' && (status === 'correct' || status === 'revealed')) {
                     return { ...res, status: status };
                 }
             }
             return res;
         });

         const completedCount = effectiveSummary.filter(r => r.status === 'correct' || r.status === 'revealed').length;

         return (
             <div className="my-10 max-w-2xl mx-auto">
                 <div className="bg-white rounded-2xl border-2 border-indigo-100 shadow-xl overflow-hidden animate-in zoom-in-95 duration-300">
                    <div className="bg-indigo-600 p-8 text-center text-white">
                        <div className="w-16 h-16 bg-white text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <Award className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Block Completed!</h2>
                        <p className="text-indigo-100">You've mastered this concept set.</p>
                    </div>
                    <div className="p-8">
                        <div className="mb-8">
                             <h4 className="text-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Exercise Breakdown</h4>
                             <div className="flex flex-wrap justify-center gap-3">
                                {effectiveSummary.map((res, idx) => (
                                    <div key={idx} className="flex flex-col items-center">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${res.status === 'correct' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : res.status === 'revealed' ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-gray-50 border-gray-200 text-gray-300'}`}>
                                            {res.status === 'correct' && <Check className="w-5 h-5" />}
                                            {res.status === 'revealed' && <X className="w-5 h-5" />}
                                            {(res.status === 'idle' || res.status === 'incorrect') && <span className="text-xs font-bold">{idx + 1}</span>}
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                        <div className="w-full h-px bg-gray-100 mb-8"></div>
                        <div className="flex items-center justify-center space-x-8 mb-8">
                             <div className="text-center">
                                 <div className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-1">Set Progress</div>
                                 <div className="text-emerald-600 font-bold text-xl flex items-center justify-center space-x-1">
                                     <Check className="w-5 h-5" />
                                     <span>{completedCount} / {variationCount}</span>
                                 </div>
                             </div>
                             <div className="w-px h-12 bg-gray-100"></div>
                             <div className="text-center">
                                 <div className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-1">Next Review</div>
                                 <div className="text-indigo-600 font-bold text-xl flex items-center justify-center space-x-1">
                                     <Clock className="w-5 h-5" />
                                     <span>{nextDueDisplay || 'Soon'}</span>
                                 </div>
                             </div>
                        </div>
                        <div className="flex flex-col space-y-3">
                             <button onClick={onResetBlock} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center space-x-2">
                                <RotateCcw className="w-4 h-4" />
                                <span>Practice Again (Reset)</span>
                             </button>
                             <button onClick={() => setViewMode('exercise')} className="w-full bg-white border border-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2">
                                <ArrowLeft className="w-4 h-4" />
                                <span>Review Exercises</span>
                             </button>
                        </div>
                    </div>
                 </div>
             </div>
         );
    }

    const renderFooter = () => {
        if (status === 'idle') {
            return (
                <div className="flex justify-end p-5 bg-gray-50/50 border-t border-gray-100 rounded-b-2xl">
                    <button onClick={handleCheck} disabled={!isInteractionDirty} className={`px-8 py-3 rounded-full font-bold text-sm transition-all shadow-md transform active:scale-95 ${isInteractionDirty ? 'bg-black text-white hover:bg-gray-800 hover:shadow-lg' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                        Check Answer
                    </button>
                </div>
            );
        }
        if (status === 'incorrect') {
            return (
                <div className="p-5 bg-rose-50 border-t border-rose-100 rounded-b-2xl animate-in slide-in-from-bottom-2">
                    <div className="flex items-start space-x-3 mb-4">
                        <div className="p-1 bg-rose-200 rounded-full text-rose-700 mt-0.5"><X className="w-5 h-5" /></div>
                        <div><h4 className="font-bold text-rose-900">Not quite right</h4><p className="text-sm text-rose-700 mt-1">Give it another shot, or view the answer.</p></div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                         <button onClick={handleSeeAnswer} className="text-rose-800 text-sm font-bold hover:bg-rose-100 px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"><HelpCircle className="w-4 h-4" /><span>See Answer</span></button>
                        <button onClick={() => setStatus('idle')} className="bg-rose-600 text-white px-6 py-2.5 rounded-full font-bold shadow-lg hover:bg-rose-700 transition-all active:scale-95 text-sm">Try Again</button>
                    </div>
                </div>
            );
        }
        if (status === 'correct') {
            const isLast = activeVariationIndex !== undefined && activeVariationIndex >= variationCount - 1;
            return (
                <div className="p-5 bg-emerald-50 border-t border-emerald-100 rounded-b-2xl animate-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center space-x-3"><div className="p-1.5 bg-emerald-200 rounded-full text-emerald-800"><Check className="w-6 h-6" /></div><div><h4 className="font-bold text-emerald-900 text-lg">Correct!</h4></div></div>
                    </div>
                    <div className="flex items-center gap-3">
                         <button onClick={() => setShowExplanationModal(true)} className="flex-1 bg-white border-2 border-emerald-100 text-emerald-700 font-bold py-3 rounded-xl hover:bg-emerald-50 transition-colors flex items-center justify-center space-x-2 text-sm"><BookOpen className="w-4 h-4" /><span>Why?</span></button>
                        <button onClick={handleContinue} className={`flex-[2] text-white py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center space-x-2 text-sm ${isLast ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'}`}><span>{isLast ? 'View Results' : 'Next Exercise'}</span><ArrowRight className="w-4 h-4" /></button>
                    </div>
                </div>
            );
        }
        if (status === 'revealed') {
            const isLast = activeVariationIndex !== undefined && activeVariationIndex >= variationCount - 1;
            return (
                <div className="p-5 bg-gray-100 border-t border-gray-200 rounded-b-2xl animate-in slide-in-from-bottom-2">
                    <div className="flex items-start space-x-3 mb-4">
                        <div className="p-1.5 bg-gray-300 rounded-full text-gray-700 mt-0.5"><ArrowRight className="w-5 h-5" /></div>
                        <div><h4 className="font-bold text-gray-900">Here's the answer</h4><p className="text-sm text-gray-600 mt-1">Study the solution above.</p></div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setShowExplanationModal(true)} className="flex-[2] bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-colors shadow-lg flex items-center justify-center space-x-2 text-sm"><BookOpen className="w-4 h-4" /><span>Why?</span></button>
                        <button onClick={handleContinue} className="flex-1 bg-white border border-gray-300 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center text-sm">{isLast ? 'Results' : 'Next'}</button>
                    </div>
                </div>
            );
        }
    };

    return (
        <div className="my-10 max-w-2xl mx-auto">
            {/* --- Main Card with Internal Header --- */}
            <div className={`
                relative bg-white rounded-2xl transition-all duration-500
                ${status === 'incorrect' ? 'ring-2 ring-rose-100 shadow-xl shadow-rose-50' : 
                  status === 'correct' ? 'ring-2 ring-emerald-100 shadow-xl shadow-emerald-50' : 
                  'border border-gray-200 shadow-sm hover:shadow-md'}
            `}>
                
                {/* 1. The Standardized Header */}
                <BlockHeader 
                    srsData={srsData} 
                    variationCount={variationCount}
                    activeVariationIndex={activeVariationIndex}
                    canGoPrev={canGoPrev}
                    canGoNext={canGoNext}
                    onPrev={() => onVariationChange && onVariationChange(activeVariationIndex - 1)}
                    onNext={() => onVariationChange && onVariationChange(activeVariationIndex + 1)}
                    onVariationSelect={(idx) => onVariationChange && onVariationChange(idx)}
                    allVariationsCompleted={allVariationsCompleted}
                    onViewSummary={() => setViewMode('summary')}
                />

                <div className="absolute top-24 right-4 z-10 flex space-x-2">
                    {hints.length > 0 && status !== 'correct' && status !== 'revealed' && (
                        <button 
                           onClick={() => setHintIndex(prev => Math.min(prev + 1, hints.length - 1))}
                           disabled={hintIndex >= hints.length - 1}
                           className={`flex items-center space-x-1 text-xs font-bold px-3 py-1.5 rounded-full transition-all shadow-sm border ${hintIndex >= 0 ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-white border-gray-200 text-gray-400 hover:text-yellow-600 hover:border-yellow-200'}`}
                        >
                            <Lightbulb className={`w-3.5 h-3.5 ${hintIndex >= 0 ? 'fill-yellow-400 text-yellow-500' : ''}`} />
                            <span>Hint</span>
                        </button>
                    )}
                </div>

                {/* 2. Content Body */}
                <div className="p-8 pt-6">
                    {hintIndex >= 0 && (
                        <div className="mb-6 p-4 bg-yellow-50 rounded-xl border border-yellow-100 text-yellow-800 text-sm flex items-start animate-in fade-in slide-in-from-top-1">
                            <Lightbulb className="w-4 h-4 mr-3 mt-0.5 flex-shrink-0 text-yellow-500 fill-yellow-500" />
                            <div className="italic">
                                <span className="font-bold mr-1">Hint {hintIndex + 1}:</span>
                                <MarkdownRenderer content={hints[hintIndex]} />
                            </div>
                        </div>
                    )}

                    {children({ 
                        status, 
                        disabled: status === 'correct' || status === 'revealed',
                        showSolution: status === 'revealed',
                        onInteract: handleInteract 
                    })}
                </div>

                {/* 3. Footer */}
                {renderFooter()}

                {/* 4. Explanation Modal */}
                {showExplanationModal && (
                    <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm rounded-2xl flex flex-col animate-in fade-in duration-200">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white/50 rounded-t-2xl">
                            <h3 className="font-bold text-gray-900 flex items-center space-x-2"><BookOpen className="w-5 h-5 text-indigo-600" /><span>Why is this correct?</span></h3>
                            <button onClick={() => setShowExplanationModal(false)} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><X className="w-6 h-6 text-gray-400" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 space-y-8">
                            {steps.map((step, idx) => (
                                <div key={idx} className="relative">
                                    <h4 className="font-bold text-gray-900 mb-2 text-sm uppercase tracking-wide flex items-center"><span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs mr-2">{idx + 1}</span>{step.title}</h4>
                                    <div className="text-gray-700 leading-relaxed pl-8"><MarkdownRenderer content={step.content} /></div>
                                </div>
                            ))}
                        </div>
                        <div className="p-5 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
                            <button onClick={() => { setShowExplanationModal(false); if (variationCount > 0 && activeVariationIndex !== undefined && activeVariationIndex < variationCount - 1) { if (onVariationChange) onVariationChange(activeVariationIndex + 1); } else { setViewMode('summary'); } }} className="w-full bg-black text-white font-bold py-3.5 rounded-xl hover:bg-gray-800 transition-colors shadow-lg">Got it</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SmartBlockShell;
