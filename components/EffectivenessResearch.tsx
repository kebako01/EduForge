
import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useTime } from '../contexts/TimeContext';
import { getRetrievability, FSRSStats, State } from '../utils/fsrs';
import { Block, BlockType } from '../types';
import { 
    Chart as ChartJS, 
    CategoryScale, 
    LinearScale, 
    PointElement, 
    LineElement, 
    BarElement, 
    Title, 
    Tooltip, 
    Legend, 
    Filler,
    ArcElement
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { 
    Activity, 
    Brain, 
    Clock, 
    TrendingUp, 
    AlertTriangle, 
    CheckCircle2, 
    X, 
    Zap, 
    Timer, 
    Target,
    BarChart3,
    Microscope,
    Table as TableIcon
} from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

export const EffectivenessResearch: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { virtualNow } = useTime();

    // --- REAL DATA ANALYSIS ENGINE ---
    const telemetry = useLiveQuery(async () => {
        const pages = await db.pages.toArray();
        const sessions = await db.studySessions.toArray(); // REAL SESSIONS
        
        let totalSecondsInvested = 0;
        let totalStabilityDays = 0; // "Inventory Value"
        let totalItems = 0;
        let learnedItems = 0;
        
        // Metrics per Page based on Real Sessions
        const pageMetrics: { 
            id: string; 
            title: string; 
            realTimeInvested: number; // Sum of session durations
            avgStability: number; 
            sessionCount: number;
            avgBlockTime: number; // Derived from checkpoints
            efficiency: number; // Stability gained per minute
            itemCount: number;
        }[] = [];

        // Distribution of Retention Probability (0-100%)
        const retentionBuckets = Array(10).fill(0);
        
        // Analyze Pages & Blocks for Stability
        const stabilityMap: Record<string, number> = {}; // pageId -> totalStability
        const itemMap: Record<string, number> = {}; // pageId -> itemCount

        pages.forEach(p => {
            let pStability = 0;
            let pItems = 0;

            p.blocks.forEach(b => {
                if (b.srs) {
                    const reps = b.srs.repetitionCount || 0;
                    const stability = b.srs.stability || 0;
                    
                    pStability += stability;
                    pItems++;
                    totalStabilityDays += stability;

                    if (reps > 0) learnedItems++;

                    // Retention Health Check
                    if (reps > 0) {
                        const stats: FSRSStats = {
                            stability: stability,
                            difficulty: b.srs.difficulty,
                            reps: reps,
                            lapses: 0,
                            state: State.Review,
                            last_review: b.srs.lastReviewed || virtualNow,
                            due: b.srs.nextReviewDue || virtualNow
                        };
                        const r = getRetrievability(stats, virtualNow);
                        const bucket = Math.min(9, Math.floor(r * 10));
                        retentionBuckets[bucket]++;
                    }
                }
            });
            
            stabilityMap[p.id] = pStability;
            itemMap[p.id] = pItems;
            totalItems += pItems;
        });

        // Analyze Real Sessions
        sessions.forEach(sess => {
            totalSecondsInvested += sess.durationSeconds;
        });

        // Combine for Page Metrics
        pages.forEach(p => {
            const pSessions = sessions.filter(s => s.pageId === p.id);
            const timeInvested = pSessions.reduce((acc, s) => acc + s.durationSeconds, 0);
            
            // Calculate Checkpoint Delta (Time per Block)
            let totalCheckpointDelta = 0;
            let totalCheckpoints = 0;
            
            pSessions.forEach(s => {
                s.checkpoints.forEach((cp, idx) => {
                    // Time for this block is current offset minus previous offset (or 0)
                    const prevTime = idx > 0 ? s.checkpoints[idx-1].timeOffset : 0;
                    const delta = Math.max(0, cp.timeOffset - prevTime);
                    totalCheckpointDelta += delta;
                    totalCheckpoints++;
                });
            });

            const avgBlockTime = totalCheckpoints > 0 ? totalCheckpointDelta / totalCheckpoints : 0;
            const avgStability = itemMap[p.id] > 0 ? stabilityMap[p.id] / itemMap[p.id] : 0;

            // SAFETY: Efficiency Calculation
            // Prevent Division by Zero if TimeInvested is extremely low
            const effectiveMinutes = Math.max(1, timeInvested / 60); 
            const efficiency = stabilityMap[p.id] / effectiveMinutes;

            if (itemMap[p.id] > 0) {
                pageMetrics.push({
                    id: p.id,
                    title: p.title,
                    realTimeInvested: timeInvested,
                    avgStability,
                    sessionCount: pSessions.length,
                    avgBlockTime,
                    efficiency: isFinite(efficiency) ? efficiency : 0,
                    itemCount: itemMap[p.id]
                });
            }
        });

        // SAFETY: Global ROI Calculation
        const globalEffectiveMinutes = Math.max(1, totalSecondsInvested / 60);
        const globalROI = totalStabilityDays / globalEffectiveMinutes;

        return {
            totalSecondsInvested,
            totalStabilityDays,
            totalItems,
            learnedItems,
            globalROI: isFinite(globalROI) ? globalROI : 0,
            pageMetrics: pageMetrics.sort((a,b) => b.efficiency - a.efficiency), 
            retentionBuckets,
            sessionCount: sessions.length
        };
    }, [virtualNow]);

    if (!telemetry) return null;

    // --- FORMATTERS ---
    const formatTime = (seconds: number) => {
        if (seconds < 60) return `${seconds.toFixed(0)}s`;
        if (seconds < 3600) return `${Math.round(seconds/60)}m`;
        return `${(seconds/3600).toFixed(1)}h`;
    };

    // --- CHARTS CONFIG ---
    const healthChartData = {
        labels: ['0-10%', '10-20%', '20-30%', '30-40%', '40-50%', '50-60%', '60-70%', '70-80%', '80-90%', '90-100%'],
        datasets: [{
            label: 'Active Concepts',
            data: telemetry.retentionBuckets,
            backgroundColor: (ctx: any) => {
                const idx = ctx.dataIndex;
                if (idx === 9) return '#10b981'; 
                if (idx === 8) return '#f59e0b'; 
                return '#f43f5e'; 
            },
            borderRadius: 6,
            barThickness: 24,
        }]
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col animate-in fade-in duration-300 font-sans">
            
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg shadow-indigo-200">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Real-Time Laboratory</h2>
                        <p className="text-xs text-gray-500 font-medium">Analysis based on {telemetry.sessionCount} recorded study sessions.</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                    <X className="w-6 h-6" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="max-w-6xl mx-auto space-y-8">

                    {/* 1. HERO METRICS */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                <Timer className="w-4 h-4 text-indigo-500" /> Real Time Tracked
                            </div>
                            <div className="text-3xl font-bold text-gray-900 tracking-tight">
                                {formatTime(telemetry.totalSecondsInvested)}
                            </div>
                            <div className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded w-fit mt-2 font-medium">
                                Actual Focus Time
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                <Brain className="w-4 h-4 text-emerald-500" /> Knowledge Inventory
                            </div>
                            <div className="text-3xl font-bold text-gray-900 tracking-tight">
                                {telemetry.totalStabilityDays.toFixed(0)} <span className="text-lg text-gray-400 font-medium">days</span>
                            </div>
                            <div className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded w-fit mt-2 font-medium">
                                Total Stability
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                <Zap className="w-4 h-4 text-amber-500" /> Neural ROI
                            </div>
                            <div className="text-3xl font-bold text-gray-900 tracking-tight">
                                {telemetry.globalROI.toFixed(2)}
                            </div>
                            <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded w-fit mt-2 font-medium">
                                Days Retained / Min Studied
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                <Target className="w-4 h-4 text-rose-500" /> Active Concepts
                            </div>
                            <div className="text-3xl font-bold text-gray-900 tracking-tight">
                                {telemetry.learnedItems} <span className="text-lg text-gray-400">/ {telemetry.totalItems}</span>
                            </div>
                            <div className="text-xs text-rose-700 bg-rose-50 px-2 py-1 rounded w-fit mt-2 font-medium">
                                In Rotation
                            </div>
                        </div>
                    </div>

                    {/* 2. DETAILED SESSION ANALYSIS TABLE */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-slate-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-2 text-slate-800 font-bold">
                                <TableIcon className="w-5 h-5" />
                                <h3>Session Analysis Report</h3>
                            </div>
                            <span className="text-[10px] bg-white border border-slate-200 text-slate-500 px-2 py-1 rounded font-bold uppercase tracking-wider">
                                Real-Time Data
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px]">
                                    <tr>
                                        <th className="px-6 py-3">Topic</th>
                                        <th className="px-6 py-3 text-right">Sessions</th>
                                        <th className="px-6 py-3 text-right">Total Time</th>
                                        <th className="px-6 py-3 text-right">Avg Block Time</th>
                                        <th className="px-6 py-3 text-right">Stability</th>
                                        <th className="px-6 py-3 text-right">Efficiency Score</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {telemetry.pageMetrics.map(p => (
                                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-3 font-medium text-gray-900 truncate max-w-[200px]">{p.title}</td>
                                            <td className="px-6 py-3 text-right text-gray-500">{p.sessionCount}</td>
                                            <td className="px-6 py-3 text-right text-gray-700 font-mono font-bold">{formatTime(p.realTimeInvested)}</td>
                                            <td className="px-6 py-3 text-right text-indigo-600 font-mono">
                                                {p.avgBlockTime > 0 ? formatTime(p.avgBlockTime) : '-'}
                                            </td>
                                            <td className="px-6 py-3 text-right text-emerald-600 font-bold">{p.avgStability.toFixed(1)}d</td>
                                            <td className="px-6 py-3 text-right">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${p.efficiency > 1.0 ? 'bg-emerald-100 text-emerald-700' : p.efficiency < 0.2 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {p.efficiency.toFixed(2)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {telemetry.pageMetrics.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-gray-400 italic">
                                                No session data recorded yet. Start studying to see metrics.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 3. RETENTION DISTRIBUTION */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-indigo-600"/> 
                                    Memory Health Distribution
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    Real-time probability of recall.
                                </p>
                            </div>
                        </div>
                        <div className="h-64 w-full">
                            <Bar 
                                data={healthChartData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: { legend: { display: false } },
                                    scales: {
                                        y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
                                        x: { grid: { display: false } }
                                    }
                                }}
                            />
                        </div>
                    </div>

                    <div className="bg-slate-900 text-slate-300 p-5 rounded-xl text-xs font-mono border border-slate-700 flex gap-4 items-start">
                        <Microscope className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
                        <div className="leading-relaxed">
                            <strong className="text-white block mb-1">ANALYSIS PROTOCOL:</strong>
                            Efficiency is calculated as <span className="text-indigo-300">Stability Days per Minute Studied (Real Time)</span>. 
                            <br/>
                            Scores > 1.0 indicate high-leverage learning. Scores below 0.2 suggest significant cognitive friction or distraction.
                            <br/>
                            <strong>Avg Block Time</strong> measures how long you spend actually interacting with a problem (Checkpoints).
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
