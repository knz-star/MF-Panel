import React from 'react';
import { Link } from 'react-router-dom';
import { GlobalTrackerView } from '../admin/GlobalTrackerView';
export const PublicGlobalTrackerPage: React.FC = () => <div className="min-h-screen bg-[#F6F1E8] px-3 py-5 text-[#1F2421] sm:px-6 sm:py-8"><div className="mx-auto mb-4 flex max-w-6xl items-center justify-between"><Link to="/" className="font-display text-lg font-bold">MF MPanel</Link><Link to="/login" className="rounded-xl bg-[#C8853F] px-4 py-2 text-sm font-bold text-white">Sign in</Link></div><GlobalTrackerView publicMode /></div>;
export default PublicGlobalTrackerPage;
