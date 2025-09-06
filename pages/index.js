import { useState, useRef, useEffect } from "react";
import {
  Film,
  Tv,
  TrendingUp,
  Sparkles,
  Play,
  Star,
  ArrowRight,
  Globe,
  Zap,
  Shield
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Home() {
  const [hoveredCard, setHoveredCard] = useState(null);


  const features = [
    {
      icon: Film,
      title: "Movie Reviews & Ratings",
      description: "Get comprehensive reviews and TMDB ratings for the latest theatrical releases",
      gradient: "from-pink-500 to-red-500"
    },
    {
      icon: Tv,
      title: "OTT Platform Tracking",
      description: "Track new releases across Netflix, Prime Video, Disney+, and more",
      gradient: "from-purple-500 to-violet-500"
    },
    {
      icon: TrendingUp,
      title: "Trending Entertainment",
      description: "Stay updated with what's trending in movies and web series",
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      icon: Sparkles,
      title: "AI-Powered Insights",
      description: "Get intelligent recommendations and detailed entertainment analysis",
      gradient: "from-emerald-500 to-green-500"
    }
  ];

  const services = [
    {
      title: "Entertainment Hub",
      description: "Discover movies, OTT shows, and get detailed reviews",
      icon: Film,
      link: "/movieAgents",
      color: "pink"
    }
  ];



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* ... your existing hero, services, features, stats sections (unchanged) ... */}

      {/* Search Section */}
      <div className="relative z-10 max-w-3xl mx-auto mt-12 mb-20 p-6 backdrop-blur-xl bg-white/5 rounded-3xl border border-white/10 shadow-xl">
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            className="flex-1 p-3 rounded-xl bg-white/10 text-white placeholder-gray-400 border border-white/20 focus:outline-none"
            placeholder="Search for a movie or OTT show..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="p-3 rounded-xl bg-white/10 text-white border border-white/20"
          >
            <option value="movie">Movie</option>
            <option value="tv">OTT Show</option>
          </select>
          <button
            onClick={handleSubmit}
            className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 rounded-xl font-semibold text-white shadow hover:scale-[1.05] transition"
          >
            Search
          </button>
        </div>

        {/* Results */}
        {loading && <p className="text-gray-300">Loading...</p>}
        {!loading && response.length > 0 && (
          <div className="space-y-6 mt-6">
            {response.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-white/5 border border-white/10 shadow"
              >
                <h3 className="text-xl font-bold text-white">{item.title}</h3>
                {item.tmdb_rating && (
                  <p className="text-yellow-400 flex items-center gap-1">
                    <Star className="w-4 h-4" /> {item.tmdb_rating.toFixed(1)}
                  </p>
                )}
                <p className="text-gray-300 mt-2">{item.description}</p>
                <ReactMarkdown
                  className="text-gray-400 mt-2 prose prose-invert"
                  remarkPlugins={[remarkGfm]}
                >
                  {item.reviews_summary || ""}
                </ReactMarkdown>
              </div>
            ))}
          </div>
        )}
        <div ref={messagesEndRef}></div>
      </div>
    </div>
  );
}
