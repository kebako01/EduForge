
import React, { useState, useMemo } from 'react';
import { Lock, Unlock, Sparkles, Copy, Check, ArrowRight, Brain, AlertTriangle, Lightbulb, Eye } from 'lucide-react';
import { SystemContextLoader } from '../services/aiPrompts';
import { Block, BlockType } from '../types';

interface PageRetrievalGateProps {
    pageTitle: string;
    currentChapter: number;
    blocks: Block[]; // To generate context summary
    onEvolutionComplete: (newBlocks: Block[], userRecall: string) => void;
}

type GateStep = 'recall' | 'blueprint' | 'ingest';

export const PageRetrievalGate: React.FC<PageRetrievalGateProps> = ({ pageTitle, currentChapter, blocks, onEvolutionComplete }) => {
    const [step, setStep] = useState<GateStep>('recall');
    const [recallText, setRecallText] = useState('');
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [jsonInput, setJsonInput] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showHints, setShowHints] = useState(false);

    // Extract high-level topics for context
    const topics = useMemo(() => {
        const t = new Set<string>();
        blocks.forEach(b => {
            if (b.srs?.name) t.add(b.srs.name);
            if (b.type === 'text' && (b as any).variant === 'heading') {
                 t.add((b as any).content.replace(/[*_#]/g, '').trim());
            }
        });
        return Array.from(t).slice(0, 6);
    }, [blocks]);

    // Helper: Extract keywords from blocks to feed AI context (Internal use)
    const getBlockSummaries = () => {
        return blocks
            .map(b => b.srs?.name || (b.type === 'text' ? (b as any).content.substring(0, 50) : b.type))
            .filter(Boolean)
            .slice(0, 20); // Limit context size
    };

    const handleUnlock = () => {
        if (recallText.length < 10) return;
        
        const summary = getBlockSummaries();
        const prompt = SystemContextLoader.generateChapterEvolutionPrompt(pageTitle, currentChapter, summary, recallText);
        
        setGeneratedPrompt(prompt);
        setStep('blueprint');
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedPrompt);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleIngest = () => {
        try {
            setError(null);
            const jsonMatch = jsonInput.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (!jsonMatch) throw new Error("Invalid JSON format.");
            
            const parsed = JSON.parse(jsonMatch[0]);
            
            // Normalize input (could be { blocks: [] } or just [])
            const newBlocksRaw = Array.isArray(parsed) ? parsed : (parsed.blocks || [parsed]);
            
            if (!Array.isArray(newBlocksRaw) || newBlocksRaw.length === 0) {
                throw new Error("JSON contains no blocks.");
            }

            // Sanitize
            const cleanBlocks: Block[] = newBlocksRaw.map((b: any) => ({
                ...b,
                id: b.id || `evo-${crypto.randomUUID()}`,
                type: Object.values(BlockType).includes(b.type) ? b.type : BlockType.TEXT,
                srs: b.srs ? {
                    ...b.srs,
                    entityId: b.srs.entityId || `concept.${crypto.randomUUID()}`,
                    repetitionCount: 0,
                    stability: 0,
                    masteryScore: 0
                } : undefined
            }));

            onEvolutionComplete(cleanBlocks, recallText);

        } catch (e) {
            setError((e as Error).message);
        }
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[80vh] p-4 animate-in fade-in duration-500">
            <div className="max-w-xl w-full bg-white rounded-3xl shadow-2xl border border-indigo-100 overflow-hidden relative">
                
                {/* Visual Header */}
                <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-indigo-900 to-slate-900 opacity-80"></div>
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20">
                            <Lock className="w-8 h-8 text-indigo-300" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-1">Knowledge Gate</h2>
                        <p className="text-indigo-200 text-sm">Chapter {currentChapter} Complete. Evolution Required.</p>
                    </div>
                </div>

                {/* Step 1: Active Recall (The Tax) */}
                {step === 'recall' && (
                    <div className="p-8">
                        <div className="text-center mb-6">
                            <h3 className="font-bold text-gray-800 text-lg mb-2">Retrieve & Strengthen</h3>
                            <p className="text-gray-500 text-sm mb-4">
                                To unlock the next chapter, recall the core concepts from this page.
                            </p>
                            
                            {/* Context Toggle */}
                            <button 
                                onClick={() => setShowHints(!showHints)}
                                className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors"
                            >
                                {showHints ? <Eye className="w-3 h-3" /> : <Lightbulb className="w-3 h-3" />}
                                <span>{showHints ? "Hide Topics" : "Show Key Topics"}</span>
                            </button>

                            {/* Hints Display */}
                            {showHints && topics.length > 0 && (
                                <div className="mt-4 flex flex-wrap justify-center gap-2 animate-in fade-in slide-in-from-top-2">
                                    {topics.map((topic, i) => (
                                        <span key={i} className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 px-2 py-1 rounded border border-gray-200">
                                            {topic}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <textarea
                            value={recallText}
                            onChange={(e) => setRecallText(e.target.value)}
                            placeholder="I remember that..."
                            className="w-full h-40 p-4 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none resize-none transition-all bg-gray-50 text-gray-800 mb-2"
                            autoFocus
                        />
                        <div className="flex justify-between items-center mb-6">
                            <span className={`text-xs font-bold ${recallText.length < 50 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                {recallText.length} characters (min 50)
                            </span>
                        </div>

                        <button
                            onClick={handleUnlock}
                            disabled={recallText.length < 50}
                            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 group"
                        >
                            <Brain className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            <span>Submit & Evolve</span>
                        </button>
                    </div>
                )}

                {/* Step 2: Blueprint Transport */}
                {step === 'blueprint' && (
                    <div className="p-8 animate-in slide-in-from-right-8">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-indigo-500" />
                                Evolution Blueprint
                            </h3>
                            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold">Ready</span>
                        </div>

                        <div className="relative mb-6">
                            <textarea 
                                readOnly
                                value={generatedPrompt}
                                className="w-full h-40 p-4 font-mono text-xs bg-slate-800 text-slate-300 rounded-xl resize-none focus:outline-none"
                            />
                            <button 
                                onClick={handleCopy}
                                className="absolute bottom-3 right-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all"
                            >
                                {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                <span>{isCopied ? 'Copied' : 'Copy'}</span>
                            </button>
                        </div>

                        <button 
                            onClick={() => setStep('ingest')}
                            className="w-full bg-white border-2 border-indigo-100 text-indigo-700 font-bold py-3 rounded-xl hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                        >
                            <span>I have the new Chapter</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Step 3: Ingest */}
                {step === 'ingest' && (
                    <div className="p-8 animate-in slide-in-from-right-8">
                        <div className="text-center mb-4">
                            <h3 className="font-bold text-gray-800">Finalize Evolution</h3>
                            <p className="text-xs text-gray-400">Paste the AI response below.</p>
                        </div>

                        <textarea 
                            autoFocus
                            value={jsonInput}
                            onChange={(e) => setJsonInput(e.target.value)}
                            placeholder='{ "blocks": [ ... ] }'
                            className={`w-full h-40 p-4 font-mono text-xs border-2 rounded-xl resize-none focus:outline-none transition-all bg-white text-gray-900 mb-4 ${error ? 'border-rose-300 focus:border-rose-500' : 'border-gray-200 focus:border-indigo-500'}`}
                        />
                        
                        {error && (
                            <div className="mb-4 bg-rose-50 border border-rose-100 text-rose-600 p-3 rounded-lg text-xs flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => setStep('blueprint')} className="px-4 py-3 rounded-xl font-bold text-gray-400 hover:text-gray-600 transition-colors">Back</button>
                            <button 
                                onClick={handleIngest}
                                disabled={!jsonInput.trim()}
                                className="flex-1 bg-emerald-500 text-white font-bold py-3 rounded-xl hover:bg-emerald-600 transition-all disabled:opacity-50 shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                            >
                                <Unlock className="w-4 h-4" />
                                <span>Unlock Chapter {currentChapter + 1}</span>
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
