
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    TextBlock, 
    MCQBlock, 
    MathBlock, 
    InputBlock, 
    CanvasBlock,
    SortBlock, 
    MatchBlock,
    HabitBlock,
    TaskBlock,
    SocraticBlock,
    SocraticCriteria,
    CodeBlock,
    DiagramBlock,
    ChartBlock,
    CourseMapBlock,
    Block,
    SRSData,
    BlockState
} from '../types';
import SmartBlockShell from './SmartBlockShell';
import { MarkdownRenderer } from '../utils/markdown';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { generateAdaptiveSession, aggregateConceptHealth, isSameDay, calculateStreak } from '../utils/learning';
import { ArrowUp, ArrowDown, Link as LinkIcon, X, PenTool, Check, Flame, Calendar, CheckSquare, Tag, Split, Repeat, Calculator, Terminal, Play, PlusCircle, Trash2, ArrowRightCircle, Box, Bot, Sparkles, MessageSquare, AlertCircle, CheckCircle2, Copy, BarChart3, Search, Atom, Code as CodeIcon, Book, Lock, Plus, Layers } from 'lucide-react';
import { useTime } from '../contexts/TimeContext';

// Import External Libs (Resolved via ImportMap in index.html)
import mermaid from 'mermaid';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Chart.js imports (Direct usage for React 19 stability)
import Chart from 'chart.js/auto';

// --- HELPER FUNCTIONS ---

function useAdaptiveSession<T extends Block>(rootBlock: T) {
    // FIX: Depend on the whole rootBlock object. Dexie returns a fresh object reference
    // on update, so this correctly triggers a regeneration of the plan when SRS/State changes.
    const plan = useMemo(() => {
        return generateAdaptiveSession(rootBlock, 5); 
    }, [rootBlock]);

    const [activeIndex, setActiveIndex] = useState(0);
    const session = plan.queue;
    const currentItem = session[activeIndex] || rootBlock;
    const allCompleted = session.every(item => 
        item.state?.status === 'correct' || item.state?.status === 'revealed'
    );
    const resultsSummary = session.map(item => ({
        id: item.id,
        status: item.state?.status || 'idle',
        attempts: item.state?.attempts || 0
    }));
    return { currentItem, activeIndex, setActiveIndex, totalCount: session.length, allCompleted, session, resultsSummary, plan };
}

const updateVariationSRS = async (pageId: string | undefined, rootBlockId: string, variationId: string, newSRS: SRSData) => {
    if (!pageId) return;
    await (db as any).transaction('rw', db.pages, async () => {
        const page = await db.pages.get(pageId);
        if (!page) return;
        const newBlocks = [...page.blocks] as Block[];
        const blockIndex = newBlocks.findIndex(b => b.id === rootBlockId);
        if (blockIndex > -1) {
            const rootBlock = newBlocks[blockIndex];
            let updatedRoot = { ...rootBlock };
            const updateTarget = (b: Block): Block => {
                if (b.id === variationId) return { ...b, srs: newSRS };
                return b;
            };
            if (updatedRoot.id === variationId) updatedRoot.srs = newSRS;
            else if (updatedRoot.variations) updatedRoot.variations = updatedRoot.variations.map(updateTarget);
            
            const allVars = updatedRoot.variations || [];
            const healthStats = aggregateConceptHealth(updatedRoot, allVars);
            updatedRoot.srs = { ...updatedRoot.srs!, level: healthStats.level, masteryScore: healthStats.masteryScore, nextReviewDue: healthStats.nextReviewDue, stability: healthStats.stability };
            newBlocks[blockIndex] = updatedRoot;
            await db.pages.update(pageId, { blocks: newBlocks } as any);
        }
    });
};

const updateVariationState = async (pageId: string | undefined, rootBlockId: string, targetVariationId: string, newState: Partial<BlockState>) => {
    if (!pageId) return;
    await (db as any).transaction('rw', db.pages, async () => {
        const page = await db.pages.get(pageId);
        if (!page) return;
        const newBlocks = [...page.blocks] as Block[];
        const blockIndex = newBlocks.findIndex(b => b.id === rootBlockId);
        if (blockIndex > -1) {
            const root = newBlocks[blockIndex];
            const updateState = (b: Block): Block => {
                if (b.id === targetVariationId) return { ...b, state: { ...b.state, ...newState } as BlockState };
                return b;
            };
            let updatedBlock = updateState(root);
            if (updatedBlock.variations) updatedBlock.variations = updatedBlock.variations.map(updateState);
            newBlocks[blockIndex] = updatedBlock;
            await db.pages.update(pageId, { blocks: newBlocks } as any);
        }
    });
};

const updateHabitData = async (pageId: string | undefined, blockId: string, streak: number, history: number[]) => {
    if (!pageId) return;
    await (db as any).transaction('rw', db.pages, async () => {
        const page = await db.pages.get(pageId);
        if (!page) return;
        const newBlocks = [...page.blocks] as Block[];
        const blockIndex = newBlocks.findIndex(b => b.id === blockId);
        if (blockIndex > -1) {
            const block = newBlocks[blockIndex] as HabitBlock;
            newBlocks[blockIndex] = { ...block, streak, history };
            await db.pages.update(pageId, { blocks: newBlocks } as any);
        }
    });
}

const toggleTaskCompletion = async (pageId: string | undefined, blockId: string, isCompleted: boolean) => {
    if (!pageId) return;
    await (db as any).transaction('rw', db.pages, async () => {
        const page = await db.pages.get(pageId);
        if (!page) return;
        const newBlocks = [...page.blocks] as Block[];
        const blockIndex = newBlocks.findIndex(b => b.id === blockId);
        if (blockIndex > -1) {
            const block = newBlocks[blockIndex] as TaskBlock;
            newBlocks[blockIndex] = { ...block, isCompleted };
            await db.pages.update(pageId, { blocks: newBlocks } as any);
        }
    });
}

const resetBlockState = async (pageId: string | undefined, rootBlockId: string) => {
    if (!pageId) return;
    await (db as any).transaction('rw', db.pages, async () => {
        const page = await db.pages.get(pageId);
        if (!page) return;
        const newBlocks = [...page.blocks] as Block[];
        const blockIndex = newBlocks.findIndex(b => b.id === rootBlockId);
        if (blockIndex > -1) {
            const root = newBlocks[blockIndex];
            const cleanState = (b: Block): Block => ({ ...b, state: undefined });
            const updatedBlock = cleanState(root);
            if (updatedBlock.variations) updatedBlock.variations = updatedBlock.variations.map(cleanState);
            newBlocks[blockIndex] = updatedBlock;
            await db.pages.update(pageId, { blocks: newBlocks } as any);
        }
    });
};

