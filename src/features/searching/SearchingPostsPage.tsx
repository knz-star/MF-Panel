import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, ExternalLink, Link2, Copy, Check } from 'lucide-react';
import { listAllPosts } from '../../services/postService';
import { PostRecord } from '../../types/post';

export const SearchingPostsPage: React.FC = () => {
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await listAllPosts(300);
      setPosts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = posts.filter((p) => {
    const q = search.toLowerCase();
    return (
      !search ||
      p.postId.toLowerCase().includes(q) ||
      p.profileId.toLowerCase().includes(q) ||
      p.canonicalUrl.toLowerCase().includes(q) ||
      (p.region && p.region.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
            Child Records Registry
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Registered Post Links
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Individual posts attached to canonical profiles (up to 3 per verified profile).
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Posts</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Post ID, Profile ID, Region, or URL..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading posts...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No registered posts found. Post links are created during the Checking Team verification step.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Post ID</th>
                  <th className="py-3 px-4">Parent Profile ID</th>
                  <th className="py-3 px-4">Platform</th>
                  <th className="py-3 px-4">Region</th>
                  <th className="py-3 px-4">Canonical URL</th>
                  <th className="py-3 px-4 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map((post) => (
                  <tr key={post.postId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-950">
                      <div className="flex items-center gap-1.5">
                        <span>{post.postId}</span>
                        <button
                          onClick={() => handleCopy(post.postId)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          {copiedId === post.postId ? (
                            <Check className="w-3 h-3 text-blue-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {post.profileId}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-medium text-slate-800">
                        {post.platform}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      {post.region || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 max-w-xs truncate">
                      <a
                        href={post.canonicalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-blue-700 hover:underline flex items-center gap-1"
                      >
                        <span className="truncate">{post.canonicalUrl}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-40" />
                      </a>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-400 tabular-nums">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
