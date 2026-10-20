import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Home, Search } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const location = useLocation();
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-blue-700">MF MPanel · Route diagnostic</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">This button opened a route that is not registered in the current website build. The app will not silently redirect you to the landing page.</p>
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-900">Missing route</p>
          <code className="mt-1 block break-all text-sm text-amber-950">{location.pathname}{location.search}</code>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/dashboard" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"><Home className="h-4 w-4"/> Open Dashboard</Link>
          <button type="button" onClick={() => window.history.back()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"><ArrowLeft className="h-4 w-4"/> Go back</button>
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"><Search className="h-4 w-4"/> Landing page</Link>
        </div>
      </section>
    </main>
  );
};
