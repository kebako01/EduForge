
import { SRSData, Block, Page, BlockType, HabitBlock } from '../types';
import { Rating, schedule, createEmptyStats, State, FSRSStats } from './fsrs';

// Threshold to consider multiple interactions as a SINGLE review session (e.g., 20 minutes)
const SESSION_WINDOW_MS = 20 * 60 * 1000; 

// CRITICAL STABILITY THRESHOLD (Days)
const CRITICAL_STABILITY_THRESHOLD = 2.0;

// EXPECTED DURATION PER TYPE (Baseline in ms for "Good" performance)
const BASELINE_DURATIONS: Record<string, number> = {
    'mcq': 15000,    // 15s to read and decide
    'input': 25000,  // 25s to type
    'match': 30000,  // 30s to connect
    'sort': 30000,   // 30s to order
    'socratic': 60000 // 60s to think and write
};

// Helper to estimate time (minutes) based on block type for Forecasts
export const getEstimatedMinutes = (type: string) => {
    switch(type) {
        case 'socratic': return 3;
        case 'code': return 5;
        case 'canvas': return 3;
        case 'match': return 2;
        case 'sort': return 2;
        case 'math': return 2;
        default: return 1; // MCQ, Text, Input default to 1 min
    }
};

// --- STRATEGIC PLANNER (THE AI BRAIN) ---

export interface StrategicMission {
    id: string;
    title: string;
    type: 'REPAIR' | 'EXPANSION' | 'SYNTHESIS';
    reason: string;
    items: { pageTitle: string; block: Block }[];
    priority: number;
}

export interface PlannerOutput {
    missions: StrategicMission[];
    orphans: { pageTitle: string; block: Block }[];
}

export const planEvolutionStrategy = (overdueItems: { pageTitle: string; block: Block }[]): PlannerOutput => {
    if (overdueItems.length === 0) return { missions: [], orphans: [] };

    const missions: StrategicMission[] = [];
    const orphans: typeof overdueItems = [];

    // 1. Cluster by Domain/Subtopic
    const clusters: Record<string, typeof overdueItems> = {};
    
    overdueItems.forEach(item => {
        let key = 'General';
        if (item.block.srs?.entityId) {
            const parts = item.block.srs.entityId.split('.');
            // Group by strict subtopic (e.g. physics.mechanics) to ensure coherence
            if (parts.length > 2) key = `${parts[1]}.${parts[2]}`;
            else if (parts.length > 1) key = parts[1];
        }
        if (!clusters[key]) clusters[key] = [];
        clusters[key].push(item);
    });

    // 2. Evaluate Clusters vs Orphans
    Object.entries(clusters).forEach(([key, items]) => {
        // Rule: A mission needs at least 2 items to be worth a "Page". 
        // Or 1 item if it is CRITICAL repair (High Priority).
        
        const criticalCount = items.filter(i => (i.block.srs?.stability || 0) < 2.0).length;
        const avgStability = items.reduce((acc, i) => acc + (i.block.srs?.stability || 0), 0) / items.length;
        const topicName = key.split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(': ');

        if (items.length >= 2 || criticalCount > 0) {
            // Create Mission
            let type: StrategicMission['type'] = 'SYNTHESIS';
            let title = `${topicName} Integration`;
            let reason = "Routine consolidation of knowledge.";
            let priority = 1;

            if (criticalCount > 0) {
                type = 'REPAIR';
                title = `${topicName} Reinforcement`;
                reason = "Detected foundational cracks. Immediate intervention required.";
                priority = 10 + criticalCount;
            } else if (avgStability > 20) {
                type = 'EXPANSION';
                title = `${topicName} Evolution`;
                reason = "Concepts are stable. Ready for Level +1 complexity.";
                priority = 5;
            }

            missions.push({
                id: `mission-${key}-${Date.now()}`,
                title,
                type,
                reason,
                items,
                priority
            });
        } else {
            // Not enough mass for a dedicated mission -> Orphan
            orphans.push(...items);
        }
    });

    // Sort missions by priority
    missions.sort((a,b) => b.priority - a.priority);

    return { missions, orphans };
};

// --- HABIT & LIFE LOGIC ---

export const isSameDay = (d1: number, d2: number) => {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
};

