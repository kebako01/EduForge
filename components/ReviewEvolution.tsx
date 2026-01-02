
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Sparkles, X, ArrowRight, Check, Copy, Brain, ShieldAlert, Rocket, Target, Zap, ClipboardList, PenTool, Plus, FileText, AlertTriangle, AlertCircle, Clock, Shield, Star, Map } from 'lucide-react';
import { Block, StrategicMission } from '../types';
import { SystemContextLoader } from '../services/aiPrompts';
import { PageAIModal, MissionConfig } from './PageAIModal';
import { StrategistState } from '../App';
import { getEstimatedMinutes } from '../utils/learning';

interface ReviewEvolutionProps {
    forecastCounts: number[];
    forecastLoad: number[]; // New Prop: Estimated Minutes
    overdueItems: { pageTitle: string; block: Block }[]; 
    virtualNow: number;
    onNavigateToPage: (id: string) => void;
    activeMissions: StrategicMission[];
    onSetMissions: (missions: StrategicMission[]) => void;
    strategistState: StrategistState;
    setStrategistState: React.Dispatch<React.SetStateAction<StrategistState>>;
}

export const ReviewEvolution: React.FC<ReviewEvolutionProps> = ({ 
    forecastCounts, 
    forecastLoad,
    overdueItems, 
    virtualNow, 
    onNavigateToPage,
    activeMissions,
    onSetMissions,
    strategistState,
    setStrategistState
}) => {
    
    // --- STATE ---
    const { isOpen: isStrategistOpen, step: strategyStep, prompt: strategistPrompt, jsonInput } = strategistState;
    const [isCopied, setIsCopied] = useState(false);
    const [aiModalState, setAiModalState] = useState<{ isOpen: boolean; missionConfig?: MissionConfig }>({ isOpen: false });

    // --- TACTICAL ANALYSIS ENGINE ---
    const tacticalSituation = useMemo(() => {
        // 1. Map Coverage
        const coveredEntityIds = new Set<string>();
        
        const activeMissionData = activeMissions.map(mission => {
            const matchedItems = overdueItems.filter(item => {
                const eid = item.block.srs?.entityId;
                const bid = item.block.id;
                return mission.targetBlockIds.includes(bid) || (eid && mission.targetBlockIds.includes(eid));
            });

            matchedItems.forEach(item => {
                if(item.block.srs?.entityId) coveredEntityIds.add(item.block.srs.entityId);
                coveredEntityIds.add(item.block.id);
            });

            // Pedagogical Synergy: Calculate Potential XP
            const potentialXP = matchedItems.length * 15; // 15XP per review
            const domain = matchedItems[0]?.block.srs?.entityId?.split('.')[1] || 'General';
            const domainLabel = domain.charAt(0).toUpperCase() + domain.slice(1);

            return {
                ...mission,
                liveItems: matchedItems,
                status: matchedItems.length > 0 ? 'active' : 'dormant',
                potentialXP,
                domainLabel
            };
        });

        // 2. Identify Orphans (Visual "Incoming Threats")
        const orphans = overdueItems.filter(item => {
            const eid = item.block.srs?.entityId;
            const bid = item.block.id;
            return !((eid && coveredEntityIds.has(eid)) || coveredEntityIds.has(bid));
        });

        // Cluster orphans for display
        const orphanClusters: Record<string, number> = {};
        orphans.forEach(o => {
            const dom = o.block.srs?.entityId?.split('.')[1] || 'Unsorted';
            const label = dom.charAt(0).toUpperCase() + dom.slice(1);
            orphanClusters[label] = (orphanClusters[label] || 0) + 1;
        });

        // 3. Calculate Loads
        const orphanLoad = orphans.reduce((acc, item) => acc + getEstimatedMinutes(item.block.type), 0);
        // We know forecastLoad[0] is total overdue load.
        // missionLoad = total - orphan. This is robust.
        
        return {
            missions: activeMissionData,
            orphans,
            orphanClusters,
            orphanLoad,
            totalThreats: overdueItems.length,
            coveredThreats: overdueItems.length - orphans.length
        };
    }, [activeMissions, overdueItems]);

    // --- ACTIONS ---

    const handleOpenStrategist = () => {
        // Only analyze orphans to create focused missions
        const itemsToAnalyze = tacticalSituation.orphans.length > 0 ? tacticalSituation.orphans : overdueItems;
        const prompt = SystemContextLoader.generateStrategicPlanPrompt(itemsToAnalyze);
        
        setStrategistState({
            isOpen: true,
            step: 'prompt',
            prompt: prompt,
            jsonInput: strategistState.jsonInput 
        });
    };

    const handleCloseStrategist = () => {
        setStrategistState(prev => ({ ...prev, isOpen: false }));
    };

    const handleCopyStrategyPrompt = () => {
        navigator.clipboard.writeText(strategistPrompt);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleIngestStrategy = () => {
        try {
            const jsonMatch = jsonInput.match(/\[[\s\S]*\]/); 
            if (!jsonMatch) throw new Error("No JSON Array found.");
            
            const newMissions = JSON.parse(jsonMatch[0]) as StrategicMission[];
            if (!Array.isArray(newMissions)) throw new Error("Output is not an array.");

            onSetMissions([...activeMissions, ...newMissions]); 
            
            setStrategistState({
                isOpen: false,
                step: 'prompt',
                prompt: '',
                jsonInput: ''
            }); 
        } catch (e) {
            alert("Invalid Strategy JSON. Please try again.");
        }
    };

    const handleExecuteMission = (missionData: typeof tacticalSituation.missions[0]) => {
        if (missionData.status === 'dormant') {
            if(confirm("This mission currently has no critical targets. Delete it?")) {
                onSetMissions(activeMissions.filter(m => m.title !== missionData.title));
            }
            return;
        }

        const missionConfig: MissionConfig = {
            title: missionData.title,
            type: missionData.type,
            reason: missionData.reason,
            items: missionData.liveItems
        };
        
        setAiModalState({ isOpen: true, missionConfig });
    };

    // --- VISUALIZATION: COGNITIVE WEATHER ---
    // Use forecastLoad (Minutes) for max height calculation to represent effort
    const maxLoad = Math.max(15, ...forecastLoad); // Min 15 mins to avoid huge bars for tiny tasks
    
    const days = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(virtualNow);
        d.setDate(d.getDate() + i);
        
        return {
            label: d.getDate(),
            dayName: i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
            count: forecastCounts[i] || 0,
            loadMin: forecastLoad[i] || 0
        };
    });

    return (
        <div className="space-y-8 pb-32 animate-in fade-in duration-500">
            
            {/* 1. COGNITIVE WEATHER REPORT (Forecast) */}
            <div className="rounded-3xl p-6 md:p-8 bg-white border border-gray-200 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-end mb-6 relative z-10">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-indigo-600" />
                            <span>Cognitive Weather</span>
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Estimated mental load required to maintain stability over the next 7 cycles.
                        </p>
                    </div>
                    {/* Summary Stat */}
                    <div className="text-right hidden sm:block">
                        <div className="text-2xl font-bold text-indigo-600">{tacticalSituation.totalThreats}</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Unstable Nodes</div>
                    </div>
                </div>

                {/* The Timeline Graph */}
                <div className="flex items-end justify-between gap-3 h-32 px-2 relative z-10">
                    {days.map((day, idx) => {
                        const isToday = idx === 0;
                        const heightPercent = Math.min(100, (day.loadMin / maxLoad) * 100);
                        
                        let stackedOrphanPercent = 0;
                        let stackedMissionPercent = 0;

                        if (isToday) {
                            const orphanLoad = tacticalSituation.orphanLoad;
                            const totalLoad = day.loadMin; // Should equal total overdue load
                            
                            // Defensive check
                            if (totalLoad > 0) {
                                stackedOrphanPercent = (orphanLoad / totalLoad) * 100;
                                stackedMissionPercent = 100 - stackedOrphanPercent;
                            }
                        }

                        // Colors
                        // Future: Indigo-400
                        // Today: Stacked (Rose-400 for Risk, Indigo-400 for Planned)
                        const standardColor = 'bg-indigo-400 shadow-indigo-100';

                        return (
                            <div key={idx} className="flex flex-col items-center gap-2 w-full h-full justify-end group relative">
                                {/* Tooltip */}
                                {day.count > 0 && (
                                    <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap z-20 pointer-events-none shadow-lg">
                                        {isToday 
                                            ? `Planned: ${Math.round(day.loadMin - tacticalSituation.orphanLoad)}m | At Risk: ${tacticalSituation.orphanLoad}m`
                                            : `${day.loadMin} min (${day.count} items)`
                                        }
                                    </div>
                                )}

                                <div className="w-full relative flex-1 flex flex-col justify-end items-center rounded-xl bg-gray-50 overflow-hidden min-h-[4px]">
                                    
                                    <div 
                                        className="w-full mx-1.5 transition-all duration-700 ease-out flex flex-col justify-end shadow-lg rounded-t-md overflow-hidden"
                                        style={{ height: `${Math.max(4, heightPercent)}%` }}
                                    >
                                        {isToday ? (
                                            <>
                                                {/* TOP: ORPHANS (RISK) - Red/Rose to signify Alert */}
                                                <div 
                                                    className={`w-full bg-rose-400 transition-all duration-500 relative z-10 ${stackedMissionPercent > 0 ? 'border-b-2 border-white' : ''}`}
                                                    style={{ height: `${stackedOrphanPercent}%` }}
                                                ></div>
                                                {/* BOTTOM: MISSIONS (PLANNED) - Indigo to signify Active/Safe */}
                                                <div 
                                                    className="w-full bg-indigo-400 transition-all duration-500"
                                                    style={{ height: `${stackedMissionPercent}%` }}
                                                ></div>
                                            </>
                                        ) : (
                                            <div className={`w-full h-full ${standardColor}`}></div>
                                        )}
                                    </div>

                                </div>
                                <div className="text-center h-4">
                                    <div className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-indigo-900' : 'text-gray-400'}`}>
                                        {day.dayName}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 2. OPERATIONAL PLANNING (Split View) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* LEFT: THREAT MONITOR (Backlog) - 4 Cols */}
                <div className="lg:col-span-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                            <span>Entropy Risk</span>
                        </h3>
                        <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                            {tacticalSituation.orphans.length}
                        </span>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[300px] flex flex-col">
                        {tacticalSituation.orphans.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
                                <Shield className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm font-medium">Perimeter Secure.</p>
                                <p className="text-xs">No unassigned items.</p>
                            </div>
                        ) : (
                            <div className="p-4 space-y-3">
                                {/* Clustered View of Threats */}
                                {Object.entries(tacticalSituation.orphanClusters).map(([domain, count]) => (
                                    <div key={domain} className="flex items-center justify-between p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-900">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-lg border border-rose-100 shadow-sm">
                                                <AlertTriangle className="w-4 h-4 text-rose-500" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm">{domain} Cluster</div>
                                                <div className="text-[10px] text-rose-600 uppercase font-bold tracking-wider">Degrading</div>
                                            </div>
                                        </div>
                                        <div className="text-lg font-bold">{count}</div>
                                    </div>
                                ))}
                                
                                <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
                                    <p className="text-xs text-gray-500 mb-3">
                                        These concepts are currently undefended. Group them into a strategic mission.
                                    </p>
                                    <ArrowRight className="w-4 h-4 text-gray-400 mx-auto rotate-90 lg:rotate-0" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* MIDDLE: THE STRATEGIST (Action) - 1 Col (Visual Connector) */}
                <div className="lg:col-span-1 flex items-center justify-center">
                    <button 
                        onClick={handleOpenStrategist}
                        disabled={tacticalSituation.orphans.length === 0}
                        className={`
                            relative group rounded-full p-4 shadow-xl transition-all duration-300 flex flex-col items-center justify-center gap-2 border-4
                            ${tacticalSituation.orphans.length > 0 
                                ? 'bg-indigo-600 border-indigo-100 text-white hover:scale-110 hover:rotate-12 cursor-pointer' 
                                : 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed'}
                        `}
                        title="AI Strategist"
                    >
                        <Brain className="w-6 h-6" />
                        <Plus className="w-4 h-4 absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5" />
                    </button>
                </div>

                {/* RIGHT: ACTIVE CAMPAIGNS (Missions) - 7 Cols */}
                <div className="lg:col-span-7 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Target className="w-5 h-5 text-indigo-600" />
                            <span>Active Campaigns</span>
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {tacticalSituation.missions.map((mission, idx) => (
                            <div 
                                key={idx}
                                onClick={() => handleExecuteMission(mission)}
                                className={`
                                    relative rounded-2xl p-5 border transition-all cursor-pointer group flex flex-col justify-between
                                    ${mission.status === 'dormant' 
                                        ? 'bg-gray-50 border-gray-200 opacity-60 hover:opacity-100' 
                                        : 'bg-white border-gray-200 shadow-sm hover:shadow-lg hover:border-indigo-300'}
                                `}
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 ${
                                            mission.type === 'REPAIR' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                            mission.type === 'EVOLUTION' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                                            'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        }`}>
                                            {mission.type === 'REPAIR' ? <ShieldAlert className="w-3 h-3" /> : <Rocket className="w-3 h-3" />}
                                            {mission.type}
                                        </div>
                                        {mission.status === 'active' && (
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                                        )}
                                    </div>

                                    <h4 className="font-bold text-gray-900 leading-tight mb-2 group-hover:text-indigo-600 transition-colors">
                                        {mission.title}
                                    </h4>
                                    <p className="text-xs text-gray-500 line-clamp-2 mb-4">
                                        {mission.reason}
                                    </p>
                                </div>

                                {/* Synergy Stats */}
                                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                        <Star className="w-3 h-3 fill-current" />
                                        +{mission.potentialXP} XP
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                        <Map className="w-3 h-3" />
                                        {mission.domainLabel}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Empty State Slot (Passive) */}
                        {tacticalSituation.missions.length === 0 && (
                            <div className="col-span-1 md:col-span-2 flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-100 rounded-2xl text-gray-300">
                                <Target className="w-12 h-12 mb-2 opacity-20" />
                                <span className="text-xs font-bold uppercase tracking-widest">No Active Campaigns</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- STRATEGIST MODAL (PORTAL FIXED) --- */}
            {isStrategistOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center isolate">
                    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" onClick={handleCloseStrategist} />
                    <div className="relative bg-white w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] mx-4 animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-900 p-6 flex justify-between items-center text-white shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500 rounded-lg"><Brain className="w-5 h-5 text-white" /></div>
                                <div><h3 className="font-bold text-lg">Strategic Analysis</h3><p className="text-xs text-indigo-300 uppercase tracking-widest font-bold">Phase 1: Organization</p></div>
                            </div>
                            <button onClick={handleCloseStrategist} className="text-slate-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
                            {strategyStep === 'prompt' ? (
                                <div className="space-y-4 animate-in slide-in-from-right-4">
                                    <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm mb-4">
                                        <div className="flex gap-3"><ClipboardList className="w-5 h-5 text-indigo-600 mt-0.5" /><div className="text-sm text-gray-600"><strong className="text-gray-900">Instruction:</strong> Copy this inventory. Paste into LLM.</div></div>
                                    </div>
                                    <div className="relative group">
                                        <textarea readOnly value={strategistPrompt} className="w-full h-64 p-4 font-mono text-xs bg-slate-800 text-slate-300 rounded-xl resize-none focus:outline-none" />
                                        <button onClick={handleCopyStrategyPrompt} className="absolute bottom-3 right-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all">{isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}<span>{isCopied ? 'Copied' : 'Copy Manifest'}</span></button>
                                    </div>
                                    <button onClick={() => setStrategistState(prev => ({ ...prev, step: 'ingest' }))} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-lg"><span>I have the Plan (JSON)</span><ArrowRight className="w-4 h-4" /></button>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in slide-in-from-right-4">
                                    <div className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2"><PenTool className="w-4 h-4" /><span>Paste Strategic Plan</span></div>
                                    <textarea autoFocus value={jsonInput} onChange={(e) => setStrategistState(prev => ({ ...prev, jsonInput: e.target.value }))} placeholder='[ { "title": "...", "type": "...", "targetBlockIds": [...] } ]' className="w-full h-64 p-4 font-mono text-xs border-2 border-gray-200 rounded-xl resize-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none bg-white text-gray-900" />
                                    <div className="flex gap-3"><button onClick={() => setStrategistState(prev => ({ ...prev, step: 'prompt' }))} className="px-4 font-bold text-gray-400 hover:text-gray-600">Back</button><button onClick={handleIngestStrategy} disabled={!jsonInput.trim()} className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-200">Visualize Battle Plan</button></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* --- PAGE GENERATOR MODAL (Step 2 - Auto Triggered) --- */}
            <PageAIModal
                isOpen={aiModalState.isOpen}
                onClose={() => setAiModalState({ ...aiModalState, isOpen: false })}
                onPageCreated={(id) => {
                    // 1. Close Modal
                    setAiModalState({ ...aiModalState, isOpen: false });
                    
                    // 2. Remove the Mission from the Board (Completion Logic)
                    // If we successfully created a page for a specific mission, we consider the "Planning" phase done.
                    // The "Execution" phase happens in the Editor.
                    if (aiModalState.missionConfig) {
                        const missionTitle = aiModalState.missionConfig.title;
                        const remainingMissions = activeMissions.filter(m => m.title !== missionTitle);
                        onSetMissions(remainingMissions);
                    }

                    // 3. Navigate to the new page
                    onNavigateToPage(id);
                }}
                missionConfig={aiModalState.missionConfig}
            />
        </div>
    );
};
