
import React, { useState } from 'react';
import { X, Copy, Check, ArrowRight, Sparkles, Lock, Layers, Calendar } from 'lucide-react';
import { SystemContextLoader } from '../services/aiPrompts';
import { db } from '../db';
import { Page, BlockType } from '../types';
import { getWeeklyStatus } from '../utils/learning';
import { useTime } from '../contexts/TimeContext';

interface SynthesisModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPageCreated: (pageId: string) => void;
    stats: {
        weeklyReviewedCount: number;
        weeklyMasteryAvg: number;
        topConcept: string;
        weeklyConcepts: string[];
    };
}

type Step = 'context' | 'blueprint' | 'ingest';

export const SynthesisModal: React.FC<SynthesisModalProps> = ({ isOpen, onClose, onPageCreated, stats }) => {
    const { virtualNow } = useTime();
    const [step, setStep] = useState<Step>('context');
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [jsonInput, setJsonInput] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const { isUnlocked, message: lockMessage } = getWeeklyStatus(virtualNow, stats.weeklyReviewedCount);

    const handleGeneratePrompt = () => {
        const prompt = SystemContextLoader.generateSynthesisPrompt(
            { totalReviewed: stats.weeklyReviewedCount, topConcept: stats.topConcept, masteryAvg: stats.weeklyMasteryAvg },
            stats.weeklyConcepts
        );
        setGeneratedPrompt(prompt);
        setStep('blueprint');
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedPrompt);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleIngest = async () => {
        try {
            setError(null);
            let parsed: any;
            try {
                const jsonMatch = jsonInput.match(/\{[\s\S]*\}/);
                const stringToParse = jsonMatch ? jsonMatch[0] : jsonInput;
                parsed = JSON.parse(stringToParse);
            } catch (e) {
                throw new Error("Invalid JSON format.");
            }

            const newPage: Page = {
                id: `synthesis-${Date.now()}`,
                title: parsed.title || `Weekly Reflection`,
                tags: [...(parsed.tags || []), 'Reflection', 'Weekly'],
                createdAt: virtualNow,
                updatedAt: virtualNow,
                blocks: parsed.blocks.map((b: any) => ({
                    ...b,
                    id: b.id || crypto.randomUUID(),
                    type: Object.values(BlockType).includes(b.type) ? b.type : BlockType.UNKNOWN
                }))
            };

            await db.pages.add(newPage);
            onPageCreated(newPage.id);
            onClose();
        } catch (e) {
            setError((e as Error).message);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-indigo-50">
                    <div className="flex items-center space-x-2 text-indigo-800">
                        <Sparkles className="w-5 h-5" />
                        <h2 className="font-bold text-lg">Meta-Cognitive Studio</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    
                    {step === 'context' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            <div className="text-center mb-6">
                                <h3 className="text-xl font-bold text-gray-900">Weekly Reflection</h3>
                                <p className="text-gray-500 text-sm mt-1">Consolidate your learning by connecting the dots.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
                                    <div className="text-2xl font-bold text-indigo-600">{stats.weeklyReviewedCount}</div>
                                    <div className="text-xs uppercase text-gray-400 font-bold">Blocks Reviewed</div>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
                                    <div className="text-2xl font-bold text-emerald-600">{stats.weeklyMasteryAvg}%</div>
                                    <div className="text-xs uppercase text-gray-400 font-bold">Avg Mastery</div>
                                </div>
                            </div>

                            {!isUnlocked ? (
                                <div className="bg-gray-100 border-2 border-gray-200 border-dashed rounded-xl p-8 text-center flex flex-col items-center">
                                    <div className="p-3 bg-gray-200 rounded-full text-gray-500 mb-3">
                                        <Lock className="w-6 h-6" />
                                    </div>
                                    <h4 className="font-bold text-gray-700">Reflection Locked</h4>
                                    <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
                                        {lockMessage}
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                                    <h4 className="font-bold text-lg mb-2 flex items-center gap-2">
                                        <Layers className="w-5 h-5" />
                                        Ready to Synthesize
                                    </h4>
                                    <p className="text-indigo-100 text-sm mb-4">
                                        The AI will analyze your activity on <strong>{stats.topConcept}</strong> and {stats.weeklyConcepts.length - 1} other topics to create a custom "Big Picture" lesson.
                                    </p>
                                    <button 
                                        onClick={handleGeneratePrompt}
                                        className="w-full bg-white text-indigo-600 font-bold py-3 rounded-lg hover:bg-indigo-50 transition-colors shadow-md flex items-center justify-center gap-2"
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        <span>Generate Blueprint</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'blueprint' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-gray-800">Review Blueprint</h3>
                                <div className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold">Context Aware</div>
                            </div>
                            <div className="relative">
                                <textarea 
                                    readOnly
                                    value={generatedPrompt}
                                    className="w-full h-64 p-4 font-mono text-xs bg-gray-900 text-gray-300 rounded-lg resize-none focus:outline-none"
                                />
                                <button 
                                    onClick={handleCopy}
                                    className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-sm px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1 transition-all backdrop-blur-md"
                                >
                                    {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                    <span>{isCopied ? 'Copied' : 'Copy'}</span>
                                </button>
                            </div>
                            <div className="flex justify-between">
                                <button onClick={() => setStep('context')} className="text-gray-500 text-sm hover:text-gray-900">Back</button>
                                <button 
                                    onClick={() => setStep('ingest')}
                                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 flex items-center space-x-2"
                                >
                                    <span>Proceed to Build</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'ingest' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                            <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                                <Layers className="w-4 h-4" />
                                <span>Paste AI Response</span>
                            </div>
                            <textarea 
                                autoFocus
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                placeholder='{ "title": "...", "blocks": [...] }'
                                className={`w-full h-64 p-4 font-mono text-xs border-2 rounded-lg resize-none focus:outline-none transition-all bg-white text-gray-900 ${error ? 'border-rose-300 focus:border-rose-500' : 'border-gray-200 focus:border-indigo-500'}`}
                            />
                            {error && <div className="text-rose-600 text-xs">{error}</div>}
                            <div className="flex justify-between pt-2">
                                <button onClick={() => setStep('blueprint')} className="text-gray-500 text-sm hover:text-gray-900">Back</button>
                                <button 
                                    onClick={handleIngest}
                                    disabled={!jsonInput.trim()}
                                    className="bg-emerald-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50 shadow-lg shadow-emerald-200"
                                >
                                    Create Reflection Page
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
