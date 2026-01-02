
import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { calculateHeroProfile } from '../utils/gamification';
import { Trophy, Map, Crown, Flame, Zap, Lock, Shield, Star, Hexagon, Swords } from 'lucide-react';

const iconMap = {
    trophy: Trophy,
    map: Map,
    crown: Crown,
    flame: Flame,
    zap: Zap
};

export const AchievementsPage: React.FC = () => {
    const hero = useLiveQuery(async () => {
        const pages = await db.pages.toArray();
        return calculateHeroProfile(pages);
    }, []);

    if (!hero) return null;

    return (
        <div className="flex-1 h-screen overflow-y-auto bg-slate-50 p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-8 md:space-y-12">
                
                {/* --- HERO CARD (The RPG Header) --- */}
                <div className="relative bg-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-2xl overflow-hidden border border-slate-700">
                    
                    {/* Atmospheric Background */}
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600 rounded-full blur-[120px] opacity-20 pointer-events-none -translate-y-1/2 translate-x-1/4"></div>
                    <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-emerald-500 rounded-full blur-[100px] opacity-10 pointer-events-none translate-y-1/3 -translate-x-1/4"></div>

                    <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center md:items-start">
                        
                        {/* Avatar / Level Badge */}
                        <div className="relative flex-shrink-0">
                            <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-1 shadow-lg shadow-indigo-500/30 rotate-3">
                                <div className="w-full h-full bg-slate-900 rounded-xl flex items-center justify-center border border-white/10">
                                    <Crown className="w-12 h-12 md:w-16 md:h-16 text-amber-400 drop-shadow-md" />
                                </div>
                            </div>
                            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-md whitespace-nowrap">
                                Level {hero.level}
                            </div>
                        </div>

                        {/* Stats Area */}
                        <div className="flex-1 w-full">
                            <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start mb-2 text-center sm:text-left">
                                <div>
                                    <h2 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-1">Current Class</h2>
                                    <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{hero.title}</h1>
                                </div>
                                <div className="text-right mt-4 sm:mt-0">
                                    <div className="text-2xl font-mono font-bold text-white">{hero.currentXP.toLocaleString()} <span className="text-sm text-slate-400">XP</span></div>
                                    <div className="text-xs text-slate-400">Lifetime Experience</div>
                                </div>
                            </div>

                            {/* XP Bar */}
                            <div className="mt-6 mb-2 flex justify-between text-xs font-bold text-slate-400 uppercase">
                                <span>Progress to Level {hero.level + 1}</span>
                                <span>{hero.progressPercent}%</span>
                            </div>
                            <div className="h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700 relative">
                                <div 
                                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-400 transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(168,85,247,0.5)]"
                                    style={{ width: `${hero.progressPercent}%` }}
                                ></div>
                                {/* Shine Effect */}
                                <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)]" style={{ backgroundSize: '200% 100%' }}></div>
                            </div>
                            <div className="mt-2 text-right text-[10px] text-slate-500 font-mono">
                                Next Level in {hero.nextLevelXP - (hero.currentXP % hero.nextLevelXP)} XP
                            </div>

                            {/* Mini Stats Grid */}
                            <div className="grid grid-cols-3 gap-2 md:gap-4 mt-8">
                                <div className="bg-white/5 rounded-xl p-3 border border-white/5 backdrop-blur-sm text-center md:text-left">
                                    <div className="text-emerald-400 mb-1 flex justify-center md:justify-start"><Zap className="w-5 h-5" /></div>
                                    <div className="text-lg md:text-xl font-bold">{hero.stats.totalReviews}</div>
                                    <div className="text-[9px] md:text-[10px] text-slate-400 uppercase font-bold">Reviews</div>
                                </div>
                                <div className="bg-white/5 rounded-xl p-3 border border-white/5 backdrop-blur-sm text-center md:text-left">
                                    <div className="text-amber-400 mb-1 flex justify-center md:justify-start"><Flame className="w-5 h-5" /></div>
                                    <div className="text-lg md:text-xl font-bold">{hero.stats.highestStreak}</div>
                                    <div className="text-[9px] md:text-[10px] text-slate-400 uppercase font-bold">Best Streak</div>
                                </div>
                                <div className="bg-white/5 rounded-xl p-3 border border-white/5 backdrop-blur-sm text-center md:text-left">
                                    <div className="text-rose-400 mb-1 flex justify-center md:justify-start"><Shield className="w-5 h-5" /></div>
                                    <div className="text-lg md:text-xl font-bold">{hero.stats.badgesUnlocked}/{hero.achievements.length}</div>
                                    <div className="text-[9px] md:text-[10px] text-slate-400 uppercase font-bold">Quests</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- QUEST BOARD (Achievements) --- */}
                <div>
                    <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Swords className="w-5 h-5 text-indigo-600" />
                        <span>Quest Log</span>
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {hero.achievements.map((badge) => {
                            const Icon = iconMap[badge.iconName] || Trophy;
                            
                            return (
                                <div 
                                    key={badge.id}
                                    className={`
                                        group relative p-1 rounded-2xl transition-all duration-300
                                        ${badge.isUnlocked 
                                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg hover:shadow-xl hover:-translate-y-1' 
                                            : 'bg-slate-200'}
                                    `}
                                >
                                    {/* Inner Card */}
                                    <div className={`
                                        h-full bg-white rounded-xl p-6 relative overflow-hidden flex flex-col justify-between
                                        ${!badge.isUnlocked && 'bg-slate-50 opacity-90'}
                                    `}>
                                        {/* Background Decoration */}
                                        {badge.isUnlocked && (
                                            <div className="absolute -right-4 -top-4 text-indigo-50 opacity-20 transform rotate-12 group-hover:rotate-0 transition-transform duration-500">
                                                <Icon className="w-24 h-24" />
                                            </div>
                                        )}

                                        <div>
                                            <div className="flex justify-between items-start mb-4">
                                                <div className={`p-3 rounded-xl border-2 ${badge.isUnlocked ? `bg-white border-indigo-100 text-indigo-600 shadow-sm` : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                                                    {badge.isUnlocked ? <Icon className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
                                                </div>
                                                {badge.isUnlocked && (
                                                    <div className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1 border border-amber-200">
                                                        <Star className="w-3 h-3 fill-current" />
                                                        Complete
                                                    </div>
                                                )}
                                            </div>

                                            <h4 className={`font-bold text-lg mb-2 ${badge.isUnlocked ? 'text-slate-800' : 'text-slate-500'}`}>
                                                {badge.title}
                                            </h4>
                                            <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                                {badge.description}
                                            </p>
                                        </div>

                                        {/* Progress Bar (Visible even if locked) */}
                                        {badge.maxProgress && (
                                            <div className="mt-6">
                                                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                                                    <span>Progress</span>
                                                    <span className={badge.isUnlocked ? 'text-indigo-600' : ''}>
                                                        {Math.min(badge.progress || 0, badge.maxProgress)} / {badge.maxProgress}
                                                    </span>
                                                </div>
                                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                                    <div 
                                                        className={`h-full transition-all duration-1000 ${badge.isUnlocked ? 'bg-indigo-500' : 'bg-slate-400'}`}
                                                        style={{ width: `${Math.min(((badge.progress || 0) / badge.maxProgress) * 100, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
