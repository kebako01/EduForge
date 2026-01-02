
import React, { useState } from 'react';
import { BookOpen, Settings, Plus, FastForward, RotateCcw, LayoutDashboard, Menu, X } from 'lucide-react';
import { Editor } from './components/Editor';
import { ReviewHub } from './components/ReviewHub';
import { SettingsModal } from './components/SettingsModal';
import { PageAIModal } from './components/PageAIModal';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { useTime } from './contexts/TimeContext';
import { StrategicMission } from './types';

type View = 'editor' | 'review';

// Strategist State Interface for persistence
export interface StrategistState {
    isOpen: boolean;
    step: 'prompt' | 'ingest';
    prompt: string;
    jsonInput: string;
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('review'); 
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Mobile Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // AI Modal State (Page Generator) - Now includes onCreated callback
  const [aiModalState, setAIModalState] = useState<{ 
      isOpen: boolean; 
      topic?: string; 
      context?: string; 
      blueprint?: string;
      onCreated?: (pageId: string) => Promise<void>;
  }>({ isOpen: false });

  // --- LIFTED STATE FOR PERSISTENCE ---
  
  // 1. The Missions (The Output)
  const [evolutionMissions, setEvolutionMissions] = useState<StrategicMission[]>([]);
  
  // 2. The Strategist Wizard (The Process) - Preserves text if user tabs away
  const [strategistState, setStrategistState] = useState<StrategistState>({
      isOpen: false,
      step: 'prompt',
      prompt: '',
      jsonInput: ''
  });

  const { virtualNow, advanceTime, resetTime } = useTime();

  // Load pages
  const pages = useLiveQuery(() => db.pages.toArray(), []) || [];

  const openPage = (id: string) => {
      setActivePageId(id);
      setCurrentView('editor');
      setIsSidebarOpen(false); // Close sidebar on mobile nav
  };

  const navigateToView = (view: View) => {
      setCurrentView(view);
      setActivePageId(null);
      setIsSidebarOpen(false);
  }

  // Updated to accept onCreated callback
  const openAIModal = (topic?: string, context?: string, blueprint?: string, onCreated?: (pageId: string) => Promise<void>) => {
      setAIModalState({ isOpen: true, topic, context, blueprint, onCreated });
  };

  const currentDateDisplay = new Date(virtualNow).toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });

  return (
    <div className="flex h-screen w-full overflow-hidden font-sans bg-gray-50">
      
      {/* MOBILE BACKDROP */}
      {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />
      )}

      {/* SIDEBAR (Responsive) */}
      <aside className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 transition-transform duration-300 ease-in-out
          md:relative md:translate-x-0
          ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        <div className="p-5 border-b border-gray-100 relative flex justify-between items-center">
            <div 
                className="flex items-center space-x-2 text-indigo-700 cursor-pointer select-none" 
                onClick={() => setIsDebugOpen(!isDebugOpen)}
            >
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
                    E
                </div>
                <span className="font-bold text-lg tracking-tight text-gray-900">EduForge</span>
            </div>
            
            {/* Close Button (Mobile Only) */}
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
            </button>

            {/* Time Travel Debug Dropdown */}
            {isDebugOpen && (
                <div className="absolute top-16 left-4 right-4 bg-white border-2 border-indigo-100 rounded-xl shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center space-x-2 text-indigo-500 mb-2">
                         <FastForward className="w-4 h-4" />
                         <span className="text-[10px] font-bold uppercase tracking-widest">Time Travel (Debug)</span>
                    </div>
                    
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-medium text-gray-500">Current:</span>
                        <span className="text-sm font-bold text-gray-900 font-mono">{currentDateDisplay}</span>
                    </div>

                    <div className="flex space-x-2">
                        <button 
                            onClick={() => advanceTime(1)}
                            className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center"
                        >
                            +1 Day
                        </button>
                        <button 
                            onClick={resetTime}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-1.5 rounded-lg transition-colors"
                            title="Reset Time"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            
            {/* Main Command Center */}
            <button 
                onClick={() => navigateToView('review')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors mb-4
                    ${currentView === 'review' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-700 hover:bg-gray-100'}
                `}
            >
                <LayoutDashboard className="w-4 h-4" />
                <span className="font-bold text-sm">Review Hub</span>
            </button>

            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3 mt-4">Workspace</div>
            
            <button 
                onClick={() => { setActivePageId(null); setCurrentView('editor'); setIsSidebarOpen(false); }}
                className="w-full flex items-center space-x-3 px-3 py-2 text-gray-600 rounded-md hover:bg-gray-50 transition-colors group mb-2"
            >
                <Plus className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                <span className="font-medium text-sm">New Project</span>
            </button>

            <div className="space-y-0.5">
                {pages?.map(page => (
                    <button 
                        key={page.id}
                        onClick={() => openPage(page.id)}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors truncate
                            ${activePageId === page.id && currentView === 'editor' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}
                        `}
                    >
                        <BookOpen className={`w-4 h-4 flex-shrink-0 ${activePageId === page.id ? 'text-indigo-500' : 'text-gray-400'}`} />
                        <span className="font-medium text-sm truncate">{page.title}</span>
                    </button>
                ))}
            </div>

        </nav>

        <div className="p-4 border-t border-gray-100">
            <button 
                onClick={() => { setIsSettingsOpen(true); setIsSidebarOpen(false); }}
                className="w-full flex items-center space-x-3 px-3 py-2 text-gray-500 hover:text-gray-900 transition-colors hover:bg-gray-50 rounded-md"
            >
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">Settings</span>
            </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
          
          {/* MOBILE TOP HEADER */}
          <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200 sticky top-0 z-30">
              <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 active:bg-gray-200"
                  >
                      <Menu className="w-6 h-6" />
                  </button>
                  <span className="font-bold text-gray-900">EduForge</span>
              </div>
              <div className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                  {currentDateDisplay}
              </div>
          </div>

          {/* Router Content */}
          <div className="flex-1 overflow-hidden relative">
            {currentView === 'editor' ? (
                <Editor 
                    pageId={activePageId} 
                    onPageCreated={openPage}
                    onOpenAI={openAIModal}
                    onClose={() => { setActivePageId(null); setCurrentView('review'); }}
                />
            ) : (
                <ReviewHub 
                    onNavigateToPage={openPage} 
                    onOpenAI={() => openAIModal()}
                    evolutionMissions={evolutionMissions} // Pass PERSISTENT State
                    onSetEvolutionMissions={setEvolutionMissions} // Pass Setter
                    strategistState={strategistState}
                    setStrategistState={setStrategistState}
                />
            )}
          </div>
      </div>

      {/* Global Modals */}
      <PageAIModal 
        isOpen={aiModalState.isOpen} 
        onClose={() => setAIModalState(prev => ({ ...prev, isOpen: false }))} 
        onPageCreated={async (id) => {
            setAIModalState(prev => ({ ...prev, isOpen: false }));
            if (aiModalState.onCreated) {
                await aiModalState.onCreated(id);
            }
            openPage(id);
        }}
        initialTopic={aiModalState.topic}
        initialContext={aiModalState.context}
        initialBlueprint={aiModalState.blueprint}
      />

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />

    </div>
  );
};

export default App;
