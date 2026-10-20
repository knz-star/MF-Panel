import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  Shield,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Save,
  Server,
  Layers,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { checkSupabaseConnection, type BackendConnectionStatus, supabaseConfig } from '../../lib/backend';
import { getSystemSettings, updateSystemSettings } from '../../services/settingsService';
import { SystemSettings } from '../../types/workflow';

export const SettingsPage: React.FC = () => {
  const { isAdmin, currentUser } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<BackendConnectionStatus | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [settings, setSettings] = useState<SystemSettings>({
    checkingQueueCapacity: 500,
    retentionHours: 72,
    maxZipSizeBytes: 100 * 1024 * 1024,
    maxLinksPerFolderLimit: 500,
  });
  const [queueCapacityInput, setQueueCapacityInput] = useState(500);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const init = async () => {
      const conn = await checkSupabaseConnection();
      setConnectionStatus(conn);
      const s = await getSystemSettings();
      setSettings(s);
      setQueueCapacityInput(s.checkingQueueCapacity || 500);
    };
    init();
  }, []);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const conn = await checkSupabaseConnection();
      setConnectionStatus(conn);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const updated = await updateSystemSettings(
        {
          checkingQueueCapacity: Number(queueCapacityInput) || 500,
        },
        currentUser?.uid || 'ADMIN'
      );
      setSettings(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="pb-6 border-b border-slate-200">
        <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
          System Administration
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          Settings & System Configuration
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Backend connectivity status, queue capacity quotas, and file retention guidelines.
        </p>
      </div>

      {/* Supabase Backend Diagnostics */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Supabase Project Connectivity
            </h2>
          </div>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testingConnection}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
            <span>Test Connection</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[10px] uppercase">Project ID</span>
            <span className="font-semibold text-slate-900">{supabaseConfig.projectId}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[10px] uppercase">Supabase Host</span>
            <span className="font-semibold text-slate-900">{supabaseConfig.authDomain}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[10px] uppercase">Storage Bucket</span>
            <span className="font-semibold text-slate-900">{supabaseConfig.storageBucket}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[10px] uppercase">Live Backend Status</span>
            <span
              className={`font-semibold ${
                connectionStatus?.state === 'CONNECTED'
                  ? 'text-blue-700'
                  : connectionStatus?.state === 'OFFLINE'
                  ? 'text-amber-700'
                  : 'text-slate-600'
              }`}
            >
              {connectionStatus?.state === 'CONNECTED'
                ? 'Online & Connected'
                : connectionStatus?.state === 'OFFLINE'
                ? 'Offline / Synchronizing'
                : 'Probing...'}
            </span>
          </div>
        </div>
      </div>

      {/* Queue Capacity Configuration Form */}
      <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600" />
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Checking Queue Capacity Configuration
          </h2>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          The default active Checking queue capacity is <strong>500</strong> records. When the queue reaches this limit, Searching Team is prevented from enqueuing additional profiles until existing records are checked.
        </p>

        <div className="max-w-xs">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Active Queue Max Limit (Slots)
          </label>
          <input
            type="number"
            min={10}
            max={5000}
            disabled={!isAdmin}
            value={queueCapacityInput}
            onChange={(e) => setQueueCapacityInput(parseInt(e.target.value) || 500)}
            className="w-full p-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-500 bg-white"
          />
          {!isAdmin && (
            <span className="text-[11px] text-slate-400 mt-1 block">
              Only authorized administrators can modify the capacity limit.
            </span>
          )}
        </div>

        {saveSuccess && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span>Capacity quota updated successfully!</span>
          </div>
        )}

        {isAdmin && (
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Updating Quota...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Queue Configuration</span>
              </>
            )}
          </button>
        )}
      </form>

      {/* File Storage & Retention Notice */}
      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
        <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
          Temporary Storage & 72-Hour Retention Governance
        </h3>
        <p className="leading-relaxed">
          Uploaded ZIP archives and generated report bundles are processed in temporary storage and bound by a <strong>72-hour retention cycle</strong>. After 72 hours, temporary download packages expire to preserve storage budgets and adhere to data isolation compliance.
        </p>
      </div>
    </div>
  );
};
