
import React, { useState, useEffect, useMemo } from 'react';
import { X, Copy, Check, ArrowRight, Sparkles, Sliders, Layers, Dna, Microscope, Activity, GitBranch, ArrowUpCircle, AlertCircle, FileText, CheckSquare, PenTool, Braces, Link, Hash, RefreshCw } from 'lucide-react';
import { SystemContextLoader } from '../services/aiPrompts';
import { db } from '../db';
import { Block, BlockType } from '../types';
import { aggregateConceptHealth } from '../utils/learning';

interface AIAutomationModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceBlock: Block | null;
    pageId: string;
    onBlockAdded: () => void; // Trigger refresh in parent
    mode?: 'augment' | 'repair'; // New Mode
}

type Step = 'diagnose' | 'protocol' | 'synthesis';

// Helper to get icon for block type
const getBlockIcon = (type: BlockType) => {
    switch (type) {
        case BlockType.MCQ: return <CheckSquare className="w-3.5 h-3.5" />;
        case BlockType.INPUT: return <PenTool className="w-3.5 h-3.5" />;
        case BlockType.TEXT: return <FileText className="w-3.5 h-3.5" />;
        case BlockType.MATH: return <Braces className="w-3.5 h-3.5" />;
        case BlockType.MATCH: return <Link className="w-3.5 h-3.5" />;
        default: return <Dna className="w-3.5 h-3.5" />;
    }
};

