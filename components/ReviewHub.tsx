
import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Block, StrategicMission } from '../types';
import { Brain, Compass, Network, Crown } from 'lucide-react';
import { useTime } from '../contexts/TimeContext';
import { calculateHeroProfile } from '../utils/gamification';
import { StrategistState } from '../App';
import { getEstimatedMinutes } from '../utils/learning';

// Modular Tabs
import { ReviewAtlas } from './ReviewAtlas';
import { ReviewEvolution } from './ReviewEvolution';
import { ReviewConquest } from './ReviewConquest';

type ReviewTab = 'conquest' | 'atlas' | 'strategy';

export const ReviewHub: React.FC<{ 
    onNavigateToPage: (id: string) => void;
    onOpenAI: () => void;
    // Props passed from App.tsx to maintain persistence
    evolutionMissions: StrategicMission[];
    onSetEvolutionMissions: (missions: StrategicMission[]) => void;
    strategistState: StrategistState;
    setStrategistState: React.Dispatch<React.SetStateAction<StrategistState>>;
}> = ({ onNavigateToPage, onOpenAI, evolutionMissions, onSetEvolutionMissions, strategistState, setStrategistState }) => {
    const [activeTab, setActiveTab] = useState<ReviewTab>('conquest');
    const { virtualNow } = useTime(); 
    
    // --- DATA FETCHING (Centralized) ---
    const allData = useLiveQuery(async () => {
        const pages = await db.pages.toArray();
        const now = virtualNow; 
        
        let overdueItems: { pageTitle: string; block: Block }[] = [];
        let forecastCounts = Array(7).fill(0); 
        let forecastLoad = Array(7).fill(0); // Track minutes

        // RETRO & EVOLUTION METRICS
        const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
        let weeklyReviewedCount = 0;
        let weeklyMasterySum = 0;
        let weeklyConcepts = new Set<string>();
        const conceptActivity: Record<string, number> = {};

        // AGGREGATION MAP: Track the "Most Urgent" status for each unique Entity ID
        // This solves the issue where variations might hide the fact that a concept is due.
        const entityStatusMap = new Map<string, { due: number, block: Block, pageTitle: string }>();

        pages.forEach(page => {
            page.blocks.forEach(block => {
                
                // 1. STRATEGY & FORECAST LOGIC (Unique Concepts Only)
                if (block.srs && block.srs.entityId) {
                    const entityId = block.srs.entityId;
                    
                    // Default to 'now' if nextReviewDue is missing (treat new items as immediately actionable)
                    const due = block.srs.nextReviewDue ?? now;
                    
                    const existing = entityStatusMap.get(entityId);
                    
                    // Update if this block is MORE urgent (earlier due date) than what we have stored
                    // OR if we haven't seen this entity yet.
                    if (!existing || due < existing.due) {
                        entityStatusMap.set(entityId, { due, block, pageTitle: page.title });
                    }
                }

                // 2. RETRO LOGIC (All Activity)
                // For "Work Done", we DO count every repetition, even duplicates/variations.
                const checkActivity = (b: Block) => {
                    if (b.srs && b.srs.lastReviewed && b.srs.lastReviewed > weekAgo) {
                        weeklyReviewedCount++;
                        weeklyMasterySum += b.srs.masteryScore;
                        weeklyConcepts.add(b.srs.entityId);
                        conceptActivity[b.srs.entityId] = (conceptActivity[b.srs.entityId] || 0) + 1;
                    }
                };
                
                checkActivity(block);
                block.variations?.forEach(checkActivity);
            });
        });

        // POPULATE FORECAST BUCKETS FROM AGGREGATED ENTITIES
        entityStatusMap.forEach(({ due, block, pageTitle }) => {
            const minutes = getEstimatedMinutes(block.type);

            if (due <= now) {
                // Urgent / Overdue (Index 0)
                overdueItems.push({ pageTitle, block });
                forecastCounts[0]++;
                forecastLoad[0] += minutes;
            } else {
                // Future Projection
                const diffDays = Math.ceil((due - now) / (86400000));
                // Clamp to 1-6 days (Tomorrow to Next Week)
                if (diffDays > 0 && diffDays < 7) {
                    forecastCounts[diffDays]++;
                    forecastLoad[diffDays] += minutes;
                }
            }
        });

        const weeklyMasteryAvg = weeklyReviewedCount > 0 ? Math.round(weeklyMasterySum / weeklyReviewedCount) : 0;
        const topConcept = Object.entries(conceptActivity).sort((a,b) => b[1] - a[1])[0]?.[0] || 'None';

        // HERO PROFILE (For Conquest Mode)
        const hero = calculateHeroProfile(pages);

        return { 
            pages, overdueItems, forecastCounts, forecastLoad,
            retro: { weeklyReviewedCount, weeklyMasteryAvg, topConcept, weeklyConcepts: Array.from(weeklyConcepts) },
            hero
        };
    }, [virtualNow]);

    if (!allData) return <div className="flex h-screen items-center justify-center text-gray-400"><Brain className="w-8 h-8 animate-pulse mr-2"/>Loading Neural Network...</div>;

    return (
        <div className="flex-1 bg-gray-50 h-screen overflow-y-auto">
            <div className="max-w-6xl mx-auto p-4 md:p-8">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4 md:gap-0">
                    <div>
                        <div className="flex items-center space-x-2 text-indigo-600 mb-1">
                            <Brain className="w-6 h-6" />
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Review Hub</h1>
                        </div>
                        <p className="text-gray-500">Manage your knowledge retention and neural evolution.</p>
                    </div>
                    
                    {/* Navigation Tabs */}
                    <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
                        <button 
                            onClick={() => setActiveTab('conquest')}
                            className={`px-3 md:px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center space-x-2 whitespace-nowrap ${activeTab === 'conquest' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Crown className="w-4 h-4" />
                            <span className="hidden sm:inline">Conquest</span>
                            <span className="sm:hidden">Conquest</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('strategy')}
                            className={`px-3 md:px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center space-x-2 whitespace-nowrap ${activeTab === 'strategy' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Compass className="w-4 h-4" />
                            <span className="hidden sm:inline">Strategy</span>
                            <span className="sm:hidden">Strategy</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('atlas')}
                            className={`px-3 md:px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center space-x-2 whitespace-nowrap ${activeTab === 'atlas' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Network className="w-4 h-4" />
                            <span className="hidden sm:inline">Atlas</span>
                            <span className="sm:hidden">Atlas</span>
                        </button>
                    </div>
                </div>

                {/* Content Render */}
                {activeTab === 'conquest' && (
                    <ReviewConquest 
                        hero={allData.hero} 
                        retroStats={allData.retro}
                        onNavigateToPage={onNavigateToPage} 
                        onOpenAI={onOpenAI} 
                    />
                )}
                {activeTab === 'strategy' && (
                    <ReviewEvolution 
                        forecastCounts={allData.forecastCounts} 
                        forecastLoad={allData.forecastLoad}
                        overdueItems={allData.overdueItems} 
                        virtualNow={virtualNow} 
                        onNavigateToPage={onNavigateToPage}
                        activeMissions={evolutionMissions} // Using Prop
                        onSetMissions={onSetEvolutionMissions} // Using Prop
                        strategistState={strategistState} // Pass Persistence
                        setStrategistState={setStrategistState} // Pass Persistence
                    />
                )}
                {activeTab === 'atlas' && (
                    <ReviewAtlas 
                        pages={allData.pages} 
                        virtualNow={virtualNow} 
                        onNavigateToPage={onNavigateToPage} 
                    />
                )}
            </div>
        </div>
    );
};
