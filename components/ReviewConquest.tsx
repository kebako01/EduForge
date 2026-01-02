
import React, { useState } from 'react';
import { Crown, Map as MapIcon, Anchor, Hexagon, Trophy, Flame, CheckCircle2, Circle, Target, ListTodo, Calendar, ArrowRight, Scroll, Swords, Lock, Sparkles, BookOpen, Zap, Star, Shield, LayoutGrid, PlayCircle, PenTool, Plus } from 'lucide-react';
import { HeroProfile } from '../utils/gamification';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { BlockType, HabitBlock, TaskBlock } from '../types';
import { useTime } from '../contexts/TimeContext';
import { calculateStreak, isSameDay, getWeeklyStatus } from '../utils/learning';
import { SynthesisModal } from './SynthesisModal';
import { PageAIModal } from './PageAIModal';

interface ReviewConquestProps {
    hero: HeroProfile;
    retroStats: {
        weeklyReviewedCount: number;
        weeklyMasteryAvg: number;
        topConcept: string;
        weeklyConcepts: string[];
    };
    onNavigateToPage: (id: string) => void;
    onOpenAI: () => void;
}

// Vibrantes Paletas tipo "App Moderna"
const REALM_THEMES: Record<string, { bg: string, text: string, accent: string, icon: any }> = {
    'Physics':  { bg: 'bg-sky-100', text: 'text-sky-900', accent: 'bg-sky-500', icon: AtomIcon }, 
    'Math':     { bg: 'bg-violet-100', text: 'text-violet-900', accent: 'bg-violet-500', icon: CalculatorIcon }, 
    'Life':     { bg: 'bg-emerald-100', text: 'text-emerald-900', accent: 'bg-emerald-500', icon: LeafIcon }, 
    'CS':       { bg: 'bg-pink-100', text: 'text-pink-900', accent: 'bg-pink-500', icon: TerminalIcon }, 
    'History':  { bg: 'bg-amber-100', text: 'text-amber-900', accent: 'bg-amber-500', icon: ScrollIcon }, 
    'Unsorted': { bg: 'bg-slate-100', text: 'text-slate-900', accent: 'bg-slate-500', icon: BoxIcon } 
};

// Icon Placeholders helper
function AtomIcon(props: any) { return <div {...props}>⚛️</div> }
function CalculatorIcon(props: any) { return <div {...props}>∑</div> }
function LeafIcon(props: any) { return <div {...props}>🌱</div> }
function TerminalIcon(props: any) { return <div {...props}>_</div> }
function ScrollIcon(props: any) { return <div {...props}>📜</div> }
function BoxIcon(props: any) { return <div {...props}>📦</div> }

// --- SYSTEM UNLOCKS DEFINITION ---
const POWER_UNLOCKS = [
    { level: 2, title: "Synthesis Engine", desc: "Combine disparate topics into new lessons.", icon: Sparkles },
    { level: 5, title: "Fluid Tutor", desc: "Unlock the conversational AI mentor.", icon: Zap },
    { level: 10, title: "Curriculum Architect", desc: "Generate full multi-level course structures.", icon: MapIcon },
    { level: 20, title: "Cognitive Forecast", desc: "See retention predictions 30 days out.", icon: Calendar },
];