export const calculateStreak = (history: number[], referenceTime: number = Date.now()): number => {
    if (!history || history.length === 0) return 0;
    
    // Normalize reference time to midnight
    const today = new Date(referenceTime).setHours(0,0,0,0);
    const yesterday = today - 86400000;
    
    // Get unique days from history, sorted descending
    // Filter out dates strictly in the future relative to referenceTime to prevent glitches if jumping back in time
    const days = Array.from(new Set(history.map(h => new Date(h).setHours(0,0,0,0))))
                      .filter(d => d <= today)
                      .sort((a,b) => b - a);
    
    if (days.length === 0) return 0;

    // The latest entry MUST be today or yesterday to maintain a streak
    const latest = days[0];
    
    if (latest !== today && latest !== yesterday) {
        return 0;
    }

    let streak = 0;
    let expectedDay = latest; // Start counting from the latest valid entry

    for (const day of days) {
        if (day === expectedDay) {
            streak++;
            expectedDay -= 86400000; // Move expected day back by one
        } else {
            // Gap found
            break; 
        }
    }
    
    return streak;
};

// --- ACHIEVEMENT LOGIC ---

export interface AchievementDef {
    id: string;
    title: string;
    description: string;
    iconName: 'trophy' | 'map' | 'crown' | 'flame' | 'zap'; // Mapped in UI
    color: string;
    isUnlocked: boolean;
    progress?: number;
    maxProgress?: number;
}

export const calculateAchievements = (pages: Page[]): AchievementDef[] => {
    let highStabilityCount = 0;
    let interdisciplinaryPages = 0;
    let totalMastery = 0;
    let learnableBlockCount = 0;
    let totalReviews = 0;
    let habitStreaks = 0;

    pages.forEach(p => {
        const domains = new Set<string>();
        p.blocks.forEach(b => {
            if (b.type === BlockType.HABIT) {
                const habit = b as HabitBlock;
                if (habit.streak >= 7) habitStreaks++;
            }

            if (b.srs) {
                learnableBlockCount++;
                totalMastery += b.srs.masteryScore || 0;
                totalReviews += b.srs.repetitionCount || 0;
                if (b.srs.stability > 30) highStabilityCount++;
                
                // Extract domain (e.g. concept.physics.gravity -> physics)
                if (b.srs.entityId) {
                    const parts = b.srs.entityId.split('.');
                    if (parts.length > 1) domains.add(parts[1]);
                }
            }
            b.variations?.forEach(v => {
                if (v.srs && v.srs.stability > 30) highStabilityCount++;
            });
        });
        if (domains.size >= 3) interdisciplinaryPages++;
    });

    const avgMastery = learnableBlockCount > 0 ? totalMastery / learnableBlockCount : 0;

    return [
        {
            id: 'foundation',
            title: 'Solid Foundations',
            description: 'Maintain >30 days stability on 10+ concepts.',
            iconName: 'trophy',
            color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
            isUnlocked: highStabilityCount >= 10,
            progress: highStabilityCount,
            maxProgress: 10
        },
        {
            id: 'explorer',
            title: 'Interdisciplinary',
            description: 'Create a lesson mixing 3+ distinct domains.',
            iconName: 'map',
            color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
            isUnlocked: interdisciplinaryPages > 0,
            progress: interdisciplinaryPages,
            maxProgress: 1
        },
        {
            id: 'master',
            title: 'Grandmaster',
            description: 'Achieve 90% average mastery across the board.',
            iconName: 'crown',
            color: 'text-amber-600 bg-amber-50 border-amber-200',
            isUnlocked: learnableBlockCount > 5 && avgMastery >= 90,
            progress: Math.round(avgMastery),
            maxProgress: 100
        },
        {
            id: 'habit',
            title: 'Ritual Master',
            description: 'Maintain a 7-day streak on any habit.',
            iconName: 'flame',
            color: 'text-orange-600 bg-orange-50 border-orange-200',
            isUnlocked: habitStreaks > 0,
            progress: habitStreaks > 0 ? 1 : 0,
            maxProgress: 1
        },
        {
            id: 'dedication',
            title: 'Deep Practice',
            description: 'Complete 50 total reviews.',
            iconName: 'zap',
            color: 'text-rose-600 bg-rose-50 border-rose-200',
            isUnlocked: totalReviews >= 50,
            progress: totalReviews,
            maxProgress: 50
        }
    ];
};

export const getWeeklyStatus = (now: number, weeklyReviewCount: number) => {
    const date = new Date(now);
    const day = date.getDay();
    const isWeekend = day === 0 || day === 5 || day === 6;
    const hasEnoughVolume = weeklyReviewCount >= 10;
    const isUnlocked = isWeekend || hasEnoughVolume;
    let message = "Available now.";
    if (!isUnlocked) {
        if (!isWeekend) message = "Unlocks on Friday.";
        if (!hasEnoughVolume) message += ` (Or review ${10 - weeklyReviewCount} more blocks)`;
    }
    return { isUnlocked, message };
};

// --- SCIENTIFIC FSRS LOGIC REVOLUTION ---

/**
 * Heuristic Grader: Translates raw interaction data into FSRS Ratings.
 * Based on "Desirable Difficulty" and "Response Latency".
 */
