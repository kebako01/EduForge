
import { Page, Block, BlockType, HabitBlock } from '../types';
import { AchievementDef, calculateAchievements } from './learning';

// --- CONFIGURATION ---
const XP_CONFIG = {
    PER_REVIEW: 15,          // XP per repetition count
    PER_MASTERY_POINT: 2,    // XP per % of mastery
    PER_HABIT_STREAK_DAY: 20,// XP per day in a streak
    PER_BADGE: 500,          // XP per unlocked achievement
    BASE_XP_PER_LEVEL: 1000, // XP needed for Level 1 -> 2
    CURVE_FACTOR: 1.2        // Exponential curve for difficulty
};

// --- NEW: REALM DEFINITION ---
export interface RealmStats {
    id: string; // e.g., "Physics"
    name: string;
    level: number; // Realm specific level based on mastery
    lightLevel: number; // 0-100% (Based on stability/due dates. High = Glowing, Low = Dark)
    pageCount: number;
    masteredBlocks: number;
    totalBlocks: number;
    isLocked: boolean; // True if 0 pages
}

export interface HeroProfile {
    level: number;
    currentXP: number;
    nextLevelXP: number;
    progressPercent: number;
    title: string;
    rankIcon: 'spark' | 'flame' | 'star' | 'sun' | 'nebula' | 'void';
    stats: {
        totalReviews: number;
        highestStreak: number;
        badgesUnlocked: number;
        totalMastery: number;
    };
    realms: RealmStats[]; // The territories
    achievements: AchievementDef[];
}

// --- ARCANIST TITLES ---
const RANKS = [
    { minLevel: 1, title: 'Spark Initiate', icon: 'spark' },
    { minLevel: 5, title: 'Flame Keeper', icon: 'flame' },
    { minLevel: 10, title: 'Light Weaver', icon: 'star' },
    { minLevel: 20, title: 'Sun Sentinel', icon: 'sun' },
    { minLevel: 30, title: 'Void Walker', icon: 'nebula' },
    { minLevel: 50, title: 'Cognition Archon', icon: 'void' },
];

export const calculateHeroProfile = (pages: Page[]): HeroProfile => {
    let totalReviews = 0;
    let totalMastery = 0;
    let highestStreak = 0;
    let habitXp = 0;

    // Domain Aggregation for Realms
    const realmMap: Record<string, { total: number, mastered: number, stabilitySum: number, dueCount: number }> = {};

    // 1. Calculate Raw Stats from Pages
    pages.forEach(p => {
        // Determine Domain (Realm)
        const domain = p.tags && p.tags.length > 0 ? p.tags[0].split('/')[0] : 'Uncharted';
        if (!realmMap[domain]) realmMap[domain] = { total: 0, mastered: 0, stabilitySum: 0, dueCount: 0 };

        p.blocks.forEach(b => {
            // SRS XP
            if (b.srs) {
                totalReviews += b.srs.repetitionCount || 0;
                totalMastery += b.srs.masteryScore || 0;
                
                // Realm Stats
                realmMap[domain].total++;
                if (b.srs.masteryScore > 80) realmMap[domain].mastered++;
                realmMap[domain].stabilitySum += b.srs.stability;
                if (b.srs.nextReviewDue && b.srs.nextReviewDue <= Date.now()) {
                    realmMap[domain].dueCount++;
                }
            }
            
            // Habit XP
            if (b.type === BlockType.HABIT) {
                const h = b as HabitBlock;
                if (h.streak > highestStreak) highestStreak = h.streak;
                // Sum of streaks calculation (Simplified approximation: current streak * value)
                habitXp += (h.streak * XP_CONFIG.PER_HABIT_STREAK_DAY); 
            }

            // Check variations
            b.variations?.forEach(v => {
                if (v.srs) {
                    totalReviews += v.srs.repetitionCount || 0;
                    totalMastery += v.srs.masteryScore || 0;
                }
            });
        });
    });

    // 2. Process Realms
    const realms: RealmStats[] = Object.entries(realmMap).map(([name, data]) => {
        // Calculate Light Level (Entropy Defense)
        // Base light is average stability cap at 30 days.
        // Penalty for overdue items.
        const avgStability = data.total > 0 ? data.stabilitySum / data.total : 0;
        const stabilityFactor = Math.min(100, (avgStability / 20) * 100); // 20 days avg = 100% light
        const penalty = data.dueCount * 10; // -10% light per overdue item
        const lightLevel = Math.max(0, Math.min(100, stabilityFactor - penalty));

        // Realm Level (based on mastery count)
        const realmLvl = Math.floor(Math.sqrt(data.mastered)); 

        return {
            id: name,
            name: name,
            level: realmLvl + 1,
            lightLevel: Math.round(lightLevel),
            pageCount: pages.filter(p => p.tags?.some(t => t.startsWith(name))).length,
            masteredBlocks: data.mastered,
            totalBlocks: data.total,
            isLocked: false
        };
    }).sort((a,b) => b.totalBlocks - a.totalBlocks); // Biggest realms first

    // 2. Calculate Achievements
    const achievements = calculateAchievements(pages);
    const badgesUnlocked = achievements.filter(a => a.isUnlocked).length;

    // 3. Calculate Total XP
    const reviewXP = totalReviews * XP_CONFIG.PER_REVIEW;
    const masteryXP = totalMastery * XP_CONFIG.PER_MASTERY_POINT;
    const badgeXP = badgesUnlocked * XP_CONFIG.PER_BADGE;
    
    const currentXP = reviewXP + masteryXP + habitXp + badgeXP;

    // 4. Calculate Level (Inverse of Geometric Progression)
    let level = 1;
    let xpForNext = 500;
    let xpAccumulated = 0;
    
    // Simple iterative solver to find level
    while (true) {
        // Level N requires: 500 * N * 1.1
        const levelCost = Math.floor(500 * level * Math.pow(1.05, level - 1));
        if (currentXP < xpAccumulated + levelCost) {
            xpForNext = levelCost; // XP needed for THIS specific level
            break;
        }
        xpAccumulated += levelCost;
        level++;
    }

    const xpInCurrentLevel = currentXP - xpAccumulated;
    const progressPercent = Math.min(100, Math.round((xpInCurrentLevel / xpForNext) * 100));

    // 5. Determine Rank
    let currentRank = RANKS[0];
    for (let i = RANKS.length - 1; i >= 0; i--) {
        if (level >= RANKS[i].minLevel) {
            currentRank = RANKS[i];
            break;
        }
    }

    return {
        level,
        currentXP,
        nextLevelXP: xpForNext, // Display XP needed to finish CURRENT level
        progressPercent,
        title: currentRank.title,
        rankIcon: currentRank.icon as any,
        stats: {
            totalReviews,
            highestStreak,
            badgesUnlocked,
            totalMastery
        },
        realms,
        achievements
    };
};

/**
 * Calculates XP gained from a single session for the Victory Screen
 */
export const calculateSessionXP = (blocksCompleted: number, masteryGain: number): number => {
    return (blocksCompleted * XP_CONFIG.PER_REVIEW) + (masteryGain * XP_CONFIG.PER_MASTERY_POINT);
};
