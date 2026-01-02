
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, seedDatabase } from '../db';
import { Page, Block, BlockState, BlockType, StudySession, StudyCheckpoint } from '../types';
import SafeBlockRenderer from './SafeBlockRenderer';
import { Loader2, Plus, Sparkles, Play, Pause, RotateCcw, ArrowUp, ArrowDown, Trash2, RefreshCw, Repeat, ArrowRight, Zap, Lightbulb, MoreHorizontal, Copy, Download, FileJson, Eye, PenTool, CheckCircle, Clock, Bot, Lock, Calendar, Hourglass, Map, LayoutDashboard, Footprints, Timer as TimerIcon } from 'lucide-react';
import { AIAutomationModal } from './AIAutomationModal';
import { LessonClosure } from './LessonClosure';
import { ExternalTutorModal } from './ExternalTutorModal';
import { PageRetrievalGate } from './PageRetrievalGate';
import { useTime } from '../contexts/TimeContext';
import { calculatePageLifecycle } from '../utils/learning';

interface EditorProps {
    pageId: string | null;
    onPageCreated: (id: string) => void;
    onOpenAI: (initialTopic?: string, initialContext?: string, initialBlueprint?: string, onCreated?: (pageId: string) => Promise<void>) => void; 
    onClose?: () => void;
}

// --- SUB-COMPONENT: REAL-TIME SESSION TRACKER ---
const SessionTracker: React.FC<{ 
    startTime: number; 
    checkpoints: number; 
    isActive: boolean;
    onToggle: () => void;
}> = ({ startTime, checkpoints, isActive, onToggle }) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        let interval: any;
        if (isActive) {
            // Calculate elapsed time based on StartTime to avoid drift
            interval = setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isActive, startTime]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`flex items-center gap-3 px-3 py-1.5 rounded-full border transition-all duration-500 ${isActive ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-gray-200'}`}>
            <div className={`p-1.5 rounded-full ${isActive ? 'bg-indigo-100 text-indigo-600 animate-pulse' : 'bg-gray-100 text-gray-400'}`}>
                <TimerIcon className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
                <span className={`text-xs font-mono font-bold leading-none ${isActive ? 'text-indigo-700' : 'text-gray-500'}`}>
                    {formatTime(elapsed)}
                </span>
                <span className="text-[9px] font-bold text-gray-400 leading-none uppercase tracking-wider">
                    {checkpoints} CP
                </span>
            </div>
            <button onClick={onToggle} className="ml-1 p-1 hover:bg-gray-200 rounded-full text-gray-400 transition-colors">
                {isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
        </div>
    );
};