const calculateInteractionQuality = (
    isCorrect: boolean,
    attempts: number,
    hintsUsed: number,
    timeSpent: number,
    blockType: string,
    currentReps: number
): Rating => {
    if (!isCorrect) return Rating.Again;

    // 1. Penalty for Hints (The "Scaffold" Tax)
    // If hints were used, it can NEVER be Easy. Max is Good or Hard.
    if (hintsUsed > 0) {
        return hintsUsed > 1 ? Rating.Again : Rating.Hard;
    }

    // 2. Penalty for Attempts (The "Friction" Tax)
    if (attempts === 2) return Rating.Hard;
    if (attempts > 2) return Rating.Again;

    // 3. Latency Analysis (The "Fluency" Check)
    const baseline = BASELINE_DURATIONS[blockType] || 15000;
    
    // PRODUCTION FIX: If it's a NEW item (reps === 0), be lenient.
    // Thinking time is natural during encoding. Only penalize on Review.
    if (currentReps === 0) {
        // Only penalize EXTREME slowness on first learn
        if (timeSpent > baseline * 3) return Rating.Hard; 
        return Rating.Good;
    }
    
    // Fast Response (< 60% of baseline) -> Easy (High Fluency)
    if (timeSpent < baseline * 0.6) return Rating.Easy;
    
    // Slow Response (> 150% of baseline) -> Hard (High Cognitive Load)
    if (timeSpent > baseline * 1.5) return Rating.Hard;

    // Normal Response -> Good
    return Rating.Good;
};

export const processSessionCompletion = (
    currentSRS: SRSData | undefined, 
    isCorrect: boolean, 
    attempts: number,
    now: number = Date.now(),
    interactionMeta?: { timeSpent: number; hintsUsed: number; blockType: string }
): SRSData => {
    
    const currentReps = currentSRS?.repetitionCount || 0;

    // 1. Scientific Rating Calculation
    const rating = interactionMeta 
        ? calculateInteractionQuality(isCorrect, attempts, interactionMeta.hintsUsed, interactionMeta.timeSpent, interactionMeta.blockType, currentReps)
        : (isCorrect ? (attempts === 1 ? Rating.Good : Rating.Hard) : Rating.Again); // Fallback

    // 2. Hydrate FSRS Stats
    let stats: FSRSStats;

    if (!currentSRS) {
        stats = createEmptyStats(now);
    } else {
        stats = {
            stability: currentSRS.stability,
            difficulty: currentSRS.difficulty,
            reps: currentSRS.repetitionCount,
            lapses: 0, 
            state: currentSRS.repetitionCount === 0 ? State.New : State.Review,
            last_review: currentSRS.lastReviewed || now,
            due: currentSRS.nextReviewDue || now
        };
    }

    // 3. Intelligent Scheduling
    const timeSinceLastReview = now - stats.last_review;
    // Anti-spam: If reviewing again within 20 mins, treating as same session consolidation
    const isConsolidation = timeSinceLastReview < SESSION_WINDOW_MS && stats.reps > 0;

    let newStats: FSRSStats;

    if (isConsolidation) {
        newStats = { ...stats, last_review: now }; 
        // Only penalize if they forgot it immediately after learning it
        if (rating === Rating.Again) {
            newStats.stability = Math.max(0.1, newStats.stability * 0.8);
            newStats.due = now + (1 * 24 * 60 * 60 * 1000); 
        } 
    } else {
        newStats = schedule(stats, rating, now);
    }

    // 4. Mastery Calculation (Adaptive Scaling)
    // PRODUCTION IMPROVEMENT: 
    // Level 1 items shouldn't need 100 days for mastery. 21 days is huge for Lvl 1.
    // Higher levels require longer stability to be "Mastered".
    const level = currentSRS?.level || 1;
    const stabilityTarget = level === 1 ? 21 : (level <= 3 ? 60 : 100);
    const mastery = Math.min(100, Math.round((newStats.stability / stabilityTarget) * 100));

    return {
        entityId: currentSRS?.entityId || `gen.${crypto.randomUUID()}`,
        repetitionCount: newStats.reps,
        stability: newStats.stability,
        difficulty: newStats.difficulty,
        lastReviewed: newStats.last_review,
        nextReviewDue: newStats.due,
        masteryScore: mastery,
        level: level,
        name: currentSRS?.name,
        objective: currentSRS?.objective,
        integratedLevels: currentSRS?.integratedLevels
    };
};

/**
 * ATOMIC PAGE AGGREGATION
 * Calculates the health of a "Page" based on its constituent "Blocks".
 * Uses Harmonic Mean to ensure "A chain is only as strong as its weakest link".
 */
