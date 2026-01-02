
import React, { useState, useRef } from 'react';
import { X, Download, Upload, Database, Check, AlertCircle, Loader2, Trash2, RotateCcw, AlertTriangle, Microscope } from 'lucide-react';
import { db, seedDatabase } from '../db';
import { EffectivenessResearch } from './EffectivenessResearch';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [confirmAction, setConfirmAction] = useState<'clear' | 'restore' | null>(null);
    const [showResearch, setShowResearch] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    if (showResearch) {
        return <EffectivenessResearch onClose={() => setShowResearch(false)} />;
    }

    const handleExport = async () => {
        try {
            setStatus('loading');
            setMessage('Generating backup...');
            const allPages = await db.pages.toArray();
            const dataStr = JSON.stringify(allPages, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `eduforge-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setStatus('success');
            setMessage('Backup downloaded successfully.');
            setTimeout(() => setStatus('idle'), 3000);
        } catch (e) {
            setStatus('error');
            setMessage('Failed to export data.');
        }
    };

    const handleImportTrigger = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setStatus('loading');
            setMessage('Parsing backup file...');
            const text = await file.text();
            const data = JSON.parse(text);

            if (!Array.isArray(data)) throw new Error("Invalid backup format");

            // Validate basic structure
            const isValid = data.every(p => p.id && p.title && Array.isArray(p.blocks));
            if (!isValid) throw new Error("Corrupted data structure");

            await (db as any).transaction('rw', db.pages, async () => {
                await db.pages.bulkPut(data);
            });

            setStatus('success');
            setMessage(`Successfully restored ${data.length} projects.`);
            setTimeout(() => {
                setStatus('idle');
                onClose();
                window.location.reload(); // Refresh to ensure state is clean
            }, 2000);

        } catch (e) {
            setStatus('error');
            setMessage('Import failed: Invalid file or corrupted data.');
        }
    };

    const handleClearClick = () => {
        if (confirmAction === 'clear') {
            executeClear();
        } else {
            setConfirmAction('clear');
            // Reset confirm state after 3 seconds if not clicked
            setTimeout(() => setConfirmAction((prev) => prev === 'clear' ? null : prev), 3000);
        }
    };

    const executeClear = async () => {
        try {
            setConfirmAction(null);
            setStatus('loading');
            setMessage('Clearing workspace...');
            await db.pages.clear();
            // Flag to prevent auto-seeding on reload
            localStorage.setItem('eduforge_has_cleared_data', 'true');
            
            setStatus('success');
            setMessage('Workspace cleared. Reloading...');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (e) {
            console.error(e);
            setStatus('error');
            setMessage('Failed to clear data.');
        }
    };

    const handleRestoreClick = () => {
        if (confirmAction === 'restore') {
            executeRestore();
        } else {
            setConfirmAction('restore');
            setTimeout(() => setConfirmAction((prev) => prev === 'restore' ? null : prev), 3000);
        }
    };

    const executeRestore = async () => {
        try {
            setConfirmAction(null);
            setStatus('loading');
            setMessage('Restoring examples...');
            await db.pages.clear();
            // Remove flag so auto-seeding works (or call explicit seed)
            localStorage.removeItem('eduforge_has_cleared_data');
            await seedDatabase();
            
            setStatus('success');
            setMessage('Examples restored. Reloading...');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (e) {
            console.error(e);
            setStatus('error');
            setMessage('Failed to restore examples.');
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center space-x-2 text-gray-800">
                        <Database className="w-5 h-5 text-indigo-600" />
                        <h2 className="font-bold text-lg">System Settings</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Status Banner */}
                    {status !== 'idle' && (
                        <div className={`p-3 rounded-lg text-sm font-medium flex items-center space-x-2 ${
                            status === 'loading' ? 'bg-indigo-50 text-indigo-700' :
                            status === 'success' ? 'bg-emerald-50 text-emerald-700' :
                            status === 'error' ? 'bg-rose-50 text-rose-700' : ''
                        }`}>
                            {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
                            {status === 'success' && <Check className="w-4 h-4" />}
                            {status === 'error' && <AlertCircle className="w-4 h-4" />}
                            <span>{message || 'Processing...'}</span>
                        </div>
                    )}

                    {/* FSRS Research Lab Link */}
                    <div className="bg-indigo-900 rounded-xl p-4 text-white relative overflow-hidden group cursor-pointer transition-transform hover:scale-[1.02]" onClick={() => setShowResearch(true)}>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                        <div className="relative z-10 flex items-center gap-4">
                            <div className="p-3 bg-white/10 rounded-lg backdrop-blur-sm border border-white/20">
                                <Microscope className="w-6 h-6 text-indigo-300" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm text-white">Investigación de Efectividad</h3>
                                <p className="text-xs text-indigo-200 mt-1">
                                    Analyze FSRS algorithm performance, retention curves, and stability metrics.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-gray-100"></div>

                    {/* Export */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 block">Export Data</label>
                        <p className="text-xs text-gray-500 mb-3">Download a local backup of all your learning projects.</p>
                        <button 
                            onClick={handleExport}
                            className="w-full flex items-center justify-center space-x-2 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700 font-medium py-3 rounded-xl transition-all group"
                        >
                            <Download className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                            <span>Download JSON Backup</span>
                        </button>
                    </div>

                    <div className="h-px bg-gray-100"></div>

                    {/* Import */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 block">Import Data</label>
                        <p className="text-xs text-gray-500 mb-3">Restore projects from a backup file. Existing projects with the same ID will be updated.</p>
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".json"
                            className="hidden" 
                        />
                        <button 
                            onClick={handleImportTrigger}
                            className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-200"
                        >
                            <Upload className="w-4 h-4" />
                            <span>Restore from Backup</span>
                        </button>
                    </div>

                    <div className="h-px bg-gray-100"></div>

                    {/* Danger Zone */}
                    <div className="space-y-3 bg-rose-50 border border-rose-100 rounded-xl p-4">
                        <div className="flex items-center space-x-2 text-rose-700 mb-2">
                            <AlertCircle className="w-4 h-4" />
                            <span className="font-bold text-xs uppercase tracking-wider">Danger Zone</span>
                        </div>
                        
                        <button 
                            onClick={handleClearClick}
                            className={`w-full flex items-center justify-center space-x-2 border font-bold py-2 rounded-lg transition-all text-xs ${
                                confirmAction === 'clear' 
                                ? 'bg-rose-600 text-white border-rose-600 animate-pulse' 
                                : 'bg-white border-rose-200 text-rose-600 hover:bg-rose-100'
                            }`}
                        >
                            {confirmAction === 'clear' ? <AlertTriangle className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                            <span>{confirmAction === 'clear' ? 'Are you sure? Click to Confirm' : 'Clear Workspace (Start Fresh)'}</span>
                        </button>

                        <button 
                            onClick={handleRestoreClick}
                            className={`w-full flex items-center justify-center space-x-2 border font-bold py-2 rounded-lg transition-all text-xs ${
                                confirmAction === 'restore'
                                ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                                : 'bg-white border-rose-200 text-rose-600 hover:bg-rose-100'
                            }`}
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{confirmAction === 'restore' ? 'Confirm Restore?' : 'Reset to Examples'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