// --- SUB-COMPONENT: PAGE FOOTER (Globalized Actions) ---
const PageFooter: React.FC<{
    page: Page;
    onOpenAI: (initialTopic?: string, initialContext?: string, initialBlueprint?: string) => void;
    isBuilderMode?: boolean;
    className?: string;
}> = ({ page, onOpenAI, isBuilderMode = false, className = '' }) => {
    return (
        <div className={`w-full max-w-3xl mx-auto ${className}`}>
            
            {/* 1. Continue Action (Builder or Explicit Request) */}
            <div className="mb-12 pt-8 border-t border-gray-200 text-center">
                <button 
                    onClick={() => onOpenAI()}
                    className="group text-gray-400 hover:text-indigo-600 transition-colors flex items-center justify-center mx-auto space-x-2 text-sm font-medium p-4 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100"
                >
                    <div className="p-2 bg-gray-100 rounded-full group-hover:bg-indigo-50 transition-colors">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <span>{isBuilderMode ? "Continue building with AI..." : "Expand this lesson with AI..."}</span>
                </button>
            </div>

            {/* 2. Recommendations Engine */}
            {page.recommendations && page.recommendations.length > 0 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex items-center justify-center gap-2 mb-6 opacity-60">
                        <div className="h-px bg-gray-300 w-12"></div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <Footprints className="w-3 h-3" />
                            Suggested Path
                        </h4>
                        <div className="h-px bg-gray-300 w-12"></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {page.recommendations.map(rec => (
                            <button 
                                key={rec.id}
                                onClick={() => {
                                    const blueprint = `CONTEXT: Continuation of "${page.title}". TYPE: "${rec.type}". GOAL: Create a seamless transition. ${rec.context || ''}`;
                                    onOpenAI(rec.title, rec.context, blueprint);
                                }}
                                className="group relative p-5 rounded-2xl border transition-all shadow-sm hover:shadow-md hover:-translate-y-1 text-left bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 h-full flex flex-col"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 bg-gray-100 px-2 py-1 rounded group-hover:bg-indigo-50">{rec.type}</span>
                                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
                                </div>
                                <div className="font-bold text-sm leading-tight group-hover:underline decoration-2 underline-offset-2 mb-2">
                                    {rec.title}
                                </div>
                                <div className="mt-auto text-xs text-gray-400 font-medium line-clamp-2">
                                    {rec.context}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- SUB-COMPONENT: INCUBATION VIEW (The "Locked" Screen & Hub) ---
const IncubationView: React.FC<{ 
    page: Page; 
    nextReview: number;
    onNavigateHub?: () => void;
    onOpenAI: (topic?: string, context?: string, blueprint?: string) => void;
}> = ({ page, nextReview, onNavigateHub, onOpenAI }) => {
    const unlockDate = new Date(nextReview);
    const dateString = unlockDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    const timeString = unlockDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    return (
        // SCROLL FIX: Use h-screen + overflow-y-auto on outer wrapper, then min-h-full on inner to center content but allow growth
        <div className="flex-1 h-screen overflow-y-auto bg-gray-50">
            <div className="min-h-full flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
                <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl border border-indigo-50 overflow-hidden text-center relative mb-12 flex-shrink-0">
                    
                    {/* Decorative Header */}
                    <div className="h-32 bg-gradient-to-br from-slate-900 to-indigo-900 relative overflow-hidden flex items-center justify-center">
                        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-400 to-transparent"></div>
                        <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-lg relative z-10">
                            <Hourglass className="w-10 h-10 text-indigo-200 animate-pulse" />
                        </div>
                    </div>

                    <div className="p-10">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Neural Incubation</h2>
                        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                            Great work on <strong>Chapter {page.cycle?.chapter || 1}</strong>. <br/>
                            The content is now locked to allow your brain to consolidate these concepts. 
                        </p>

                        {/* The Due Date Card */}
                        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mb-8">
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Next Evolution Available</span>
                                <div className="flex items-center gap-2 text-indigo-900 mt-1">
                                    <Calendar className="w-5 h-5" />
                                    <span className="text-xl font-bold">{dateString}</span>
                                </div>
                                <div className="text-indigo-600 font-medium text-sm">
                                    at {timeString}
                                </div>
                            </div>
                        </div>

                        {/* Navigation Actions */}
                        <div className="grid grid-cols-1 gap-3 mb-6">
                            <button 
                                onClick={onNavigateHub}
                                className="bg-white border-2 border-indigo-100 text-indigo-700 p-3 rounded-xl font-bold text-sm hover:border-indigo-200 hover:bg-indigo-50 transition-colors flex flex-col items-center gap-2"
                            >
                                <Map className="w-5 h-5" />
                                <span>Return to Hub</span>
                            </button>
                        </div>

                        <div className="flex justify-center">
                            <button disabled className="flex items-center space-x-2 text-gray-400 text-sm font-medium px-4 py-2 rounded-full bg-gray-100 cursor-not-allowed">
                                <Lock className="w-3.5 h-3.5" />
                                <span>Content Locked</span>
                            </button>
                        </div>
                    </div>
                    
                    {/* Progress Bar Visual */}
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-100">
                        <div className="h-full bg-indigo-500 w-1/3 animate-pulse"></div>
                    </div>
                </div>

                {/* Global Footer in Incubation Mode - Now reachable via scroll */}
                <PageFooter 
                    page={page} 
                    onOpenAI={onOpenAI} 
                    isBuilderMode={false} 
                />
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: PAGE OPTIONS MENU ---
const PageOptionsMenu: React.FC<{ page: Page, onPageCreated: (id: string) => void, onClose: () => void }> = ({ page, onPageCreated, onClose }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDuplicate = async () => {
        const newPage: Page = {
            ...page,
            id: `copy-${crypto.randomUUID()}`,
            title: `${page.title} (Copy)`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            blocks: page.blocks.map(b => ({
                ...b,
                id: crypto.randomUUID(), // New Block IDs
                srs: b.srs ? { ...b.srs, repetitionCount: 0, stability: 0, masteryScore: 0, lastReviewed: undefined } : undefined,
                state: undefined // Reset state
            })),
            cycle: undefined // Reset cycle
        };
        await db.pages.add(newPage);
        onPageCreated(newPage.id);
        setIsOpen(false);
    };

    const handleResetProgress = async () => {
        if (!confirm("Reset learning progress for this page? This cannot be undone.")) return;
        
        // Recursive helper to reset blocks AND their variations
        const resetBlockRecursive = (b: Block): Block => {
            // Clean SRS data if it exists
            const newSrs = b.srs ? { 
                ...b.srs, 
                repetitionCount: 0, 
                stability: 0, 
                difficulty: 0, 
                masteryScore: 0, 
                lastReviewed: undefined, 
                nextReviewDue: undefined 
            } : undefined;

            return {
                ...b,
                srs: newSrs,
                state: undefined, // WIPE STATE COMPLETELY
                variations: b.variations ? b.variations.map(resetBlockRecursive) : undefined
            };
        };

        const newBlocks = page.blocks.map(resetBlockRecursive);

        // Update updatedAt to force reactivity
        await db.pages.update(page.id, { 
            blocks: newBlocks,
            updatedAt: Date.now(),
            cycle: undefined // Reset cycle
        } as any);
        
        setIsOpen(false);
    };

    const handleExportJSON = () => {
        const dataStr = JSON.stringify(page, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${page.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsOpen(false);
    };

    const handleDelete = async () => {
        if (confirm("Are you sure you want to delete this page? This action is permanent.")) {
            await db.pages.delete(page.id);
            onClose(); 
        }
    };

    return (
        <div className="relative" ref={menuRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2 rounded-lg transition-colors ${isOpen ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}
                title="Page Options"
            >
                <MoreHorizontal className="w-5 h-5" />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-3 py-2 border-b border-gray-100 mb-1">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Page Actions</div>
                    </div>
                    
                    <button onClick={handleDuplicate} className="w-full text-left px-3 py-2 flex items-center space-x-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-colors">
                        <Copy className="w-4 h-4" />
                        <span>Duplicate Page</span>
                    </button>

                    <button onClick={handleResetProgress} className="w-full text-left px-3 py-2 flex items-center space-x-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-amber-600 transition-colors">
                        <RotateCcw className="w-4 h-4" />
                        <span>Reset Progress</span>
                    </button>

                    <button onClick={handleExportJSON} className="w-full text-left px-3 py-2 flex items-center space-x-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-colors">
                        <Download className="w-4 h-4" />
                        <span>Export JSON</span>
                    </button>

                    <div className="my-1 border-t border-gray-100"></div>

                    <button onClick={handleDelete} className="w-full text-left px-3 py-2 flex items-center space-x-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors">
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Page</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export const Editor: React.FC<EditorProps> = ({ pageId, onPageCreated, onOpenAI, onClose }) => {
    const { virtualNow } = useTime();
    
    // Automation Studio State
    const [automationBlock, setAutomationBlock] = useState<Block | null>(null);
    const [automationMode, setAutomationMode] = useState<'augment' | 'repair'>('augment');
    
    // External Tutor Modal State
    const [showExternalTutor, setShowExternalTutor] = useState(false);

    // UI Modes
    const [isBuilderMode, setIsBuilderMode] = useState(false); 

    // Completion State
    const [hasDismissedClosure, setHasDismissedClosure] = useState(false);
    const isFirstLoad = useRef(true);

    // --- REAL TIME SESSION STATE ---
    const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());
    const [sessionCheckpoints, setSessionCheckpoints] = useState<StudyCheckpoint[]>([]);
    const [isSessionActive, setIsSessionActive] = useState(true);
    const [showSessionStartToast, setShowSessionStartToast] = useState(false);
    
    // Checkpoint Tracker
    const completedBlockIdsRef = useRef<Set<string>>(new Set());

    // Initial Seed
    useEffect(() => {
        const hasCleared = localStorage.getItem('eduforge_has_cleared_data');
        if (!hasCleared) {
            seedDatabase();
        }
    }, []);

    // Handle custom navigation
    useEffect(() => {
        const handleCustomNav = (e: CustomEvent<string>) => {
            onPageCreated(e.detail);
        };
        window.addEventListener('eduforge-navigate', handleCustomNav as EventListener);
        return () => window.removeEventListener('eduforge-navigate', handleCustomNav as EventListener);
    }, [onPageCreated]);

    const page = useLiveQuery(
        () => (pageId ? db.pages.get(pageId) : undefined),
        [pageId, virtualNow]
    );

    // --- SESSION INITIALIZATION & COMPLETION ---
    useEffect(() => {
        if (pageId) {
            // New Page Loaded: Reset Session
            setSessionStartTime(Date.now());
            setSessionCheckpoints([]);
            setIsSessionActive(true);
            setShowSessionStartToast(true);
            setTimeout(() => setShowSessionStartToast(false), 3000);
            completedBlockIdsRef.current = new Set();
        }

        // Cleanup on unmount (Save Session)
        return () => {
            // We can't access state here easily in closure, handled via explicit save function
        };
    }, [pageId]);

    const saveSession = async (isComplete: boolean) => {
        if (!pageId || !page) return;
        const now = Date.now();
        const duration = Math.floor((now - sessionStartTime) / 1000);
        
        // Don't save empty/micro sessions (< 5 sec) unless they have checkpoints
        if (duration < 5 && sessionCheckpoints.length === 0) return;

        const session: StudySession = {
            id: `sess-${crypto.randomUUID()}`,
            pageId: pageId,
            pageTitle: page.title,
            startTime: sessionStartTime,
            endTime: now,
            durationSeconds: duration,
            checkpoints: sessionCheckpoints,
            isComplete
        };

        await db.studySessions.add(session);
    };

    // --- CHECKPOINT DETECTION ---
    useEffect(() => {
        if (!page || !isSessionActive) return;

        // Scan blocks for newly completed ones
        page.blocks.forEach(block => {
            if (block.srs || block.state?.status) { // Only track interactive blocks
                const isDone = block.state?.status === 'correct' || block.state?.status === 'revealed';
                
                if (isDone && !completedBlockIdsRef.current.has(block.id)) {
                    // NEW CHECKPOINT!
                    completedBlockIdsRef.current.add(block.id);
                    const now = Date.now();
                    const checkpoint: StudyCheckpoint = {
                        blockId: block.id,
                        blockType: block.type,
                        timestamp: now,
                        timeOffset: Math.floor((now - sessionStartTime) / 1000)
                    };
                    setSessionCheckpoints(prev => [...prev, checkpoint]);
                }
            }
        });
    }, [page, isSessionActive, sessionStartTime]);


    // --- MASTERY & COMPLETION LOGIC ---
    const stats = useMemo(() => {
        if (!page) return { percentage: 0, learnableCount: 0, isLessonComplete: false };

        const learnableBlocks = page.blocks.filter(b => b.srs);
        const totalMastery = learnableBlocks.reduce((acc, b) => acc + (b.srs?.masteryScore || 0), 0);
        const percentage = learnableBlocks.length > 0 
            ? Math.round(totalMastery / learnableBlocks.length) 
            : 0;

        const isLessonComplete = learnableBlocks.length > 0 && learnableBlocks.every(b => {
            const hasRep = (b.srs?.repetitionCount || 0) > 0;
            const isDoneState = b.state?.status === 'correct' || b.state?.status === 'revealed';
            return hasRep || isDoneState;
        });

        return { percentage, learnableCount: learnableBlocks.length, isLessonComplete };
    }, [page]);

    // --- CYCLE MANAGEMENT & INCUBATION LOGIC ---
    const cycleState = useMemo(() => {
        if (!page || !page.cycle) return 'active';
        if (page.cycle.status === 'locked') {
            if (virtualNow >= page.cycle.nextReview) return 'retrieval_due';
            return 'incubation';
        }
        return 'active';
    }, [page, virtualNow]);

    // --- EFFECT: Handle Closure Display ---
    useEffect(() => {
        setHasDismissedClosure(false);
        isFirstLoad.current = true;
    }, [pageId]);

    useEffect(() => {
        if (page && isFirstLoad.current) {
            // If page is locked (incubating OR due), treat closure as dismissed so we don't show the victory screen again
            if (page.cycle && page.cycle.status !== 'active') {
                setHasDismissedClosure(true); 
            } else if (stats.isLessonComplete) {
                // If complete but active (just finished), let the UI show the closure component inline
                setHasDismissedClosure(false);
            }
            isFirstLoad.current = false;
        }
    }, [page, stats.isLessonComplete]);


    // --- BLOCK MANAGEMENT FUNCTIONS ---
    const deleteBlock = async (blockId: string) => {
        if (!page) return;
        if (confirm("Are you sure you want to delete this block?")) {
            const newBlocks = page.blocks.filter(b => b.id !== blockId);
            await db.pages.update(page.id, { blocks: newBlocks } as any);
        }
    };

    const moveBlock = async (index: number, direction: 'up' | 'down') => {
        if (!page) return;
        const newBlocks = [...page.blocks];
        
        if (direction === 'up') {
            if (index === 0) return; 
            [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
        } else {
            if (index === newBlocks.length - 1) return;
            [newBlocks[index + 1], newBlocks[index]] = [newBlocks[index], newBlocks[index + 1]];
        }
        
        await db.pages.update(page.id, { blocks: newBlocks } as any);
    };

    const openAutomation = (block: Block, mode: 'augment' | 'repair') => {
        setAutomationBlock(block);
        setAutomationMode(mode);
    };

    // --- PAGE CYCLE HANDLERS ---

    const handleLessonClosureComplete = async () => {
        if (!page) return;
        
        // STOP TIMER & SAVE
        setIsSessionActive(false);
        await saveSession(true);

        // SCIENTIFIC FSRS: Calculate Page Next Review based on Aggregate Atomic Health
        // "A chain is only as strong as its weakest link."
        const lifecycle = calculatePageLifecycle(page.blocks, virtualNow);
        
        // 2. Update Page Cycle
        await db.pages.update(page.id, {
            updatedAt: virtualNow,
            cycle: {
                status: lifecycle.status, // might remain active if retention is terrible
                chapter: page.cycle?.chapter || 1,
                nextReview: lifecycle.nextReview,
            }
        } as any);

        // 3. Mark closure dismissed to prevent re-render loop
        setHasDismissedClosure(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleEvolutionComplete = async (newBlocks: Block[], userRecall: string) => {
        if (!page) return;

        const nextChapter = (page.cycle?.chapter || 1) + 1;
        const headerBlock: Block = {
            id: `chap-${nextChapter}`,
            type: BlockType.TEXT,
            variant: 'heading',
            content: `Chapter ${nextChapter}: Evolution`
        };

        const updatedBlocks = [...page.blocks, headerBlock, ...newBlocks];

        // Unlock Page & Increment Chapter
        await db.pages.update(page.id, {
            blocks: updatedBlocks,
            updatedAt: virtualNow,
            cycle: {
                status: 'active',
                chapter: nextChapter,
                nextReview: 0, // Reset
                lastRetrieval: userRecall
            }
        } as any);
    };

    // --- RENDER LOGIC ---

    if (!pageId) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 h-screen text-center p-8">
                <div className="max-w-md">
                    <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Sparkles className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to EduForge</h2>
                    <p className="text-gray-500 mb-8">Select a project from the sidebar or generate a new learning experience using AI.</p>
                    <button 
                        onClick={() => onOpenAI()}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center space-x-2 mx-auto"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Create New with AI</span>
                    </button>
                </div>
            </div>
        );
    }

    if (!page) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 h-screen">
                 <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    // --- STATE 1: RETRIEVAL GATE (The Boss Door) ---
    // If retrieval is due, this BLOCKS everything else.
    if (cycleState === 'retrieval_due') {
        return (
            <PageRetrievalGate 
                pageTitle={page.title}
                currentChapter={page.cycle?.chapter || 1}
                blocks={page.blocks}
                onEvolutionComplete={handleEvolutionComplete}
            />
        );
    }

    // --- STATE 2: STRICT INCUBATION (The Wait) ---
    // If cycle is locked but NOT due yet, show strict waiting screen.
    // This replaces the editor content completely.
    if (cycleState === 'incubation') {
        return (
            <IncubationView 
                page={page} 
                nextReview={page.cycle!.nextReview} 
                onNavigateHub={() => onClose && onClose()}
                onOpenAI={onOpenAI}
            />
        );
    }

    // --- STATE 3: ACTIVE EDITOR ---
    return (
        <div className="flex-1 h-screen overflow-y-auto bg-gray-50 relative">
            
            {/* SESSION TOAST */}
            {showSessionStartToast && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900/90 backdrop-blur text-white px-6 py-3 rounded-full shadow-2xl animate-in slide-in-from-top-4 fade-in duration-500 flex items-center gap-3">
                    <TimerIcon className="w-5 h-5 text-emerald-400 animate-pulse" />
                    <span className="font-bold text-sm tracking-wide">Session Initialized. Timer Active.</span>
                </div>
            )}

            {/* Header / Mastery Track */}
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 md:px-8 py-3 md:py-4 flex flex-col md:flex-row justify-between items-start md:items-center shadow-sm gap-4 md:gap-0">
                <div className="flex-1 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight leading-tight line-clamp-2">{page.title}</h1>
                        {page.cycle && page.cycle.chapter > 1 && (
                            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Ch {page.cycle.chapter}
                            </span>
                        )}
                    </div>
                    <div className="flex space-x-2 mt-1 overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
                        {page.tags?.map(tag => (
                            <span key={tag} className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                                #{tag}
                            </span>
                        ))}
                    </div>
                </div>
                
                {/* Header Actions */}
                <div className="flex items-center justify-between w-full md:w-auto space-x-2 md:space-x-4">
                     
                     <div className="bg-gray-100 p-0.5 rounded-lg flex items-center mr-0 md:mr-4">
                        <button 
                            onClick={() => setIsBuilderMode(false)}
                            className={`px-2 md:px-3 py-1.5 rounded-md text-xs font-bold flex items-center space-x-1 transition-all ${!isBuilderMode ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Study</span>
                        </button>
                        <button 
                            onClick={() => setIsBuilderMode(true)}
                            className={`px-2 md:px-3 py-1.5 rounded-md text-xs font-bold flex items-center space-x-1 transition-all ${isBuilderMode ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <PenTool className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Build</span>
                        </button>
                     </div>

                     {/* REAL-TIME SESSION TRACKER */}
                     <div className="hidden sm:block">
                        <SessionTracker 
                            startTime={sessionStartTime} 
                            checkpoints={sessionCheckpoints.length} 
                            isActive={isSessionActive}
                            onToggle={() => setIsSessionActive(!isSessionActive)} 
                        />
                     </div>

                     <button 
                        onClick={() => setShowExternalTutor(true)}
                        className="p-2 rounded-lg bg-black text-white hover:bg-gray-800 transition-colors shadow-sm flex items-center gap-1 group"
                        title="Fluid Tutor"
                     >
                        <Bot className="w-4 h-4" />
                        <span className="hidden md:inline max-w-0 overflow-hidden group-hover:max-w-xs transition-all text-xs font-bold whitespace-nowrap">AI Tutor</span>
                     </button>
                     
                     <div className="h-8 w-px bg-gray-200 hidden md:block"></div>

                     {/* Mastery */}
                     <div className="flex items-center space-x-2 md:space-x-4">
                         <div className="text-right hidden sm:block">
                             <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Mastery</div>
                             <div className={`font-bold font-mono text-lg leading-none ${stats.percentage === 100 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                 {stats.learnableCount > 0 ? `${stats.percentage}%` : 'N/A'}
                             </div>
                         </div>
                         <div className="w-16 md:w-32 h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                             <div 
                                className={`h-full transition-all duration-1000 ease-out ${stats.percentage === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                                style={{ width: `${stats.percentage}%` }}
                             ></div>
                         </div>
                     </div>

                     <div className="h-8 w-px bg-gray-200 hidden md:block"></div>

                     <PageOptionsMenu 
                        page={page} 
                        onPageCreated={onPageCreated} 
                        onClose={() => {
                            // Ensure session is saved if user manually navigates away via delete/etc
                            saveSession(false);
                            if (onClose) onClose();
                        }} 
                     />
                </div>
            </div>

            {/* Content Area */}
            <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-12 pb-32">
                <div className="space-y-2">
                    {page.blocks.map((block, index) => (
                        <div key={block.id} className="group relative transition-all duration-300 ease-in-out">
                            
                            {/* Controls (Builder Mode Only) */}
                            {isBuilderMode && (
                                <div className="absolute -left-12 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-end space-y-1 z-10 hidden md:flex">
                                    <button onClick={() => moveBlock(index, 'up')} disabled={index === 0} className="p-1.5 bg-white border border-gray-200 rounded text-gray-400 hover:text-indigo-600 shadow-sm"><ArrowUp className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => openAutomation(block, 'augment')} className="p-1.5 bg-white border border-gray-200 rounded text-gray-400 hover:text-indigo-600 shadow-sm"><Sparkles className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => openAutomation(block, 'repair')} className="p-1.5 bg-white border border-gray-200 rounded text-gray-400 hover:text-indigo-600 shadow-sm"><RefreshCw className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => moveBlock(index, 'down')} disabled={index === page.blocks.length - 1} className="p-1.5 bg-white border border-gray-200 rounded text-gray-400 hover:text-indigo-600 shadow-sm"><ArrowDown className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => deleteBlock(block.id)} className="p-1.5 bg-white border border-gray-200 rounded text-gray-400 hover:text-rose-600 shadow-sm mt-1"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                            )}
                            
                            {isBuilderMode && (
                                <div className="flex md:hidden justify-end gap-2 mb-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                     <button onClick={() => moveBlock(index, 'up')} disabled={index === 0} className="p-1"><ArrowUp className="w-4 h-4 text-gray-500" /></button>
                                     <button onClick={() => moveBlock(index, 'down')} disabled={index === page.blocks.length - 1} className="p-1"><ArrowDown className="w-4 h-4 text-gray-500" /></button>
                                     <button onClick={() => deleteBlock(block.id)} className="p-1"><Trash2 className="w-4 h-4 text-rose-500" /></button>
                                </div>
                            )}

                            <SafeBlockRenderer 
                                block={block} 
                                pageId={page.id} 
                                onRegenerate={() => openAutomation(block, 'repair')}
                                onAutoCreate={(topic, context, blueprint, onCreated) => onOpenAI(topic, context, blueprint, onCreated)} 
                            />
                        </div>
                    ))}
                </div>

                {/* --- BOTTOM ACTION --- */}
                {stats.isLessonComplete && cycleState === 'active' && !hasDismissedClosure && (
                    <LessonClosure 
                        masteryGain={15} 
                        blocksCompleted={stats.learnableCount}
                        onComplete={handleLessonClosureComplete}
                    />
                )}

                {/* GLOBAL FOOTER (Recommendations & Expansion) */}
                <PageFooter 
                    page={page} 
                    onOpenAI={onOpenAI} 
                    isBuilderMode={isBuilderMode} 
                    className="mt-16"
                />
            </main>

            {/* Modals */}
            <AIAutomationModal
                isOpen={!!automationBlock}
                mode={automationMode}
                onClose={() => setAutomationBlock(null)}
                sourceBlock={automationBlock}
                pageId={page.id}
                onBlockAdded={() => setAutomationBlock(null)}
            />

            <ExternalTutorModal 
                isOpen={showExternalTutor}
                onClose={() => setShowExternalTutor(false)}
                page={page}
                onBlockAdded={() => setShowExternalTutor(false)}
            />
        </div>
    );
};