export const calculatePageLifecycle = (blocks: Block[], now: number): { status: 'active' | 'locked', nextReview: number } => {
    const learnableBlocks = blocks.filter(b => b.srs);
    
    if (learnableBlocks.length === 0) {
        return { status: 'active', nextReview: 0 };
    }

    // 1. Find the Earliest Due Date (The Limiting Factor)
    // The page is due when its FIRST block is due.
    const nextReview = Math.min(...learnableBlocks.map(b => b.srs?.nextReviewDue || now));

    // 2. Determine Lock Status
    // If the next review is in the future (> 1 hour from now), lock it to prevent over-study.
    // We give a 1-hour buffer for "immediate review" scenarios.
    const isDue = nextReview <= (now + 60 * 60 * 1000);

    return {
        status: isDue ? 'active' : 'locked',
        nextReview: nextReview
    };
};

export const generateAdaptiveSession = (rootBlock: Block, limit: number = 5): { queue: Block[], strategy: string, reason: string, criticalCount: number } => {
    const allVariations = [rootBlock, ...(rootBlock.variations || [])];
    const learnableBlocks = allVariations.filter(b => b.srs).sort((a, b) => (a.srs?.level || 1) - (b.srs?.level || 1));
    
    if (learnableBlocks.length === 0) return { queue: [], strategy: 'MAINTENANCE', reason: "No content.", criticalCount: 0 };

    const maxLevel = learnableBlocks[learnableBlocks.length - 1].srs?.level || 1;
    const session: Block[] = [];
    const addedIds = new Set<string>();

    const addToSession = (block: Block) => {
        if (!addedIds.has(block.id) && session.length < limit) {
            session.push(block);
            addedIds.add(block.id);
        }
    };

    // Priority 1: Critical Repair (Stability < 2 days)
    const criticalItems = learnableBlocks
        .filter(b => (b.srs?.stability || 0) < CRITICAL_STABILITY_THRESHOLD && (b.srs?.repetitionCount || 0) > 0)
        .sort((a, b) => (a.srs?.level || 1) - (b.srs?.level || 1));

    let strategy = 'MAINTENANCE';
    let reason = "Routine spaced repetition.";

    if (criticalItems.length > 0) {
        strategy = 'CRITICAL_REPAIR';
        reason = `Detected ${criticalItems.length} foundational cracks. Repairing Level ${criticalItems[0].srs?.level} first.`;
        criticalItems.forEach(addToSession);
    } else {
        // Priority 2: Expansion
        if (session.length < limit) {
            const expansionCandidates = learnableBlocks.filter(b => (b.srs?.level || 1) === maxLevel);
            const focusItem = expansionCandidates.sort((a, b) => (a.srs?.masteryScore || 0) - (b.srs?.masteryScore || 0))[0];
            if (focusItem) {
                strategy = 'EXPANSION';
                reason = `Foundation stable. Expanding Level ${maxLevel}.`;
                addToSession(focusItem);
            }
        }
    }

    // Priority 3: Maintenance (Overdue items)
    if (session.length < limit) {
        const now = Date.now();
        const overdueItems = learnableBlocks
            .filter(b => !addedIds.has(b.id) && (b.srs?.nextReviewDue || 0) <= now)
            .sort((a, b) => (a.srs?.nextReviewDue || 0) - (b.srs?.nextReviewDue || 0));
        
        overdueItems.forEach(addToSession);
    }

    // Priority 4: Random Interleaving
    if (session.length < limit) {
        const remaining = learnableBlocks.filter(b => !addedIds.has(b.id));
        const shuffled = remaining.sort(() => 0.5 - Math.random());
        shuffled.forEach(addToSession);
    }

    return {
        queue: session.sort((a, b) => (a.srs?.level || 1) - (b.srs?.level || 1)),
        strategy,
        reason,
        criticalCount: criticalItems.length
    };
};

export const aggregateConceptHealth = (rootBlock: Block, variations: Block[]): SRSData => {
    const all = [rootBlock, ...variations].filter(b => b.srs);
    if (all.length === 0) return rootBlock.srs!;

    const maxLevel = Math.max(...all.map(b => b.srs?.level || 1));
    const totalMastery = all.reduce((acc, b) => acc + (b.srs?.masteryScore || 0), 0);
    const avgMastery = Math.round(totalMastery / all.length);
    
    // Conservative Stability: We use the minimum stability to ensure no gaps are hidden by averages.
    const minStability = Math.min(...all.map(b => b.srs?.stability || 0));
    const nextDue = Math.min(...all.map(b => b.srs?.nextReviewDue || Date.now()));

    return {
        entityId: rootBlock.srs?.entityId || 'unknown',
        repetitionCount: all.length,
        stability: minStability,
        difficulty: 5,
        level: maxLevel,
        masteryScore: avgMastery,
        nextReviewDue: nextDue,
        name: rootBlock.srs?.name,
        objective: rootBlock.srs?.objective
    };
};