export const AIAutomationModal: React.FC<AIAutomationModalProps> = ({ 
    isOpen, 
    onClose, 
    sourceBlock, 
    pageId,
    onBlockAdded,
    mode = 'augment'
}) => {
    const [step, setStep] = useState<Step>('diagnose');
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [jsonInput, setJsonInput] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Quantity Selector
    const [generationCount, setGenerationCount] = useState<1 | 3 | 5>(1);

    // Reset when opening
    useEffect(() => {
        if (isOpen && sourceBlock) {
            setStep('diagnose');
            setGeneratedPrompt('');
            setJsonInput('');
            setError(null);
            setGenerationCount(1); // Reset count
        }
    }, [isOpen, sourceBlock]);

    // --- GENOME ANALYSIS (Transparency Engine) ---
    const genome = useMemo(() => {
        if (!sourceBlock) return null;
        
        const allVariations = [sourceBlock, ...(sourceBlock.variations || [])];
        const levels = allVariations.map(b => b.srs?.level || 1).sort((a, b) => a - b);
        const maxLevel = Math.max(...levels);
        const avgStability = allVariations.reduce((acc, b) => acc + (b.srs?.stability || 0), 0) / allVariations.length;
        const totalExercises = allVariations.length;
        
        // Detailed Sequence for UI Matrix
        const sequence = allVariations.map(b => ({
            id: b.id,
            type: b.type,
            level: b.srs?.level || 1,
            stability: b.srs?.stability || 0,
            status: (b.srs?.stability || 0) > 2.0 ? 'stable' : ((b.srs?.repetitionCount || 0) > 0 ? 'volatile' : 'new')
        })).sort((a,b) => a.level - b.level); // Sort by level for matrix visualization

        // Identify "Strands" (e.g. 2 exercises at Lvl 1, 1 at Lvl 2)
        const distribution: Record<number, number> = {};
        levels.forEach(l => { distribution[l] = (distribution[l] || 0) + 1; });

        return {
            entityId: sourceBlock.srs?.entityId || 'unknown',
            name: sourceBlock.srs?.name || 'Unnamed Concept',
            levels,
            distribution,
            maxLevel,
            avgStability,
            totalExercises,
            sequence,
            isHealthy: avgStability > 2.0
        };
    }, [sourceBlock]);

    if (!isOpen || !sourceBlock || !genome) return null;

    const handleGeneratePrompt = (actionType: 'variation' | 'evolution' | 'repair') => {
        let prompt = '';
        if (actionType === 'repair') {
            prompt = SystemContextLoader.generateRepairPrompt(sourceBlock);
        } else if (actionType === 'variation') {
            prompt = SystemContextLoader.generateVariationPrompt(sourceBlock, generationCount);
        } else {
            prompt = SystemContextLoader.generateEvolutionPrompt(sourceBlock, genome.maxLevel, generationCount);
        }
        setGeneratedPrompt(prompt);
        setStep('protocol');
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedPrompt);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleIngest = async () => {
        try {
            setError(null);
            
            // 1. Parsing Phase
            let parsed: any;
            try {
                const jsonMatch = jsonInput.match(/\{[\s\S]*\}|\[[\s\S]*\]/); // Match object OR array
                const stringToParse = jsonMatch ? jsonMatch[0] : jsonInput;
                parsed = JSON.parse(stringToParse);
            } catch (e) {
                throw new Error("Syntax Error: The DNA sequence (JSON) is corrupted.");
            }

            // 2. Normalize to Array (Handle { blocks: [] }, [], or single object)
            let blocksToIngest: any[] = [];
            if (Array.isArray(parsed)) {
                blocksToIngest = parsed;
            } else if (parsed.blocks && Array.isArray(parsed.blocks)) {
                blocksToIngest = parsed.blocks;
            } else {
                blocksToIngest = [parsed];
            }

            if (blocksToIngest.length === 0) throw new Error("No blocks found in input.");

            const validBlocks: Block[] = [];

            // 3. Validation & Synthesis Phase (Loop)
            for (const item of blocksToIngest) {
                if (!item.type || !Object.values(BlockType).includes(item.type)) {
                    console.warn(`Skipping invalid block type: ${item.type}`);
                    continue;
                }

                const newBlock: Block = {
                    ...item,
                    id: item.id || `var-${crypto.randomUUID()}`, 
                    srs: {
                        ...(sourceBlock.srs || {}), 
                        ...item.srs, 
                        // ENFORCE CONSISTENCY
                        entityId: sourceBlock.srs?.entityId || item.srs?.entityId || `gen.${crypto.randomUUID()}`,
                        // Reset Logic for NEW variation
                        repetitionCount: 0,
                        stability: 0,
                        masteryScore: 0,
                        lastReviewed: undefined,
                        nextReviewDue: undefined
                    }
                };
                validBlocks.push(newBlock);
            }

            if (validBlocks.length === 0) throw new Error("No valid blocks could be parsed.");

            // 4. Persistence & Recalculation
            await (db as any).transaction('rw', db.pages, async () => {
                const page = await db.pages.get(pageId);
                if (page) {
                    const blockIndex = page.blocks.findIndex(b => b.id === sourceBlock.id);
                    if (blockIndex !== -1) {
                        const targetBlock = page.blocks[blockIndex];
                        let updatedBlock: Block;

                        // FIX: Handle REPAIR mode by replacing content in-place
                        if (mode === 'repair' && validBlocks.length === 1) {
                            const repairData = validBlocks[0];
                            updatedBlock = {
                                ...targetBlock, // Preserve original keys
                                ...repairData, // Overwrite with repaired data (content, charts, etc.)
                                id: targetBlock.id, // FORCE Keep original ID to maintain DB references
                                variations: targetBlock.variations, // Maintain history
                                srs: {
                                    ...(targetBlock.srs || {}),
                                    ...(repairData.srs || {}),
                                    // Ensure entityId exists
                                    entityId: targetBlock.srs?.entityId || repairData.srs?.entityId || `gen.${crypto.randomUUID()}`
                                }
                            };
                        } else {
                            // Default: Augment/Evolve mode (add as variation)
                            const updatedVariations = [...(targetBlock.variations || []), ...validBlocks];
                            // CRITICAL: Recalculate Root Health immediately
                            const healthStats = aggregateConceptHealth({ ...targetBlock, variations: updatedVariations }, updatedVariations);

                            updatedBlock = {
                                ...targetBlock,
                                variations: updatedVariations,
                                srs: {
                                    ...(targetBlock.srs || {}),
                                    ...healthStats // SPREAD FIX: Spread healthStats to ensure entityId is included
                                }
                            };
                        }
                        
                        const newBlocks = [...page.blocks];
                        newBlocks[blockIndex] = updatedBlock;
                        await db.pages.update(pageId, { blocks: newBlocks } as any);
                    }
                }
            });

            onBlockAdded();
            onClose();

        } catch (e) {
            setError((e as Error).message);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
                
                {/* Lab Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center space-x-2 text-indigo-700">
                        <Microscope className="w-5 h-5" />
                        <h2 className="font-bold text-lg tracking-tight">Automation Studio <span className="text-slate-400 font-normal text-sm ml-2">v.BioSynthetic</span></h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-0 overflow-y-auto bg-slate-50/50">
                    
                    {/* --- STEP 1: DIAGNOSE (Visualizing the Organism) --- */}
                    {step === 'diagnose' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            
                            {/* DNA Visualization Card */}
                            <div className="bg-white m-6 p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                            <Dna className="w-3 h-3" />
                                            Concept Genome Sequence
                                        </div>
                                        <h3 className="text-2xl font-bold text-slate-800 font-display">{genome.name}</h3>
                                        <code className="text-xs text-indigo-500 font-mono mt-1 block bg-indigo-50 px-2 py-1 rounded w-fit">
                                            ID: {genome.entityId}
                                        </code>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Organism Health</div>
                                        <div className={`flex items-center justify-end space-x-2 ${genome.isHealthy ? 'text-emerald-600' : 'text-amber-500'}`}>
                                            <Activity className="w-5 h-5" />
                                            <span className="font-bold text-lg">{genome.isHealthy ? 'Stable' : 'Volatile'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* The Variation Matrix (Improved from Bar Chart) */}
                                <div className="mb-4">
                                     <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                                        <span className="font-bold uppercase tracking-wider">Variation Matrix</span>
                                        <span>Total: {genome.totalExercises}</span>
                                     </div>
                                     <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {genome.sequence.map((gene, idx) => (
                                            <div 
                                                key={idx}
                                                className={`
                                                    relative p-3 rounded-lg border flex flex-col justify-between h-20 transition-all
                                                    ${gene.status === 'stable' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 
                                                      gene.status === 'volatile' ? 'bg-amber-50 border-amber-100 text-amber-900' : 
                                                      'bg-slate-50 border-slate-200 text-slate-600'}
                                                `}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-center gap-1.5 font-bold text-xs uppercase opacity-80">
                                                        {getBlockIcon(gene.type)}
                                                        <span>Lvl {gene.level}</span>
                                                    </div>
                                                    <div className={`w-2 h-2 rounded-full ${gene.status === 'stable' ? 'bg-emerald-500' : gene.status === 'volatile' ? 'bg-amber-500' : 'bg-slate-300'}`}></div>
                                                </div>
                                                
                                                <div className="text-[10px] font-mono opacity-70 mt-auto">
                                                    Stability: {gene.stability.toFixed(1)}d
                                                </div>
                                            </div>
                                        ))}
                                     </div>
                                </div>
                                <div className="text-[10px] text-slate-400 text-center italic">
                                    Each card represents a distinct variation of this concept in the database.
                                </div>
                            </div>

                            {/* Protocols (Actions) */}
                            <div className="px-6 pb-6">
                                <div className="flex justify-between items-end mb-4">
                                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                        <Sliders className="w-4 h-4" />
                                        Engineering Protocols
                                    </h4>
                                    
                                    {/* QUANTITY SELECTOR (Only relevant for augment mode) */}
                                    {mode === 'augment' && (
                                        <div className="flex items-center space-x-1 bg-slate-100 rounded-lg p-1 border border-slate-200">
                                            <Hash className="w-3 h-3 text-slate-400 ml-1 mr-1" />
                                            {[1, 3, 5].map(num => (
                                                <button
                                                    key={num}
                                                    onClick={() => setGenerationCount(num as any)}
                                                    className={`
                                                        px-2 py-0.5 text-xs font-bold rounded-md transition-all
                                                        ${generationCount === num 
                                                            ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' 
                                                            : 'text-slate-500 hover:text-slate-800'}
                                                    `}
                                                >
                                                    x{num}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                
                                {mode === 'repair' ? (
                                    /* REPAIR MODE UI */
                                    <button 
                                        onClick={() => handleGeneratePrompt('repair')}
                                        className="relative overflow-hidden group p-5 rounded-xl border-2 border-rose-200 bg-white hover:border-rose-500 hover:shadow-md transition-all text-left w-full"
                                    >
                                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Activity className="w-24 h-24 text-rose-500" />
                                        </div>
                                        <div className="relative z-10">
                                            <div className="flex items-center space-x-2 mb-2 text-rose-600">
                                                <div className="p-1.5 bg-rose-100 rounded-md"><RefreshCw className="w-5 h-5" /></div>
                                                <span className="font-bold text-sm uppercase tracking-wide">Protocol: Reconstruction</span>
                                            </div>
                                            <h5 className="font-bold text-slate-900 mb-1">Repair & Regenerate</h5>
                                            <p className="text-xs text-slate-500 leading-relaxed">
                                                Analyze the corrupted or unsatisfactory block structure. Synthesize a pristine, valid replacement while preserving the original learning intent.
                                            </p>
                                        </div>
                                    </button>
                                ) : (
                                    /* AUGMENT MODE UI */
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        
                                        {/* Lateral Protocol */}
                                        <button 
                                            onClick={() => handleGeneratePrompt('variation')}
                                            className="relative overflow-hidden group p-5 rounded-xl border-2 border-slate-200 bg-white hover:border-indigo-500 hover:shadow-md transition-all text-left"
                                        >
                                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                                <GitBranch className="w-24 h-24 text-indigo-500" />
                                            </div>
                                            <div className="relative z-10">
                                                <div className="flex items-center space-x-2 mb-2 text-indigo-600">
                                                    <div className="p-1.5 bg-indigo-100 rounded-md"><GitBranch className="w-5 h-5" /></div>
                                                    <span className="font-bold text-sm uppercase tracking-wide">Protocol: Expand</span>
                                                </div>
                                                <h5 className="font-bold text-slate-900 mb-1">Lateral Variation</h5>
                                                <p className="text-xs text-slate-500 leading-relaxed">
                                                    Clone current complexity. Generate {generationCount} alternative scenario{generationCount > 1 ? 's' : ''} to reinforce stability at <strong className="text-indigo-600">Level {genome.maxLevel}</strong>.
                                                </p>
                                            </div>
                                        </button>

                                        {/* Vertical Protocol */}
                                        <button 
                                            onClick={() => handleGeneratePrompt('evolution')}
                                            className="relative overflow-hidden group p-5 rounded-xl border-2 border-slate-200 bg-white hover:border-amber-500 hover:shadow-md transition-all text-left"
                                        >
                                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                                <ArrowUpCircle className="w-24 h-24 text-amber-500" />
                                            </div>
                                            <div className="relative z-10">
                                                <div className="flex items-center space-x-2 mb-2 text-amber-600">
                                                    <div className="p-1.5 bg-amber-100 rounded-md"><Layers className="w-5 h-5" /></div>
                                                    <span className="font-bold text-sm uppercase tracking-wide">Protocol: Evolve</span>
                                                </div>
                                                <h5 className="font-bold text-slate-900 mb-1">Vertical Integration (N+1)</h5>
                                                <p className="text-xs text-slate-500 leading-relaxed">
                                                    Synthesize {generationCount} variation{generationCount > 1 ? 's' : ''} at <strong className="text-amber-600">Level {genome.maxLevel + 1}</strong>. Explicitly integrates traits from previous levels.
                                                </p>
                                            </div>
                                        </button>

                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- STEP 2: PROTOCOL (Copying the Prompt) --- */}
                    {step === 'protocol' && (
                        <div className="p-6 animate-in fade-in slide-in-from-right-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                    <Check className="w-5 h-5 text-emerald-500" />
                                    Blueprint Generated
                                </h3>
                                {mode === 'augment' && (
                                    <div className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded">
                                        Batch Size: {generationCount}
                                    </div>
                                )}
                            </div>

                            <div className="bg-slate-800 rounded-xl p-4 shadow-inner mb-6 relative group">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-t-xl"></div>
                                <textarea 
                                    readOnly
                                    value={generatedPrompt}
                                    className="w-full h-64 bg-transparent text-slate-300 font-mono text-xs resize-none focus:outline-none"
                                />
                                <button 
                                    onClick={handleCopy}
                                    className="absolute bottom-4 right-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md px-4 py-2 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all"
                                >
                                    {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                    <span>{isCopied ? 'Copied to Clipboard' : 'Copy Blueprint'}</span>
                                </button>
                            </div>

                            <div className="flex justify-between items-center">
                                <button onClick={() => setStep('diagnose')} className="text-slate-500 hover:text-slate-800 text-sm font-medium px-4">
                                    Cancel
                                </button>
                                <button 
                                    onClick={() => setStep('synthesis')}
                                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-indigo-700 flex items-center space-x-2 shadow-lg shadow-indigo-200 transition-transform active:scale-95"
                                >
                                    <span>Proceed to Synthesis</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* --- STEP 3: SYNTHESIS (Ingesting JSON) --- */}
                    {step === 'synthesis' && (
                        <div className="p-6 animate-in fade-in slide-in-from-right-4">
                             <div className="mb-4">
                                <h3 className="font-bold text-slate-900 mb-1">Synthesis Input</h3>
                                <p className="text-xs text-slate-500">Paste the JSON sequence returned by the AI agent to begin integration.</p>
                             </div>

                            <div className="relative mb-6">
                                <textarea 
                                    autoFocus
                                    value={jsonInput}
                                    onChange={(e) => setJsonInput(e.target.value)}
                                    placeholder='{ "blocks": [ ... ] }'
                                    className={`w-full h-64 p-4 font-mono text-xs border-2 rounded-xl resize-none focus:outline-none transition-all shadow-sm bg-white text-slate-900 ${error ? 'border-rose-300 bg-rose-50 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-500'}`}
                                />
                                {error && (
                                    <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur border border-rose-200 text-rose-700 p-3 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm animate-shake">
                                        <AlertCircle className="w-4 h-4" />
                                        {error}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between pt-2">
                                <button onClick={() => setStep('protocol')} className="text-slate-500 hover:text-slate-800 text-sm font-medium px-4">
                                    Back
                                </button>
                                <button 
                                    onClick={handleIngest}
                                    disabled={!jsonInput.trim()}
                                    className="bg-emerald-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    <span>{mode === 'repair' ? 'Reconstruct Block' : `Synthesize ${generationCount} Block${generationCount > 1 ? 's' : ''}`}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