export const ReviewConquest: React.FC<ReviewConquestProps> = ({ hero, retroStats, onNavigateToPage, onOpenAI }) => {
    const { virtualNow } = useTime();
    const [showSynthesisModal, setShowSynthesisModal] = useState(false);
    
    // Quick Drill State
    const [drillConfig, setDrillConfig] = useState<{ isOpen: boolean, topic: string, context: string } | null>(null);

    // --- RETRO LOGIC INTEGRATION ---
    const { isUnlocked, message: lockMessage } = getWeeklyStatus(virtualNow, retroStats.weeklyReviewedCount);

    // --- DATA QUERY ---
    const logistics = useLiveQuery(async () => {
        const pages = await db.pages.toArray();
        const habits: { block: HabitBlock, pageId: string, isDoneToday: boolean }[] = [];
        const tasks: { block: TaskBlock, pageId: string }[] = [];
        
        pages.forEach(p => {
            p.blocks.forEach(b => {
                if (b.type === BlockType.HABIT) {
                    const h = b as HabitBlock;
                    const isDone = h.history?.some(date => isSameDay(date, virtualNow)) || false;
                    habits.push({ block: h, pageId: p.id, isDoneToday: isDone });
                }
                if (b.type === BlockType.TASK) {
                    const t = b as TaskBlock;
                    if (!t.isCompleted) { 
                        tasks.push({ block: t, pageId: p.id });
                    }
                }
            });
        });

        habits.sort((a,b) => b.block.streak - a.block.streak);
        tasks.sort((a,b) => (a.block.dueDate || Infinity) - (b.block.dueDate || Infinity));

        return { habits, tasks };
    }, [virtualNow]);

    // --- ACTIONS ---
    const toggleHabit = async (pageId: string, block: HabitBlock, isDone: boolean) => {
        await (db as any).transaction('rw', db.pages, async () => {
            const page = await db.pages.get(pageId);
            if (!page) return;
            const blockIndex = page.blocks.findIndex(b => b.id === block.id);
            if (blockIndex === -1) return;

            let newHistory = [...(block.history || [])];
            if (!isDone) newHistory.push(virtualNow); 
            else newHistory = newHistory.filter(d => !isSameDay(d, virtualNow)); 

            const newStreak = calculateStreak(newHistory, virtualNow);
            const updatedBlock: HabitBlock = { ...block, streak: newStreak, history: newHistory, srs: { ...(block.srs!), repetitionCount: newStreak, stability: newStreak } };
            
            const newBlocks = [...page.blocks];
            newBlocks[blockIndex] = updatedBlock;
            await db.pages.update(pageId, { blocks: newBlocks });
        });
    };

    const completeTask = async (pageId: string, block: TaskBlock) => {
        await (db as any).transaction('rw', db.pages, async () => {
            const page = await db.pages.get(pageId);
            if (!page) return;
            const blockIndex = page.blocks.findIndex(b => b.id === block.id);
            if (blockIndex === -1) return;

            const updatedBlock: TaskBlock = { ...block, isCompleted: true };
            const newBlocks = [...page.blocks];
            newBlocks[blockIndex] = updatedBlock;
            await db.pages.update(pageId, { blocks: newBlocks });
        });
    };

    // --- NEXT UNLOCK CALC ---
    const nextUnlock = POWER_UNLOCKS.find(u => u.level > hero.level) || { title: "Cognitive Archon", desc: "Maximum Power Achieved", level: 100, icon: Crown };
    const NextIcon = nextUnlock.icon;

    if (!logistics) return null;

    return (
        <div className="pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* --- LEFT COLUMN: PROFILE & STRATEGY (4 cols) --- */}
                <div className="lg:col-span-4 space-y-6">
                    
                    {/* 1. HERO CARD (The "Credit Card" Style) */}
                    <div className="relative h-96 w-full rounded-3xl overflow-hidden shadow-2xl transition-transform hover:scale-[1.01] duration-500 group">
                        {/* Background */}
                        <div className="absolute inset-0 bg-slate-900"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-indigo-900 opacity-80"></div>
                        
                        {/* Decorative Circles */}
                        <div className="absolute -top-20 -right-20 w-64 h-64 bg-amber-400 rounded-full blur-[80px] opacity-20 group-hover:opacity-30 transition-opacity"></div>
                        <div className="absolute bottom-[-50px] left-[-50px] w-48 h-48 bg-emerald-400 rounded-full blur-[60px] opacity-20"></div>

                        {/* Content */}
                        <div className="relative z-10 h-full p-8 flex flex-col justify-between text-white">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-1">Operative Rank</div>
                                    <h1 className="text-3xl font-bold tracking-tighter">{hero.title}</h1>
                                </div>
                                <div className="bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/20">
                                    <Crown className="w-6 h-6 text-amber-300" />
                                </div>
                            </div>

                            {/* Center Visual: Level */}
                            <div className="flex items-center gap-4">
                                <span className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-indigo-200" style={{ textShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                                    {hero.level}
                                </span>
                                <div className="h-12 w-px bg-white/20"></div>
                                <div>
                                    <div className="text-sm font-medium text-indigo-200">Current XP</div>
                                    <div className="font-mono font-bold text-xl">{hero.currentXP.toLocaleString()}</div>
                                </div>
                            </div>

                            {/* Footer: Next Goal */}
                            <div className="space-y-3">
                                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-indigo-200">
                                    <span>Next Power: {nextUnlock.title}</span>
                                    <span>Lvl {nextUnlock.level}</span>
                                </div>
                                <div className="h-2 w-full bg-black/30 rounded-full overflow-hidden backdrop-blur-sm">
                                    <div 
                                        className="h-full bg-gradient-to-r from-amber-300 to-orange-500 shadow-[0_0_15px_rgba(251,191,36,0.6)]" 
                                        style={{ width: `${hero.progressPercent}%` }}
                                    ></div>
                                </div>
                                <p className="text-[10px] text-center text-indigo-300 font-medium">
                                    {nextUnlock.desc}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 2. THE SYNTHESIS GATE (The "Grand Strategy" Redesign) */}
                    <div className={`
                        relative rounded-3xl p-6 border-2 overflow-hidden flex flex-col justify-between min-h-[220px] transition-all
                        ${isUnlocked ? 'bg-black border-slate-800 text-white hover:border-indigo-500/50' : 'bg-slate-50 border-slate-200 text-slate-400'}
                    `}>
                        {isUnlocked && (
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-transparent to-transparent"></div>
                        )}
                        
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                                <div className={`p-2 rounded-lg ${isUnlocked ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                    <Swords className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-bold uppercase tracking-widest">Main Event</span>
                            </div>
                            
                            <h3 className={`text-2xl font-bold leading-tight mb-2 ${isUnlocked ? 'text-white' : 'text-slate-400'}`}>
                                {isUnlocked ? "The Weekly Synthesis" : "Portal Locked"}
                            </h3>
                            <p className="text-sm opacity-80 leading-relaxed">
                                {isUnlocked 
                                    ? `Connect ${retroStats.topConcept} with ${retroStats.weeklyConcepts.length - 1} other concepts to forge a permanent neural link.` 
                                    : lockMessage}
                            </p>
                        </div>

                        <div className="relative z-10 mt-6">
                            {isUnlocked ? (
                                <button 
                                    onClick={() => setShowSynthesisModal(true)}
                                    className="w-full py-4 bg-white text-black rounded-xl font-bold text-sm hover:bg-indigo-50 hover:scale-[1.02] transition-all shadow-lg flex items-center justify-center gap-2"
                                >
                                    <Sparkles className="w-4 h-4 text-indigo-600" />
                                    <span>Begin Synthesis</span>
                                </button>
                            ) : (
                                <div className="w-full py-3 bg-slate-200/50 rounded-xl text-center text-xs font-bold uppercase tracking-wider text-slate-400 border border-slate-200">
                                    <Lock className="w-3 h-3 inline-block mr-1 mb-0.5" /> Requires More Data
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* --- RIGHT COLUMN: TERRITORIES & LOGISTICS (8 cols) --- */}
                <div className="lg:col-span-8 space-y-8">
                    
                    {/* 3. TERRITORIES (Realms) - Grid */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <MapIcon className="w-6 h-6 text-indigo-600" />
                                <span>Active Territories</span>
                            </h2>
                            <button onClick={onOpenAI} className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full hover:bg-slate-200 transition-colors">
                                + New Domain
                            </button>
                        </div>

                        {hero.realms.length === 0 ? (
                            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-slate-300">
                                    <Anchor className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-700">No Land Claimed</h3>
                                <p className="text-sm text-slate-500 mb-6">Start your first lesson to establish a foothold.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {hero.realms.map(realm => {
                                    // Theme mapping or default
                                    const rawTheme = Object.keys(REALM_THEMES).find(k => realm.id.includes(k)) || 'Unsorted';
                                    const theme = REALM_THEMES[rawTheme];
                                    const control = Math.round((realm.masteredBlocks / Math.max(1, realm.totalBlocks)) * 100);
                                    
                                    return (
                                        <div key={realm.id} className="bg-white border border-slate-200 rounded-3xl p-5 hover:shadow-lg transition-all group relative overflow-hidden">
                                            {/* Top Bar */}
                                            <div className="flex justify-between items-start mb-4 relative z-10">
                                                <div className={`p-3 rounded-2xl ${theme.bg} ${theme.text}`}>
                                                    <LayoutGrid className="w-6 h-6" />
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-2xl font-bold text-slate-900 block leading-none">{realm.level}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rank</span>
                                                </div>
                                            </div>

                                            {/* Info */}
                                            <div className="relative z-10 mb-6">
                                                <h3 className="text-lg font-bold text-slate-900 mb-1">{realm.name}</h3>
                                                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                                    <div className={`w-2 h-2 rounded-full ${theme.accent}`}></div>
                                                    <span>{realm.totalBlocks} Nodes</span>
                                                    <span className="text-slate-300">•</span>
                                                    <span>{control}% Controlled</span>
                                                </div>
                                            </div>

                                            {/* Actions (The "Useful" Part) */}
                                            <div className="relative z-10 flex gap-2">
                                                <button 
                                                    onClick={() => setDrillConfig({ isOpen: true, topic: `Practice ${realm.name}`, context: realm.id })}
                                                    className="flex-1 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 text-slate-700 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                                                >
                                                    <PlayCircle className="w-4 h-4 text-slate-400" />
                                                    Quick Drill
                                                </button>
                                                {control > 80 && (
                                                    <button className="flex-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white py-2.5 rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2">
                                                        <Crown className="w-4 h-4" />
                                                        Claim
                                                    </button>
                                                )}
                                            </div>

                                            {/* Background Decoration */}
                                            <div className={`absolute -bottom-12 -right-12 w-32 h-32 rounded-full opacity-10 ${theme.bg}`}></div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* 4. LOGISTICS ROW (Habits & Tasks) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* HABITS */}
                        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                    <Flame className="w-5 h-5 text-orange-500" />
                                    <span>Rituals</span>
                                </h3>
                                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{logistics.habits.length}</span>
                            </div>
                            
                            <div className="flex-1 space-y-3">
                                {logistics.habits.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">No rituals set.</div>
                                ) : (
                                    logistics.habits.slice(0, 3).map(h => (
                                        <button 
                                            key={h.block.id}
                                            onClick={() => toggleHabit(h.pageId, h.block, h.isDoneToday)}
                                            className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${h.isDoneToday ? 'border-transparent bg-slate-50 opacity-60' : 'border-slate-100 bg-white hover:border-indigo-100'}`}
                                        >
                                            <span className={`text-sm font-bold ${h.isDoneToday ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{h.block.prompt}</span>
                                            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${h.block.streak > 0 ? 'bg-orange-50 text-orange-600' : 'bg-slate-100 text-slate-400'}`}>
                                                <Flame className="w-3 h-3 fill-current" />
                                                {h.block.streak}
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* TASKS */}
                        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                    <ListTodo className="w-5 h-5 text-emerald-600" />
                                    <span>Quest Log</span>
                                </h3>
                                <button onClick={onOpenAI} className="p-1 hover:bg-slate-100 rounded text-slate-400"><Plus className="w-4 h-4" /></button>
                            </div>

                            <div className="flex-1 space-y-3">
                                {logistics.tasks.length === 0 ? (
                                    <div className="h-full flex items-center justify-center">
                                        <div className="text-center">
                                            <CheckCircle2 className="w-8 h-8 text-emerald-200 mx-auto mb-2" />
                                            <p className="text-xs text-slate-400 font-medium">All Clear</p>
                                        </div>
                                    </div>
                                ) : (
                                    logistics.tasks.slice(0, 3).map(t => (
                                        <div key={t.block.id} className="flex items-start gap-3 group">
                                            <button onClick={() => completeTask(t.pageId, t.block)} className="mt-0.5 w-5 h-5 rounded-full border-2 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 transition-all flex-shrink-0"></button>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-slate-800 leading-snug truncate">{t.block.content}</div>
                                                {t.block.dueDate && <div className="text-[10px] text-slate-400 mt-0.5">{new Date(t.block.dueDate).toLocaleDateString()}</div>}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>

                </div>
            </div>

            {/* --- DRILL MODAL (Quick Action) --- */}
            <PageAIModal 
                isOpen={!!drillConfig?.isOpen}
                onClose={() => setDrillConfig(null)}
                onPageCreated={(id) => {
                    setDrillConfig(null);
                    onNavigateToPage(id);
                }}
                initialTopic={drillConfig?.topic}
                initialContext={drillConfig?.context}
                initialBlueprint="Create a fast-paced drill session. Focus on active recall exercises (MCQ, Input, Sort). No long texts."
            />

            {/* --- SYNTHESIS MODAL --- */}
            <SynthesisModal 
                isOpen={showSynthesisModal} 
                onClose={() => setShowSynthesisModal(false)}
                onPageCreated={(id) => {
                    setShowSynthesisModal(false);
                    onNavigateToPage(id);
                }}
                stats={retroStats}
            />
        </div>
    );
};
