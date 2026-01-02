
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, ArrowRight, Sparkles, Tag, Plus, ChevronRight, Search, Zap, Layers, Map, ListTodo, Flame, BookOpen, PenTool, Target, ShieldAlert, Rocket, Hash, FolderTree, ChevronDown } from 'lucide-react';
import { SystemContextLoader } from '../services/aiPrompts';
import { db } from '../db';
import { Page, Block, BlockType } from '../types';
import { useLiveQuery } from 'dexie-react-hooks';

// Data structure passed from Command Center
export interface MissionConfig {
    title: string;
    type: 'REPAIR' | 'EVOLUTION' | 'SYNTHESIS';
    reason: string;
    items: { pageTitle: string; block: Block }[];
}

interface PageAIModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPageCreated: (pageId: string) => void;
    // Standard Mode
    initialTopic?: string;
    initialContext?: string;
    initialBlueprint?: string;
    // Mission Mode (Command Center)
    missionConfig?: MissionConfig; 
}

type Step = 'input' | 'transport' | 'ingest';
type Mode = 'lesson' | 'curriculum' | 'mission';

export const PageAIModal: React.FC<PageAIModalProps> = ({ isOpen, onClose, onPageCreated, initialTopic, initialContext, initialBlueprint, missionConfig }) => {
    const [step, setStep] = useState<Step>('input');
    const [mode, setMode] = useState<Mode>('lesson');
    
    const [topic, setTopic] = useState('');
    const [tagInput, setTagInput] = useState('');
    const [instructions, setInstructions] = useState(''); // Blueprint Details
    
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [jsonInput, setJsonInput] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const tagInputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && 
                tagInputRef.current && !tagInputRef.current.contains(event.target as Node)) {
                setIsTagDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Effect to handle pre-fill & Mode Switching
    useEffect(() => {
        if (isOpen) {
            setStep('input'); // ALWAYS start at input to allow refinement
            setError(null);
            setJsonInput('');
            setIsTagDropdownOpen(false);

            if (missionConfig) {
                // --- MISSION MODE ---
                setMode('mission');
                setTopic(missionConfig.title);
                
                // Extract context tags from the items
                const domains = Array.from(new Set(missionConfig.items.map(i => {
                    const tag = i.block.srs?.entityId.split('.')[1]; // e.g. concept.physics.gravity -> physics
                    return tag ? tag.charAt(0).toUpperCase() + tag.slice(1) : 'General';
                })));
                setTagInput(domains.join('/'));

                // Pre-fill Instructions (The Strategy) but allow edit
                setInstructions(`STRATEGIC GOAL: ${missionConfig.reason}\n\nFOCUS: Create a cohesive session that integrates these specific concepts.`);
            } else {
                // --- STANDARD MODE ---
                setMode('lesson');
                setTopic(initialTopic || '');
                setInstructions(initialBlueprint || '');
                
                if (initialContext) {
                    setTagInput(initialContext);
                } else {
                    setTagInput('');
                }
            }
        }
    }, [isOpen, initialTopic, initialContext, initialBlueprint, missionConfig]);

    // Fetch ALL existing unique tags
    const existingTags = useLiveQuery(async () => {
        const pages = await db.pages.toArray();
        const tags = new Set<string>();
        pages.forEach(p => p.tags?.forEach(t => tags.add(t)));
        return Array.from(tags).sort();
    }, []);

    // Filter suggestions
    const filteredTags = useMemo(() => {
        if (!existingTags) return [];
        if (!tagInput.trim()) return existingTags.slice(0, 10); 
        return existingTags.filter(t => t.toLowerCase().includes(tagInput.toLowerCase())).slice(0, 10);
    }, [existingTags, tagInput]);

    if (!isOpen) return null;

    const handleGeneratePrompt = () => {
        if (!topic.trim()) return;
        
        const tags = tagInput.trim() ? [tagInput.trim()] : [];
        
        let prompt = '';

        if (mode === 'mission' && missionConfig) {
            // Use the sophisticated Review Session Prompt
            prompt = SystemContextLoader.generateReviewSessionPrompt({
                topic: topic,
                items: missionConfig.items, // Pass the specific items
                strategy: missionConfig.type,
                reason: instructions // Use the USER EDITED instructions as the reason/context
            });
        } else if (mode === 'curriculum') {
            prompt = SystemContextLoader.generateCurriculumPrompt(topic, tags, instructions);
        } else {
            prompt = SystemContextLoader.generatePagePrompt(topic, tags, instructions);
        }

        setGeneratedPrompt(prompt);
        setStep('transport');
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
                throw new Error("Invalid JSON format. Please paste only the JSON object.");
            }

            if (!parsed.blocks || !Array.isArray(parsed.blocks)) {
                throw new Error("JSON must contain a 'blocks' array.");
            }

            const newPage: Page = {
                id: `page-${crypto.randomUUID()}`,
                title: parsed.title || topic,
                tags: Array.from(new Set([tagInput.trim(), ...(parsed.tags || [])])).filter(Boolean),
                createdAt: Date.now(),
                updatedAt: Date.now(),
                recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map((r: any) => ({
                    id: `rec-${crypto.randomUUID()}`,
                    title: r.title,
                    type: r.type,
                    context: r.context
                })) : undefined,
                blocks: parsed.blocks.map((b: any) => {
                    const block = {
                        ...b,
                        id: b.id || crypto.randomUUID(),
                        type: Object.values(BlockType).includes(b.type) ? b.type : BlockType.UNKNOWN
                    };
                    if (block.srs) {
                        block.srs = {
                            ...block.srs,
                            // CRITICAL DEFENSIVE FIX: Ensure entityId is generated if missing
                            entityId: block.srs.entityId || `gen.${crypto.randomUUID()}`,
                            level: block.srs.level || 1, 
                            repetitionCount: 0,
                            stability: 0,
                            masteryScore: 0,
                            integratedLevels: block.srs.integratedLevels || [],
                            // INIT DUE DATE: Ensure new items are immediately visible in Strategy
                            nextReviewDue: Date.now()
                        };
                    }
                    return block;
                })
            };

            await db.pages.add(newPage);
            onPageCreated(newPage.id);
            onClose();
            // Reset
            setStep('input');
            setTopic('');
            setJsonInput('');
            setTagInput('');
            setInstructions('');
            setMode('lesson');

        } catch (e) {
            setError((e as Error).message);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedPrompt);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    // TEMPLATE HANDLER
    const applyTemplate = (templateMode: Mode, presetTag: string, prefix: string, blueprint: string) => {
        setMode(templateMode);
        setTagInput(presetTag);
        setTopic(prefix);
        setInstructions(blueprint); 
        setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 50);
    };

    // --- RENDER VIA PORTAL ---
    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[95vh] border border-slate-200 relative">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center space-x-2 text-indigo-700">
                        <Sparkles className="w-5 h-5" />
                        <h2 className="font-bold text-lg">AI Architect</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar bg-white">
                    
                    {/* Stepper */}
                    <div className="flex items-center justify-between mb-8 text-sm font-medium text-gray-400">
                        <span className={step === 'input' ? 'text-indigo-600 font-bold' : ''}>1. Design Blueprint</span>
                        <div className="h-px bg-gray-200 flex-1 mx-4"></div>
                        <span className={step === 'transport' ? 'text-indigo-600 font-bold' : ''}>2. Generate Prompt</span>
                        <div className="h-px bg-gray-200 flex-1 mx-4"></div>
                        <span className={step === 'ingest' ? 'text-indigo-600 font-bold' : ''}>3. Build Lesson</span>
                    </div>

                    {step === 'input' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            
                            {/* MODE SWITCHER (Hidden in Mission Mode) */}
                            {mode !== 'mission' && (
                                <div className="grid grid-cols-2 gap-3 p-1 bg-gray-100 rounded-lg">
                                    <button 
                                        onClick={() => setMode('lesson')}
                                        className={`flex items-center justify-center space-x-2 py-2 rounded-md text-sm font-bold transition-all ${mode === 'lesson' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        <Layers className="w-4 h-4" />
                                        <span>Single Lesson</span>
                                    </button>
                                    <button 
                                        onClick={() => setMode('curriculum')}
                                        className={`flex items-center justify-center space-x-2 py-2 rounded-md text-sm font-bold transition-all ${mode === 'curriculum' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        <Map className="w-4 h-4" />
                                        <span>Course Structure</span>
                                    </button>
                                </div>
                            )}

                            {/* --- 1. TOPIC & DOMAIN (High Fidelity) --- */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-gray-700">Topic</label>
                                    <input 
                                        ref={inputRef}
                                        autoFocus
                                        type="text" 
                                        value={topic}
                                        onChange={(e) => setTopic(e.target.value)}
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:border-indigo-500 outline-none transition-all bg-white text-gray-900 font-medium"
                                        placeholder="e.g. Quantum Mechanics"
                                    />
                                </div>
                                <div className="space-y-2 relative">
                                    <label className="block text-sm font-bold text-gray-700 flex justify-between items-center">
                                        <span>Knowledge Domain</span>
                                        <span className="text-[10px] text-gray-400 font-normal bg-gray-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                            <FolderTree className="w-3 h-3" />
                                            Hierarchy Supported
                                        </span>
                                    </label>
                                    <div className="relative group">
                                        <input 
                                            ref={tagInputRef}
                                            type="text"
                                            value={tagInput}
                                            onChange={(e) => {
                                                setTagInput(e.target.value);
                                                setIsTagDropdownOpen(true);
                                            }}
                                            onFocus={() => setIsTagDropdownOpen(true)}
                                            placeholder="e.g. Science/Physics/Thermodynamics"
                                            className="w-full p-3 pl-9 border border-gray-200 rounded-lg focus:border-indigo-500 outline-none bg-white text-gray-900 transition-all focus:ring-4 focus:ring-indigo-500/10"
                                        />
                                        <Hash className="w-4 h-4 text-gray-400 absolute left-3 top-3.5 group-focus-within:text-indigo-500 transition-colors" />
                                        
                                        {/* Tag Dropdown */}
                                        {isTagDropdownOpen && filteredTags.length > 0 && (
                                            <div ref={dropdownRef} className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                                                <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 bg-gray-50/50">
                                                    Existing Domains
                                                </div>
                                                {filteredTags.map((tag, idx) => (
                                                    <button
                                                        key={`${tag}-${idx}`}
                                                        onClick={() => {
                                                            setTagInput(tag);
                                                            setIsTagDropdownOpen(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 text-sm text-gray-700 flex items-center gap-2 group transition-colors"
                                                    >
                                                        <Tag className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-500" />
                                                        <span className="group-hover:text-indigo-900">{tag}</span>
                                                        {tag.includes('/') && (
                                                            <span className="ml-auto text-[10px] text-gray-400 bg-white border border-gray-100 px-1.5 py-0.5 rounded">
                                                                Path
                                                            </span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1 pl-1">
                                        Organize contents by path (Use '/' to separate levels).
                                    </p>
                                </div>
                            </div>

                            {/* --- 2. MISSION REQUIREMENTS (Mission Mode Only) --- */}
                            {mode === 'mission' && missionConfig && (
                                <div className="bg-white border border-indigo-100 rounded-xl p-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-3 text-indigo-700">
                                        <Target className="w-4 h-4" />
                                        <span className="text-xs font-bold uppercase tracking-wider">Required Mission Outcomes</span>
                                    </div>
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                        {missionConfig.items.map((item, idx) => {
                                            const currentLvl = item.block.srs?.level || 1;
                                            const isRepair = missionConfig.type === 'REPAIR';
                                            const targetLvl = isRepair ? currentLvl : currentLvl + 1;
                                            
                                            return (
                                                <div key={idx} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isRepair ? 'bg-rose-500' : 'bg-indigo-500'}`}></div>
                                                        <span className="text-xs font-medium text-gray-700 truncate">{item.block.srs?.name || "Concept"}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[10px] font-mono font-bold">
                                                        <span className="text-gray-400">Lvl {currentLvl}</span>
                                                        <ArrowRight className="w-3 h-3 text-gray-300" />
                                                        <span className={isRepair ? 'text-rose-600' : 'text-emerald-600'}>
                                                            {isRepair ? 'Reinforce' : `Lvl ${targetLvl}`}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* --- 3. BLUEPRINT DETAILS (INSTRUCTIONS) --- */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                                        <PenTool className="w-4 h-4 text-indigo-600" />
                                        <span>Blueprint Details (Instructions)</span>
                                    </label>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Essential for AI</span>
                                </div>
                                <p className="text-xs text-gray-500">
                                    Tell the AI exactly what structure, tone, or specific problem types you want.
                                </p>
                                <textarea 
                                    value={instructions}
                                    onChange={(e) => setInstructions(e.target.value)}
                                    placeholder="e.g. 'Use only Socratic questions', 'Focus on visual diagrams', 'Create a 10-question quiz', 'Structure as a historical timeline'..."
                                    className="w-full p-4 text-sm border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all bg-white text-gray-700 h-32 resize-none shadow-sm font-mono"
                                />
                            </div>

                            {/* Quick Start Templates (Only Standard Mode) */}
                            {mode !== 'mission' && (
                                <div className="border-t border-gray-100 pt-4">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold mb-3">Quick Templates</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        <button 
                                            onClick={() => applyTemplate('lesson', 'Academic', 'Concept: ', "Focus on Socratic questioning. Start with a paradox.")}
                                            className="flex flex-col items-center justify-center gap-2 p-3 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-amber-50 hover:border-amber-200 transition-all"
                                        >
                                            <BookOpen className="w-5 h-5 text-amber-500" />
                                            <span className="text-xs font-bold">Deep Study</span>
                                        </button>
                                        <button 
                                            onClick={() => applyTemplate('curriculum', '', 'Course: ', "Create a 3-Level Course Map. Focus on linear progression.")}
                                            className="flex flex-col items-center justify-center gap-2 p-3 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all"
                                        >
                                            <Map className="w-5 h-5 text-blue-500" />
                                            <span className="text-xs font-bold">Course Map</span>
                                        </button>
                                        {/* More templates... */}
                                    </div>
                                </div>
                            )}

                            <div className="text-right pt-2 border-t border-gray-100 mt-6">
                                <button 
                                    onClick={handleGeneratePrompt}
                                    disabled={!topic.trim()}
                                    className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 ml-auto shadow-lg shadow-indigo-200 hover:-translate-y-0.5"
                                >
                                    <Sparkles className="w-5 h-5" />
                                    <span>Generate Blueprint</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'transport' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm mb-4 flex items-start space-x-3">
                                <div className="mt-0.5"><Sparkles className="w-4 h-4" /></div>
                                <div>
                                    <strong>Ready to Transport:</strong> Copy this prompt to your LLM (ChatGPT/Claude).
                                    {tagInput && <div className="mt-1 text-xs bg-amber-100 px-2 py-0.5 rounded w-fit font-mono">Context: {tagInput}</div>}
                                </div>
                            </div>
                            <div className="relative group">
                                <textarea 
                                    readOnly
                                    value={generatedPrompt}
                                    className="w-full h-64 p-4 font-mono text-xs bg-gray-50 border border-gray-200 rounded-lg resize-none focus:outline-none text-gray-600"
                                />
                                <button 
                                    onClick={handleCopy}
                                    className="absolute top-2 right-2 bg-white border border-gray-200 shadow-sm px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1 hover:bg-gray-50 text-gray-700 transition-all"
                                >
                                    {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                    <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                                </button>
                            </div>
                            <div className="flex justify-between">
                                <button onClick={() => setStep('input')} className="text-gray-500 hover:text-gray-900 text-sm font-bold">Back to Design</button>
                                <button 
                                    onClick={() => setStep('ingest')}
                                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 flex items-center space-x-2"
                                >
                                    <span>I have the JSON</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'ingest' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                            <label className="block text-sm font-medium text-gray-700">Paste the AI response here:</label>
                            <textarea 
                                autoFocus
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                placeholder='{ "blocks": [ ... ] }'
                                className={`w-full h-64 p-4 font-mono text-xs border-2 rounded-lg resize-none focus:outline-none transition-all bg-white text-gray-900 ${error ? 'border-rose-300 bg-rose-50 focus:border-rose-500' : 'border-gray-200 focus:border-indigo-500'}`}
                            />
                            {error && (
                                <div className="text-rose-600 text-sm flex items-center space-x-2 bg-rose-50 p-3 rounded border border-rose-100">
                                    <X className="w-4 h-4" />
                                    <span>{error}</span>
                                </div>
                            )}
                            <div className="flex justify-between pt-2">
                                <button onClick={() => setStep('transport')} className="text-gray-500 hover:text-gray-900 text-sm font-bold">Back</button>
                                <button 
                                    onClick={handleIngest}
                                    disabled={!jsonInput.trim()}
                                    className="bg-emerald-600 text-white px-8 py-2 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-200"
                                >
                                    Build Page
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>,
        document.body
    );
};