// --- RENDERERS ---

// 1. Text Block
export const TextBlockRenderer: React.FC<{ data: TextBlock }> = ({ data }) => {
    const styles = {
        paragraph: "text-gray-800 leading-relaxed mb-4 text-base",
        heading: "text-2xl font-bold text-gray-900 mt-8 mb-4 font-display tracking-tight",
        quote: "border-l-4 border-indigo-500 pl-4 italic text-gray-600 my-6 py-1 bg-gray-50/50 rounded-r",
        callout: "bg-indigo-50/50 border border-indigo-100 rounded-lg p-4 text-indigo-900 my-4 flex gap-3 shadow-sm"
    };

    return (
        <div className={styles[data.variant] || styles.paragraph}>
            <MarkdownRenderer content={data.content} />
        </div>
    );
};

// 2. Math Block
export const MathBlockRenderer: React.FC<{ data: MathBlock }> = ({ data }) => {
    return (
        <div className="my-6 p-6 bg-white border border-gray-200 rounded-xl shadow-sm text-center">
             <div className="text-xl font-mono text-gray-900 mb-2 overflow-x-auto">
                <MarkdownRenderer content={`$$${data.latex}$$`} />
             </div>
             {data.description && (
                 <p className="text-sm text-gray-500 italic mt-2"><MarkdownRenderer content={data.description} /></p>
             )}
        </div>
    );
};

