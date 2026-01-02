
// FSRS v4 (Free Spaced Repetition Scheduler) Implementation
// Adapted for EduForge's TypeScript environment.

export interface FSRSReviewLog {
    rating: Rating; // 1: Again, 2: Hard, 3: Good, 4: Easy
    elapsed_days: number;
    scheduled_days: number;
    review: number; // Timestamp
    state: State;
}

export enum State {
    New = 0,
    Learning = 1,
    Review = 2,
    Relearning = 3,
}

export enum Rating {
    Again = 1,
    Hard = 2,
    Good = 3,
    Easy = 4,
}

export interface FSRSStats {
    stability: number;
    difficulty: number;
    reps: number;
    lapses: number;
    state: State;
    last_review: number; // Timestamp
    due: number; // Timestamp
}

// Default FSRS Parameters (Standard Weights)
const p = {
    w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61],
    request_retention: 0.9,
    maximum_interval: 36500,
};

export const createEmptyStats = (now: number = Date.now()): FSRSStats => ({
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    state: State.New,
    last_review: now,
    due: now,
});

// Helper: Interval calculation
const next_interval = (stability: number, retention: number): number => {
    return Math.max(1, Math.round(stability * 9 * (1 / retention - 1)));
};

// NEW: Scientific Retrievability Calculation
// R = 0.9 ^ (elapsed_days / stability)
export const getRetrievability = (stats: FSRSStats, now: number = Date.now()): number => {
    if (stats.state === State.New) return 0;
    const elapsed_days = (now - stats.last_review) / (1000 * 60 * 60 * 24);
    if (stats.stability === 0) return 0;
    return Math.pow(0.9, elapsed_days / stats.stability);
};

// Core Algorithm
export const schedule = (
    current: FSRSStats,
    rating: Rating,
    now: number = Date.now()
): FSRSStats => {
    const elapsed_days = current.state === State.New ? 0 : (now - current.last_review) / (1000 * 60 * 60 * 24);
    
    let new_stability = current.stability;
    let new_difficulty = current.difficulty;
    let new_state = current.state;
    let new_reps = current.reps;
    let new_lapses = current.lapses;

    // 1. Update Difficulty
    // D_{new} = D - w_6 * (R - 3)
    // clamped between 1 and 10
    if (current.state === State.New) {
        new_difficulty = p.w[4] - p.w[5] * (rating - 3);
    } else {
        new_difficulty = current.difficulty - p.w[6] * (rating - 3);
    }
    // Mean reversion
    new_difficulty = p.w[7] * p.w[4] + (1 - p.w[7]) * new_difficulty;
    new_difficulty = Math.min(Math.max(new_difficulty, 1), 10);

    // 2. Update Stability
    if (current.state === State.New) {
        new_stability = p.w[rating - 1];
        new_state = State.Learning;
    } else if (current.state === State.Learning || current.state === State.Relearning) {
         // Simplified Short-term scheduling
         new_stability = p.w[rating - 1]; // Reset stability for short term mostly
         new_state = rating === Rating.Good || rating === Rating.Easy ? State.Review : State.Learning;
    } else if (current.state === State.Review) {
        if (rating === Rating.Again) {
            // Forgetting curve
            new_stability = p.w[11] * Math.pow(new_difficulty, -p.w[12]) * (Math.pow(current.stability + 1, p.w[13]) - 1) * Math.exp(p.w[14] * (1 - p.request_retention));
            new_state = State.Relearning;
            new_lapses += 1;
        } else {
            // Memory reinforcement
            const hard_penalty = rating === Rating.Hard ? p.w[15] : 1;
            const easy_bonus = rating === Rating.Easy ? p.w[16] : 1;
            new_stability = current.stability * (1 + Math.exp(p.w[8]) * (11 - new_difficulty) * Math.pow(current.stability, -p.w[9]) * (Math.exp(p.w[10] * (1 - p.request_retention)) - 1) * hard_penalty * easy_bonus);
        }
    }

    new_reps += 1;

    // 3. Next Interval
    let interval = 1;
    if (new_state === State.Review) {
        interval = next_interval(new_stability, p.request_retention);
        interval = Math.min(interval, p.maximum_interval);
    }

    return {
        stability: Number(new_stability.toFixed(4)),
        difficulty: Number(new_difficulty.toFixed(4)),
        reps: new_reps,
        lapses: new_lapses,
        state: new_state,
        last_review: now,
        due: now + interval * 24 * 60 * 60 * 1000
    };
};