// 3. MCQ Block
export const MCQBlockRenderer: React.FC<{ data: MCQBlock; pageId?: string }> = ({ data, pageId }) => {
    const { currentItem, activeIndex, setActiveIndex, totalCount, allCompleted, resultsSummary } = useAdaptiveSession(data);
    const block = currentItem as MCQBlock;
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        if (block.state?.selection) setSelectedId(block.state.selection);
        else setSelectedId(null);
    }, [block.id, block.state]);

    return (
        <SmartBlockShell
            id={block.id}
            type={block.type}
            srsData={block.srs || data.srs}
            initialState={block.state}
            hints={block.hints}
            explanation={block.explanation}
            explanationSteps={block.explanationSteps}
            variationCount={totalCount}
            activeVariationIndex={activeIndex}
            allVariationsCompleted={allCompleted}
            resultsSummary={resultsSummary}
            onVariationChange={setActiveIndex}
            onResetBlock={() => {
                resetBlockState(pageId, data.id);
                setActiveIndex(0);
            }}
            onVerify={async () => {
                const opt = block.options.find(o => o.id === selectedId);
                return { isCorrect: !!opt?.isCorrect, feedback: opt?.feedback };
            }}
            onCommitSRS={(newSRS) => updateVariationSRS(pageId, data.id, block.id, newSRS)}
            onPersistState={(partialState) => updateVariationState(pageId, data.id, block.id, { ...partialState, selection: selectedId || undefined })}
        >
            {({ status, disabled, onInteract }) => (
                <div className="space-y-4">
                    <h3 className="text-xl font-medium text-gray-900 leading-relaxed font-display">
                        <MarkdownRenderer content={block.question} />
                    </h3>
                    <div className="space-y-2">
                        {block.options.map((opt) => {
                            const isSelected = selectedId === opt.id;
                            let style = "border-gray-200 hover:border-indigo-300 hover:bg-gray-50 bg-white";
                            
                            // Visual Logic Fix:
                            if (status === 'correct' && opt.isCorrect) {
                                style = "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500";
                            } 
                            else if (status === 'incorrect' && isSelected) {
                                style = "border-rose-500 bg-rose-50 ring-1 ring-rose-500";
                            }
                            else if (status === 'revealed') {
                                // In REVEALED state: Show Correct Option as Green...
                                if (opt.isCorrect) {
                                    style = "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500 opacity-100";
                                } 
                                // ...AND User's Wrong Selection as Red (if they made one)
                                else if (isSelected) {
                                    style = "border-rose-500 bg-rose-50 ring-1 ring-rose-500 opacity-60";
                                }
                                else {
                                    style = "border-gray-100 bg-gray-50 text-gray-400 opacity-50"; // Fade out irrelevant options
                                }
                            }
                            else if (isSelected) {
                                style = "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600 shadow-sm";
                            }

                            return (
                                <button
                                    key={opt.id}
                                    disabled={disabled}
                                    onClick={() => { setSelectedId(opt.id); onInteract(); }}
                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-start group ${style}`}
                                >
                                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 mr-3 flex items-center justify-center transition-colors ${
                                        isSelected 
                                            ? (status === 'correct' || (status === 'revealed' && opt.isCorrect) ? 'border-emerald-500 bg-emerald-500 text-white' 
                                            : status === 'incorrect' || (status === 'revealed' && !opt.isCorrect) ? 'border-rose-500 bg-rose-500 text-white' 
                                            : 'border-indigo-600') 
                                            : (status === 'revealed' && opt.isCorrect ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 group-hover:border-indigo-400')
                                    }`}>
                                        {(isSelected || (status === 'revealed' && opt.isCorrect)) && <div className="w-2.5 h-2.5 rounded-full bg-current" />}
                                    </div>
                                    <div className="text-gray-800 leading-relaxed text-sm font-medium"><MarkdownRenderer content={opt.text} /></div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </SmartBlockShell>
    );
};

// 4. Input Block
export const InputBlockRenderer: React.FC<{ data: InputBlock; pageId?: string }> = ({ data, pageId }) => {
    const { currentItem, activeIndex, setActiveIndex, totalCount, allCompleted, resultsSummary } = useAdaptiveSession(data);
    const block = currentItem as InputBlock;
    const [val, setVal] = useState('');

    useEffect(() => {
        setVal(block.state?.inputValue || '');
    }, [block.id, block.state]);

    return (
        <SmartBlockShell
            id={block.id}
            type={block.type}
            srsData={block.srs || data.srs}
            initialState={block.state}
            hints={block.hints}
            explanationSteps={block.explanationSteps}
            variationCount={totalCount}
            activeVariationIndex={activeIndex}
            allVariationsCompleted={allCompleted}
            resultsSummary={resultsSummary}
            onVariationChange={setActiveIndex}
            onResetBlock={() => {
                resetBlockState(pageId, data.id);
                setActiveIndex(0);
            }}
            onVerify={async () => {
                const cleanVal = val.trim().toLowerCase();
                const isCorrect = block.correctAnswer.some(a => 
                    block.caseSensitive ? a.trim() === val.trim() : a.trim().toLowerCase() === cleanVal
                );
                return { isCorrect };
            }}
            onCommitSRS={(newSRS) => updateVariationSRS(pageId, data.id, block.id, newSRS)}
            onPersistState={(partialState) => updateVariationState(pageId, data.id, block.id, { ...partialState, inputValue: val })}
        >
            {({ status, disabled, onInteract }) => (
                <div className="space-y-4">
                    <h3 className="text-xl font-medium text-gray-900 leading-relaxed font-display">
                        <MarkdownRenderer content={block.prompt} />
                    </h3>
                    <input
                        type="text"
                        disabled={disabled}
                        value={val}
                        onChange={(e) => { setVal(e.target.value); onInteract(); }}
                        placeholder={block.placeholder || "Type your answer..."}
                        className={`w-full p-4 text-lg rounded-xl border-2 outline-none transition-all shadow-sm ${
                            status === 'correct' ? 'border-emerald-500 bg-emerald-50 text-emerald-900' :
                            status === 'incorrect' ? 'border-rose-500 bg-rose-50 text-rose-900' :
                            status === 'revealed' ? 'border-rose-200 bg-gray-50 text-rose-800 decoration-rose-500/50 line-through' : // Strikethrough wrong answer if revealed
                            'bg-white text-gray-900 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                        }`}
                    />
                    
                    {/* VISUAL REVEAL: Show correct answer below */}
                    {status === 'revealed' && (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl animate-in fade-in slide-in-from-top-2">
                             <div className="flex items-center gap-2 mb-1">
                                <Check className="w-4 h-4 text-emerald-600" />
                                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Correct Answer</span>
                             </div>
                             <div className="text-emerald-900 font-bold text-lg">
                                {block.correctAnswer[0]}
                                {block.correctAnswer.length > 1 && (
                                    <span className="text-emerald-600 text-sm font-normal ml-2">
                                        (Alternatives: {block.correctAnswer.slice(1).join(', ')})
                                    </span>
                                )}
                             </div>
                        </div>
                    )}
                </div>
            )}
        </SmartBlockShell>
    );
};

// 5. Canvas Block
export const CanvasBlockRenderer: React.FC<{ data: CanvasBlock; pageId?: string }> = ({ data, pageId }) => {
    return (
        <div className="my-8 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
             <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                 <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Scratchpad</span>
                 <div className="flex space-x-2">
                     <button className="p-1.5 rounded hover:bg-gray-200 text-gray-500"><PenTool className="w-4 h-4"/></button>
                 </div>
             </div>
             <div className="h-64 relative bg-white cursor-crosshair flex items-center justify-center text-gray-300">
                 <span className="text-sm italic">Interactive Canvas (Placeholder)</span>
             </div>
             <div className="p-4 bg-gray-50 text-sm text-gray-600 border-t border-gray-200">
                 <MarkdownRenderer content={data.instruction} />
             </div>
        </div>
    );
};

// 6. Sort Block (Ordering)
export const SortBlockRenderer: React.FC<{ data: SortBlock; pageId?: string }> = ({ data, pageId }) => {
    const { currentItem, activeIndex, setActiveIndex, totalCount, allCompleted, resultsSummary } = useAdaptiveSession(data);
    const block = currentItem as SortBlock;

    const [currentOrder, setCurrentOrder] = useState<string[]>([]);

    useEffect(() => {
        if (block.state?.sortOrder) {
            setCurrentOrder(block.state.sortOrder);
        } else {
            // Default: Shuffle items initially
            const shuffled = [...block.items].sort(() => Math.random() - 0.5).map(i => i.id);
            setCurrentOrder(shuffled);
        }
    }, [block.id, block.state]);

    const moveItem = (index: number, direction: 'up' | 'down') => {
        const newOrder = [...currentOrder];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newOrder.length) return;
        
        [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
        setCurrentOrder(newOrder);
    };

    return (
        <SmartBlockShell
            id={block.id}
            type={block.type}
            srsData={block.srs || data.srs}
            initialState={block.state}
            hints={block.hints}
            explanationSteps={block.explanationSteps}
            variationCount={totalCount}
            activeVariationIndex={activeIndex}
            allVariationsCompleted={allCompleted}
            resultsSummary={resultsSummary}
            onVariationChange={setActiveIndex}
            onResetBlock={() => {
                resetBlockState(pageId, data.id);
                setActiveIndex(0);
            }}
            onVerify={async () => {
                const isCorrect = JSON.stringify(currentOrder) === JSON.stringify(block.correctOrder);
                return { isCorrect, feedback: isCorrect ? "Perfect sequence!" : "Order is incorrect. Try again." };
            }}
            onCommitSRS={(newSRS) => updateVariationSRS(pageId, data.id, block.id, newSRS)}
            onPersistState={(partialState) => {
                updateVariationState(pageId, data.id, block.id, { ...partialState, sortOrder: currentOrder });
            }}
        >
            {({ status, disabled, onInteract }) => {
                // VISUAL REVEAL: Force display correct order if revealed
                const effectiveOrder = status === 'revealed' ? block.correctOrder : currentOrder;

                return (
                    <div className="space-y-4">
                        <h3 className="text-xl font-medium text-gray-900 leading-relaxed font-display">
                            <MarkdownRenderer content={block.prompt} />
                        </h3>
                        
                        <div className="space-y-2">
                            {effectiveOrder.map((itemId, index) => {
                                const item = block.items.find(i => i.id === itemId);
                                if (!item) return null;
                                
                                let borderClass = "border-gray-200 bg-white";
                                // Correct = Emerald
                                if (status === 'correct') borderClass = "border-emerald-500 bg-emerald-50";
                                // Revealed = Amber (Solution Color) to distinguish from Success
                                else if (status === 'revealed') borderClass = "border-amber-400 bg-amber-50"; 
                                else if (status === 'incorrect') borderClass = "border-rose-300 bg-white";

                                return (
                                    <div key={item.id} className={`flex items-center p-3 rounded-xl border-2 ${borderClass} transition-all duration-300 shadow-sm`}>
                                        <div className="flex flex-col mr-4 space-y-1">
                                            <button 
                                                disabled={disabled || index === 0}
                                                onClick={() => { moveItem(index, 'up'); onInteract(); }}
                                                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-transparent"
                                            >
                                                <ArrowUp className="w-4 h-4" />
                                            </button>
                                            <button 
                                                disabled={disabled || index === currentOrder.length - 1}
                                                onClick={() => { moveItem(index, 'down'); onInteract(); }}
                                                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-transparent"
                                            >
                                                <ArrowDown className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="flex-1 font-medium text-gray-700 text-sm">
                                            <MarkdownRenderer content={item.text} />
                                        </div>
                                        <div className="text-xs font-bold text-gray-300 ml-2">
                                            {index + 1}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )
            }}
        </SmartBlockShell>
    );
};

// 7. Match Block
const MATCH_COLORS = [
    { base: 'blue',    bg: 'bg-blue-50',    border: 'border-blue-500',    text: 'text-blue-800' },
    { base: 'purple',  bg: 'bg-purple-50',  border: 'border-purple-500',  text: 'text-purple-800' },
    { base: 'orange',  bg: 'bg-orange-50',  border: 'border-orange-500',  text: 'text-orange-800' },
    { base: 'pink',    bg: 'bg-pink-50',    border: 'border-pink-500',    text: 'text-pink-800' },
    { base: 'teal',    bg: 'bg-teal-50',    border: 'border-teal-500',    text: 'text-teal-800' },
    { base: 'cyan',    bg: 'bg-cyan-50',    border: 'border-cyan-500',    text: 'text-cyan-800' },
    { base: 'indigo',  bg: 'bg-indigo-50',  border: 'border-indigo-500',  text: 'text-indigo-800' },
];

export const MatchBlockRenderer: React.FC<{ data: MatchBlock; pageId?: string }> = ({ data, pageId }) => {
    const { currentItem, activeIndex, setActiveIndex, totalCount, allCompleted, resultsSummary } = useAdaptiveSession(data);
    const block = currentItem as MatchBlock;

    const [matches, setMatches] = useState<Record<string, string>>({}); 
    const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
    const [rightItemsShuffled, setRightItemsShuffled] = useState<{id: string, text: string}[]>([]);

    useEffect(() => {
        const rightSide = block.pairs.map(p => p.right);
        setRightItemsShuffled(rightSide.sort(() => Math.random() - 0.5));
        if (block.state?.matches) setMatches(block.state.matches);
        else setMatches({});
        setSelectedLeft(null);
    }, [block.id, block.state]);

    const handleLeftClick = (id: string) => {
        if (matches[id]) {
            const newMatches = { ...matches };
            delete newMatches[id];
            setMatches(newMatches);
        }
        setSelectedLeft(id);
    };

    const handleRightClick = (rightId: string, onInteract: () => void) => {
        if (!selectedLeft) return;
        const newMatches = { ...matches, [selectedLeft]: rightId };
        setMatches(newMatches);
        setSelectedLeft(null);
        onInteract();
    };

    const correctMatches = useMemo(() => {
        const m: Record<string, string> = {};
        block.pairs.forEach(p => m[p.left.id] = p.right.id);
        return m;
    }, [block.pairs]);

    const getColorStyle = (leftId: string) => {
        const pairIndex = block.pairs.findIndex(p => p.left.id === leftId);
        if (pairIndex === -1) return MATCH_COLORS[0];
        return MATCH_COLORS[pairIndex % MATCH_COLORS.length];
    };

    const getBadge = (leftId: string) => {
        const pairIndex = block.pairs.findIndex(p => p.left.id === leftId);
        if (pairIndex === -1) return '?';
        return String.fromCharCode(65 + pairIndex); 
    };

    return (
        <SmartBlockShell
            id={block.id}
            type={block.type}
            srsData={block.srs || data.srs}
            initialState={block.state}
            hints={block.hints}
            explanationSteps={block.explanationSteps}
            variationCount={totalCount}
            activeVariationIndex={activeIndex}
            allVariationsCompleted={allCompleted}
            resultsSummary={resultsSummary}
            onVariationChange={setActiveIndex}
            onResetBlock={() => {
                resetBlockState(pageId, data.id);
                setActiveIndex(0);
            }}
            onVerify={async () => {
                let allCorrect = true;
                if (Object.keys(matches).length !== block.pairs.length) allCorrect = false;
                block.pairs.forEach(pair => {
                    if (matches[pair.left.id] !== pair.right.id) allCorrect = false;
                });
                return { isCorrect: allCorrect, feedback: allCorrect ? "All connections verified!" : "Some connections are wrong." };
            }}
            onCommitSRS={(newSRS) => updateVariationSRS(pageId, data.id, block.id, newSRS)}
            onPersistState={(partialState) => updateVariationState(pageId, data.id, block.id, { ...partialState, matches })}
        >
            {({ status, disabled, onInteract }) => {
                // FIXED LOGIC: If revealed, we ignore 'matches' and use 'correctMatches'
                // AND we use a unified style to prevent the red/green "rainbow confusion"
                const effectiveMatches = status === 'revealed' ? correctMatches : matches;
                
                return (
                    <div className="space-y-6">
                        <h3 className="text-xl font-medium text-gray-900 leading-relaxed font-display">
                            <MarkdownRenderer content={block.prompt} />
                        </h3>
                        <div className="grid grid-cols-2 gap-8 relative">
                            {/* Left Column */}
                            <div className="space-y-3">
                                {block.pairs.map((pair, idx) => {
                                    const isMatched = !!effectiveMatches[pair.left.id];
                                    const isSelected = selectedLeft === pair.left.id;
                                    const color = getColorStyle(pair.left.id);
                                    
                                    let style = "bg-white border-gray-200 hover:border-gray-300";
                                    let badgeStyle = "bg-gray-100 text-gray-500";
                                    
                                    if (status === 'revealed') {
                                        // SOLUTION MODE: Uniform Amber Color
                                        style = `border-amber-400 bg-amber-50 text-amber-900 border-2`;
                                        badgeStyle = "bg-amber-200 text-amber-900 font-bold";
                                    } 
                                    else if (status === 'correct') {
                                        style = `border-emerald-500 bg-emerald-50 text-emerald-900 border-2`;
                                        badgeStyle = "bg-emerald-200 text-emerald-800";
                                    } 
                                    else if (status === 'incorrect' && isMatched) {
                                        // User Mode: Check if THIS specific connection was right
                                        const matchedRightId = effectiveMatches[pair.left.id];
                                        const isCorrectMatch = matchedRightId === pair.right.id;
                                        if (isCorrectMatch) { style = `border-emerald-500 bg-emerald-50 border-2`; badgeStyle = "bg-emerald-200 text-emerald-800"; } 
                                        else { style = `border-rose-400 bg-rose-50 text-rose-900 border-2`; badgeStyle = "bg-rose-200 text-rose-800"; }
                                    } 
                                    else if (isSelected) {
                                        style = `ring-2 ring-indigo-300 border-indigo-500 bg-indigo-50 border-2`; badgeStyle = "bg-indigo-600 text-white";
                                    } 
                                    else if (isMatched) {
                                        // Connected but not checked yet (Rainbow mode)
                                        style = `${color.border} ${color.bg} ${color.text} border-2`; badgeStyle = "bg-gray-800 text-white opacity-50"; 
                                    }

                                    return (
                                        <button key={pair.left.id} disabled={disabled} onClick={() => { if(!disabled) handleLeftClick(pair.left.id); }} className={`w-full p-4 rounded-xl border-2 text-sm font-medium transition-all text-left relative flex items-center gap-3 ${style}`}>
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${badgeStyle}`} style={isMatched && !isSelected && status === 'idle' ? { backgroundColor: 'currentColor' } : {}}>{isMatched && !isSelected && status === 'idle' ? <span className="text-white mix-blend-plus-lighter">{getBadge(pair.left.id)}</span> : <span>{String.fromCharCode(65 + idx)}</span>}</div>
                                            <div className="flex-1"><MarkdownRenderer content={pair.left.text} /></div>
                                            {isMatched && status !== 'revealed' && <div className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white ${isSelected ? 'bg-indigo-500' : 'bg-current'}`}></div>}
                                        </button>
                                    )
                                })}
                            </div>
                            {/* Right Column */}
                            <div className="space-y-3">
                                {rightItemsShuffled.map((item) => {
                                    const connectedLeftId = Object.keys(effectiveMatches).find(key => effectiveMatches[key] === item.id);
                                    const isConnected = !!connectedLeftId;
                                    const color = connectedLeftId ? getColorStyle(connectedLeftId) : MATCH_COLORS[0];
                                    
                                    let style = "bg-gray-50 border-gray-200 hover:bg-white hover:border-indigo-300";
                                    let badgeContent = null;

                                    if (status === 'revealed') {
                                        // SOLUTION MODE: Uniform Amber Color
                                        // We need to find which badge connects to this item
                                        const pair = block.pairs.find(p => p.right.id === item.id);
                                        const correctLeftId = pair?.left.id;
                                        if (correctLeftId) {
                                            style = `border-amber-400 bg-amber-50 text-amber-900 border-2`;
                                            badgeContent = (<div className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-amber-900 bg-amber-200"><span>{getBadge(correctLeftId)}</span></div>);
                                        }
                                    }
                                    else if (status === 'correct') { 
                                        style = `border-emerald-500 bg-emerald-50 text-emerald-900 border-2`; 
                                    } 
                                    else if (status === 'incorrect' && isConnected) {
                                        const pair = block.pairs.find(p => p.left.id === connectedLeftId);
                                        const isCorrect = pair?.right.id === item.id;
                                        style = isCorrect ? `border-emerald-500 bg-emerald-50 border-2` : `border-rose-400 bg-rose-50 text-rose-900 border-2`;
                                    } 
                                    else if (isConnected) {
                                        style = `${color.border} ${color.bg} ${color.text} border-2`;
                                        badgeContent = (<div className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white bg-current opacity-80"><span className="text-white mix-blend-plus-lighter">{getBadge(connectedLeftId!)}</span></div>);
                                    }

                                    return (
                                        <button key={item.id} disabled={disabled} onClick={() => { if(!disabled) handleRightClick(item.id, onInteract); }} className={`w-full p-4 pl-10 rounded-xl border-2 text-sm font-medium transition-all text-left relative ${style}`}>
                                            {isConnected && status !== 'revealed' && <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white bg-current"></div>}{badgeContent}<MarkdownRenderer content={item.text} />
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )
            }}
        </SmartBlockShell>
    );
};

// 8. Habit Block
export const HabitBlockRenderer: React.FC<{ data: HabitBlock; pageId?: string }> = ({ data, pageId }) => {
    const { virtualNow } = useTime();
    const isCompletedToday = useMemo(() => {
        return data.history?.some(timestamp => isSameDay(timestamp, virtualNow)) || false;
    }, [data.history, virtualNow]);

    return (
        <SmartBlockShell
            id={data.id}
            type={data.type}
            srsData={{ entityId: `habit.${data.id}`, repetitionCount: data.streak, stability: data.streak, difficulty: 1, level: 1, name: "RITUAL", objective: "Build Consistency", masteryScore: Math.min(100, data.streak * 5), nextReviewDue: virtualNow + 86400000 }}
            initialState={{ status: isCompletedToday ? 'correct' : 'idle', attempts: 0 }}
            onVerify={async () => { return { isCorrect: true, feedback: "Consistency is key!" }; }}
            onCommitSRS={(newSRS) => {
                if (!isCompletedToday) {
                    const newHistory = [...(data.history || []), virtualNow];
                    const newStreak = calculateStreak(newHistory, virtualNow); 
                    updateHabitData(pageId, data.id, newStreak, newHistory);
                }
            }}
        >
            {({ status, disabled, onInteract }) => (
                <div className="flex flex-col items-center py-4">
                    <div className="flex items-center gap-2 mb-4 text-gray-500 text-xs font-bold uppercase tracking-wider">
                        <Calendar className="w-4 h-4" />
                        <span>{data.frequency === 'daily' ? 'Daily Ritual' : 'Weekly Goal'}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 text-center mb-6">{data.prompt}</h3>
                    <div className="relative group cursor-pointer" onClick={() => !disabled && onInteract()}>
                        <div className={`w-32 h-32 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${status === 'correct' ? 'bg-emerald-500 border-emerald-600 shadow-[0_0_40px_rgba(16,185,129,0.4)] scale-110' : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-lg'}`}>
                            {status === 'correct' ? <Check className="w-16 h-16 text-white animate-in zoom-in spin-in-12 duration-500" /> : <div className="text-gray-300 group-hover:text-indigo-400 transition-colors"><div className="text-xs font-bold text-center uppercase tracking-widest mb-1">Tap to</div><div className="text-lg font-bold text-center">Complete</div></div>}
                        </div>
                    </div>
                    <div className="mt-8 flex items-center gap-2 px-4 py-2 bg-orange-50 rounded-full border border-orange-100">
                        <Flame className={`w-5 h-5 ${data.streak > 0 ? 'text-orange-500 fill-orange-500 animate-pulse' : 'text-gray-300'}`} />
                        <span className={`font-mono font-bold text-lg ${data.streak > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{data.streak} Day Streak</span>
                    </div>
                </div>
            )}
        </SmartBlockShell>
    );
};

// 9. Task Block
export const TaskBlockRenderer: React.FC<{ data: TaskBlock; pageId?: string }> = ({ data, pageId }) => {
    const isOverdue = data.dueDate && data.dueDate < Date.now() && !data.isCompleted;
    return (
        <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 ${data.isCompleted ? 'bg-gray-50 border-gray-100 opacity-60' : isOverdue ? 'bg-white border-rose-200 shadow-sm' : 'bg-white border-gray-200 shadow-sm hover:border-indigo-200'}`}>
            <button onClick={() => toggleTaskCompletion(pageId, data.id, !data.isCompleted)} className={`mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${data.isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-300 hover:border-indigo-400 text-transparent'}`}><Check className="w-4 h-4" strokeWidth={3} /></button>
            <div className="flex-1">
                <div className={`text-base font-medium leading-relaxed ${data.isCompleted ? 'text-gray-500 line-through decoration-gray-300' : 'text-gray-900'}`}><MarkdownRenderer content={data.content} /></div>
                {data.dueDate && (<div className={`text-xs mt-2 flex items-center gap-1.5 ${isOverdue ? 'text-rose-600 font-bold' : 'text-gray-400'}`}><Calendar className="w-3.5 h-3.5" /><span>{new Date(data.dueDate).toLocaleDateString()}{isOverdue && " (Overdue)"}</span></div>)}
            </div>
        </div>
    );
};

// 10. SOCRATIC BLOCK
export const SocraticBlockRenderer: React.FC<{ data: SocraticBlock; pageId?: string }> = ({ data, pageId }) => {
    const { currentItem, activeIndex, setActiveIndex, totalCount, allCompleted, resultsSummary } = useAdaptiveSession(data);
    const block = currentItem as SocraticBlock;
    const [textInput, setTextInput] = useState('');
    const [rubricResult, setRubricResult] = useState<{ id: string, passed: boolean }[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        if (block.state?.socraticInput) setTextInput(block.state.socraticInput);
        else setTextInput('');
    }, [block.id, block.state]);

    const performAnalysis = async (input: string) => {
        const lowerInput = input.toLowerCase();
        const results = block.rubric.map(criterion => {
            let passed = true;
            if (criterion.requiredKeywords && criterion.requiredKeywords.length > 0) {
                if (!criterion.requiredKeywords.some(k => lowerInput.includes(k.toLowerCase()))) passed = false;
            }
            if (criterion.forbiddenKeywords && criterion.forbiddenKeywords.length > 0) {
                if (criterion.forbiddenKeywords.some(k => lowerInput.includes(k.toLowerCase()))) passed = false;
            }
            if (criterion.minLength && input.length < criterion.minLength) passed = false;
            return { id: criterion.id, passed };
        });
        const passedAll = results.filter(r => r.passed).length >= block.minScoreToPass;
        return { passed: passedAll, results };
    };

    return (
        <SmartBlockShell
            id={block.id}
            type={block.type}
            srsData={block.srs || data.srs}
            initialState={block.state}
            hints={block.hints}
            explanationSteps={block.explanationSteps}
            variationCount={totalCount}
            activeVariationIndex={activeIndex}
            allVariationsCompleted={allCompleted}
            resultsSummary={resultsSummary}
            onVariationChange={setActiveIndex}
            onResetBlock={() => { 
                resetBlockState(pageId, data.id); 
                setRubricResult([]); 
                setActiveIndex(0);
            }}
            onVerify={async () => {
                setIsAnalyzing(true);
                await new Promise(resolve => setTimeout(resolve, 1500));
                const analysis = await performAnalysis(textInput);
                setRubricResult(analysis.results);
                setIsAnalyzing(false);
                const passedCount = analysis.results.filter(r => r.passed).length;
                return { isCorrect: analysis.passed, feedback: analysis.passed ? `Excellent. ${passedCount} criteria met.` : `Criteria unmet: ${passedCount}/${block.rubric.length}` };
            }}
            onCommitSRS={(newSRS) => updateVariationSRS(pageId, data.id, block.id, newSRS)}
            onPersistState={(partialState) => updateVariationState(pageId, data.id, block.id, { ...partialState, socraticInput: textInput })}
        >
            {({ status, disabled, onInteract }) => (
                <div className="space-y-6">
                    <div className="flex items-start gap-3"><div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><MessageSquare className="w-5 h-5" /></div><div><h3 className="text-xl font-medium text-gray-900 leading-relaxed font-display"><MarkdownRenderer content={block.prompt} /></h3><p className="text-xs text-gray-500 mt-1">Respond below. The AI will evaluate your reasoning.</p></div></div>
                    <div className="relative">
                        <textarea value={textInput} disabled={disabled || isAnalyzing} onChange={(e) => { setTextInput(e.target.value); onInteract(); }} placeholder={block.placeholder || "Type your explanation here..."} className={`w-full min-h-[150px] p-4 text-base rounded-xl border-2 resize-none transition-all outline-none bg-white text-gray-900 ${status === 'correct' ? 'border-emerald-200 bg-emerald-50/30' : status === 'incorrect' ? 'border-rose-200 bg-rose-50/30' : 'border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`} />
                        <div className="absolute bottom-3 right-3 text-xs text-gray-400 font-mono">{textInput.length} chars</div>
                    </div>
                    {isAnalyzing && (<div className="flex items-center justify-center space-x-3 py-4 text-indigo-600 animate-pulse"><Bot className="w-5 h-5" /><span className="font-bold text-sm">Analyzing Response...</span></div>)}
                    {(status === 'correct' || status === 'incorrect' || status === 'revealed') && !isAnalyzing && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                            <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between items-center"><span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><Sparkles className="w-3 h-3 text-amber-500" />Evaluation Report</span><span className={`text-xs font-bold px-2 py-0.5 rounded ${status === 'correct' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{status === 'correct' ? 'PASS' : 'REVISE'}</span></div>
                            <div className="p-4 space-y-3">
                                {block.rubric.map((criterion) => {
                                    const result = rubricResult.find(r => r.id === criterion.id);
                                    const passed = result?.passed ?? false;
                                    return (
                                        <div key={criterion.id} className="flex items-start gap-3">
                                            <div className={`mt-0.5 flex-shrink-0 ${passed ? 'text-emerald-500' : 'text-rose-500'}`}>{passed ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}</div>
                                            <div><div className={`text-sm font-bold ${passed ? 'text-gray-800' : 'text-gray-900'}`}>{criterion.label}</div><div className={`text-xs mt-0.5 ${passed ? 'text-emerald-600' : 'text-rose-600'}`}>{passed ? criterion.feedbackPass : criterion.feedbackFail}</div></div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </SmartBlockShell>
    );
};

// 11. CODE BLOCK
export const CodeBlockRenderer: React.FC<{ data: CodeBlock }> = ({ data }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => { navigator.clipboard.writeText(data.code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
    return (
        <div className="my-6 rounded-xl overflow-hidden border border-gray-800 bg-[#1e1e1e] shadow-md">
            <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-gray-700">
                <div className="flex items-center space-x-2"><div className="flex space-x-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div><div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div><div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div></div>{data.caption && (<span className="text-xs text-gray-400 font-mono ml-3 border-l border-gray-600 pl-3">{data.caption}</span>)}</div>
                <div className="flex items-center space-x-3"><span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{data.language}</span><button onClick={handleCopy} className="text-gray-400 hover:text-white transition-colors p-1 rounded" title="Copy Code">{copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}</button></div>
            </div>
            <div className="text-sm font-mono leading-relaxed"><SyntaxHighlighter language={data.language} style={vscDarkPlus} customStyle={{ margin: 0, padding: '1.5rem', background: 'transparent' }} showLineNumbers={true} lineNumberStyle={{ minWidth: '2em', paddingRight: '1em', color: '#6e7681' }}>{data.code}</SyntaxHighlighter></div>
        </div>
    );
};

// 12. DIAGRAM BLOCK
export const DiagramBlockRenderer: React.FC<{ data: DiagramBlock }> = ({ data }) => {
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        mermaid.parseError = (err) => { console.debug("Mermaid Parse Error Handled:", err); };
        mermaid.initialize({ startOnLoad: false, theme: 'default', fontFamily: 'Inter, sans-serif', securityLevel: 'loose', logLevel: 'error' });
        const renderDiagram = async () => {
            if (!data.chart) return;
            try {
                if(isMounted) { setLoading(true); setError(null); }
                await mermaid.parse(data.chart);
                const uniqueId = `mermaid-${data.id.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`;
                const { svg } = await mermaid.render(uniqueId, data.chart);
                if (isMounted) { setSvg(svg); setLoading(false); }
            } catch (e) { console.error("Mermaid Render Error", e); if (isMounted) { setError("Syntax Error"); setLoading(false); } }
        };
        renderDiagram();
        return () => { isMounted = false; };
    }, [data.chart, data.id]);

    return (
        <div className="my-8 flex flex-col items-center w-full group">
            <div className={`w-full overflow-x-auto rounded-xl border p-6 transition-all duration-300 flex justify-center bg-white min-h-[120px] items-center ${error ? 'border-rose-200 bg-rose-50/50' : 'border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-200'}`}>
                {loading ? (<div className="flex flex-col items-center justify-center space-y-3 opacity-60"><div className="flex space-x-1.5"><div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75"></div><div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150"></div></div><div className="text-[10px] font-bold text-indigo-900 uppercase tracking-widest">Rendering Chart</div></div>) : error ? (<div className="flex flex-col items-center text-center w-full py-2"><div className="flex items-center gap-2 text-rose-600 font-bold mb-2 text-sm"><AlertCircle className="w-4 h-4" /><span>Diagram Syntax Error</span></div><div className="w-full bg-white border border-rose-100 rounded p-3 text-left overflow-auto max-h-32 shadow-inner"><code className="text-[10px] font-mono text-rose-800 whitespace-pre">{data.chart}</code></div></div>) : (<div className="mermaid-svg-container w-full flex justify-center" dangerouslySetInnerHTML={{ __html: svg }} />)}
            </div>
            {data.caption && (<div className="flex items-center gap-2 mt-3 text-gray-400"><div className="h-px w-6 bg-gray-200"></div><p className="text-xs font-medium italic">{data.caption}</p><div className="h-px w-6 bg-gray-200"></div></div>)}
        </div>
    );
};

// 13. CHART BLOCK
export const ChartBlockRenderer: React.FC<{ data: ChartBlock }> = ({ data }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);
    useEffect(() => {
        if (!canvasRef.current) return;
        if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }
        const chartData = { labels: data.data.map(point => point[data.xAxisKey]), datasets: data.series.map(series => ({ label: series.name || series.dataKey, data: data.data.map(point => point[series.dataKey]), borderColor: series.color, backgroundColor: series.color + '40', fill: data.chartType === 'area', tension: 0.3, borderWidth: 2 })) };
        const type = data.chartType === 'area' ? 'line' : data.chartType;
        const config = { type: type, data: chartData, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { family: "'Inter', sans-serif", size: 11 } } }, tooltip: { backgroundColor: '#fff', titleColor: '#1f2937', bodyColor: '#4b5563', borderColor: '#e5e7eb', borderWidth: 1, padding: 10, displayColors: true, titleFont: { family: "'Inter', sans-serif", weight: 'bold' }, bodyFont: { family: "'Inter', sans-serif" } }, title: { display: false } }, scales: data.chartType === 'pie' ? {} : { x: { grid: { display: false }, ticks: { font: { size: 10, family: "'Inter', sans-serif" }, color: '#9ca3af' } }, y: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 10, family: "'Inter', sans-serif" }, color: '#9ca3af' }, border: { display: false } } } } };
        chartInstance.current = new Chart(canvasRef.current, config as any);
        return () => { if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; } };
    }, [data]);
    return (
        <div className="my-8 w-full bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6"><h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-500" />{data.title || "Data Visualization"}</h3></div>
            <div className="w-full h-[300px]"><canvas ref={canvasRef} /></div>
            <div className="mt-4 text-[10px] text-center text-gray-400 font-mono">{data.chartType.toUpperCase()} CHART</div>
        </div>
    );
};

// 14. COURSE MAP BLOCK
export const CourseMapBlockRenderer: React.FC<{ 
    data: CourseMapBlock; 
    pageId?: string;
    onAutoCreate?: (nodeTitle: string, context: string, blueprint?: string, onCreated?: (pageId: string) => Promise<void>) => void;
}> = ({ data, pageId, onAutoCreate }) => {
    
    // Icon Mapping
    const getIcon = (name: string) => {
        switch(name) {
            case 'search': return <Search className="w-5 h-5" />;
            case 'math': return <Calculator className="w-5 h-5" />;
            case 'code': return <CodeIcon className="w-5 h-5" />;
            case 'atom': return <Atom className="w-5 h-5" />;
            default: return <Book className="w-5 h-5" />;
        }
    };

    // Check existance of pages
    const allPages = useLiveQuery(() => db.pages.toArray(), []) || [];
    
    // Find the CURRENT page to get its tags (the domain context)
    const currentPage = useLiveQuery(() => pageId ? db.pages.get(pageId) : undefined, [pageId]);
    
    const getNodeStatus = (nodeTargetId: string, nodeTitle: string) => {
        // Strict ID check first, then Title match as fallback
        const exists = allPages.find(p => p.id === nodeTargetId || p.title === nodeTitle);
        if (!exists) return 'missing';
        
        // Check if completed? (Simplified logic: if exists, it's unlocked)
        const hasRepetitions = exists.blocks.some(b => (b.srs?.repetitionCount || 0) > 0);
        return hasRepetitions ? 'completed' : 'unlocked';
    };

    const linkNodeToPage = async (nodeId: string, newPageId: string) => {
        if (!pageId) return;
        await (db as any).transaction('rw', db.pages, async () => {
            const page = await db.pages.get(pageId);
            if (!page) return;
            
            const newBlocks = [...page.blocks];
            const blockIndex = newBlocks.findIndex(b => b.id === data.id);
            if (blockIndex === -1) return;
            
            const block = newBlocks[blockIndex] as CourseMapBlock;
            const newNodes = block.nodes.map(n => 
                n.id === nodeId ? { ...n, targetPageId: newPageId } : n
            );
            
            newBlocks[blockIndex] = { ...block, nodes: newNodes };
            await db.pages.update(pageId, { blocks: newBlocks });
        });
    };

    const handleNodeClick = (node: any, levelIndex: number, levelTitle: string) => {
        const status = getNodeStatus(node.targetPageId, node.title);
        
        if (status === 'missing') {
            if (onAutoCreate) {
                // HIERARCHY LOGIC: Pass the parent page's tags to the new lesson
                const parentDomain = currentPage?.tags?.[0] || ""; 
                const contextString = parentDomain ? parentDomain : ""; 
                
                // GENERATE RICH BLUEPRINT
                const blueprint = `CONTEXT: This lesson is part of the structured course: "${data.courseTitle}".
LEVEL: ${levelIndex} (${levelTitle}).
LESSON GOAL: "${node.description}".
INSTRUCTIONS: Create a comprehensive lesson that teaches "${node.title}" at the appropriate difficulty level for Level ${levelIndex}. Ensure it fits seamlessly into the course progression.`;

                // Pass the linkNodeToPage callback to update the node AFTER page creation
                onAutoCreate(node.title, contextString, blueprint, async (newPageId) => {
                    await linkNodeToPage(node.id, newPageId);
                });
            }
        } else {
            // Navigate
            const target = allPages.find(p => p.id === node.targetPageId || p.title === node.title);
            if (target) {
                const event = new CustomEvent('eduforge-navigate', { detail: target.id });
                window.dispatchEvent(event);
            }
        }
    };

    return (
        <div className="my-10 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
            {/* Sidebar / Info */}
            <div className="md:w-1/3 bg-gray-50 p-8 border-r border-gray-200 flex flex-col justify-center">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-gray-200 flex items-center justify-center mb-6 text-indigo-600">
                    <Atom className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{data.courseTitle}</h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-6">{data.courseDescription}</p>
                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <Layers className="w-4 h-4" />
                    <span>{data.levels.length} Levels</span>
                    <span>•</span>
                    <span>{data.nodes.length} Lessons</span>
                </div>
            </div>

            {/* The Path */}
            <div className="md:w-2/3 p-8 relative">
                {/* Vertical Connector Line (Background) */}
                <div className="absolute left-8 md:left-12 top-10 bottom-10 w-0.5 bg-gray-100 z-0"></div>

                <div className="space-y-12 relative z-10">
                    {data.levels.map((level) => {
                        const levelNodes = data.nodes.filter(n => n.levelIndex === level.index);
                        
                        return (
                            <div key={level.index} className="relative">
                                {/* Level Header */}
                                <div className="flex items-center gap-4 mb-6 ml-0 md:ml-4">
                                    <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Level {level.index}</span>
                                    <h3 className="font-bold text-gray-900 text-sm">{level.title}</h3>
                                </div>

                                <div className="space-y-6">
                                    {levelNodes.map((node, idx) => {
                                        const status = getNodeStatus(node.targetPageId, node.title);
                                        const isMissing = status === 'missing';
                                        
                                        return (
                                            <button 
                                                key={node.id}
                                                onClick={() => handleNodeClick(node, level.index, level.title)}
                                                className={`
                                                    group flex items-center gap-4 w-full text-left transition-all p-2 rounded-xl
                                                    ${isMissing ? 'hover:bg-gray-50' : 'hover:bg-indigo-50'}
                                                `}
                                            >
                                                {/* Node Circle */}
                                                <div className={`
                                                    w-12 h-12 rounded-full border-4 flex items-center justify-center shrink-0 shadow-sm z-10 transition-colors relative
                                                    ${status === 'completed' ? 'bg-emerald-500 border-emerald-100 text-white' :
                                                      status === 'unlocked' ? 'bg-white border-indigo-100 text-indigo-600 group-hover:border-indigo-300' :
                                                      'bg-white border-gray-200 text-gray-300 group-hover:border-gray-300 border-dashed'}
                                                `}>
                                                    {status === 'completed' ? <Check className="w-5 h-5" /> : 
                                                     isMissing ? <Plus className="w-5 h-5" /> :
                                                     getIcon(node.icon || 'book')}
                                                    
                                                    {/* Connector Dot to Line */}
                                                    <div className="absolute left-1/2 top-full h-6 w-0.5 bg-gray-100 -translate-x-1/2 -z-10 group-last:hidden"></div>
                                                </div>

                                                {/* Info */}
                                                <div>
                                                    <h4 className={`font-bold text-base ${status === 'completed' ? 'text-gray-900' : isMissing ? 'text-gray-400' : 'text-gray-800'}`}>
                                                        {node.title}
                                                    </h4>
                                                    <p className="text-xs text-gray-500 line-clamp-1">{node.description}</p>
                                                </div>

                                                {/* Action Icon */}
                                                <div className="ml-auto pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {isMissing ? (
                                                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">Create</span>
                                                    ) : (
                                                        <ArrowRightCircle className="w-5 h-5 text-indigo-400" />
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
