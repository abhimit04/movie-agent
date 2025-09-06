import { useState, useEffect } from "react";
import { 
  Film, 
  Tv, 
  Search, 
  Star, 
  Calendar, 
  Play, 
  TrendingUp, 
  Sparkles,
  Clock,
  ExternalLink,
  ChevronRight
} from "lucide-react";

export default function EntertainmentHub() {
  const [activeTab, setActiveTab] = useState("movies");
  const [searchQuery, setSearchQuery] = useState("");
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState(false);

  const fetchReleases = async (type, query = "") => {
    setLoading(true);
    try {
      const url = query 
        ? `/api/movieAgent?query=${encodeURIComponent(query)}&type=${type}`
        : `/api/movieAgent?type=${type}`;
      
      const response = await fetch(url);
      const data = await response.json();
      setReleases(data);
    } catch (error) {
      console.error("Error fetching releases:", error);
      setReleases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setSearchMode(true);
      fetchReleases(activeTab === "movies" ? "movie" : "tv", searchQuery);
    }
  };

  const handleQuickLoad = (type) => {
    setActiveTab(type);
    setSearchMode(false);
    setSearchQuery("");
    fetchReleases(type === "movies" ? "movie" : "tv");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const getRatingColor = (rating) => {
    if (rating >= 8) return "text-green-400";
    if (rating >= 6) return "text-yellow-400";
    return "text-red-400";
  };

  const getRatingBg = (rating) => {
    if (rating >= 8) return "bg-green-500/20 border-green-500/30";
    if (rating >= 6) return "bg-yellow-500/20 border-yellow-500/30";
    return "bg-red-500/20 border-red-500/30";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-60 h-60 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-4000"></div>
      </div>

      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      ></div>

      <div className="relative z-10 p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-pink-500 to-violet-500 rounded-2xl mb-4 shadow-lg">
            <Film className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white via-pink-100 to-violet-200 bg-clip-text text-transparent mb-2">
            Entertainment Hub
          </h1>
          <p className="text-gray-400 text-lg">Discover the latest movies, OTT shows & TV series</p>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => handleQuickLoad("movies")}
            className="group backdrop-blur-xl bg-white/5 hover:bg-white/10 rounded-3xl border border-white/10 hover:border-white/20 p-6 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-pink-500/10"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-gradient-to-r from-pink-500 to-red-500 rounded-xl">
                    <Film className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Movies This Week</h3>
                </div>
                <p className="text-gray-400">Latest theatrical releases and reviews</p>
              </div>
              <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" />
            </div>
          </button>

          <button
            onClick={() => handleQuickLoad("tv")}
            className="group backdrop-blur-xl bg-white/5 hover:bg-white/10 rounded-3xl border border-white/10 hover:border-white/20 p-6 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-violet-500/10"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl">
                    <Tv className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white">OTT Releases</h3>
                </div>
                <p className="text-gray-400">New shows on Netflix, Prime, Disney+ & more</p>
              </div>
              <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" />
            </div>
          </div>
        </div>

        {/* Search Section */}
        <div className="backdrop-blur-xl bg-white/5 rounded-3xl border border-white/10 shadow-2xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Search className="w-5 h-5 text-gray-400" />
            <h2 className="text-xl font-bold text-white">Search Entertainment</h2>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Search for movies, TV shows, web series..."
                className="w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all duration-300"
              />
            </div>
            
            <div className="flex gap-2">
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value)}
                className="px-4 py-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="movies" className="bg-slate-800">Movies</option>
                <option value="tv" className="bg-slate-800">TV Shows/OTT</option>
              </select>
              
              <button
                onClick={handleSearch}
                disabled={loading || !searchQuery.trim()}
                className={`px-6 py-4 rounded-2xl font-semibold text-white transition-all duration-300 ${
                  loading || !searchQuery.trim()
                    ? "bg-gray-600/50 cursor-not-allowed"
                    : "bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 hover:scale-[1.02] shadow-lg"
                }`}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Searching...
                  </div>
                ) : (
                  "Search"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {releases.length > 0 && (
          <div className="backdrop-blur-xl bg-white/5 rounded-3xl border border-white/10 shadow-2xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl font-bold text-white">
                {searchMode ? `Search Results for "${searchQuery}"` : 
                 activeTab === "movies" ? "Latest Movies This Week" : "New OTT Releases This Week"}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {releases.map((item, index) => (
                <div
                  key={index}
                  className="group backdrop-blur-sm bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 hover:border-white/20 p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-bold text-white group-hover:text-purple-200 transition-colors line-clamp-2">
                      {item.title}
                    </h3>
                    {item.tmdb_rating && (
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${getRatingBg(item.tmdb_rating)}`}>
                        <Star className={`w-3 h-3 ${getRatingColor(item.tmdb_rating)}`} />
                        <span className={`text-sm font-semibold ${getRatingColor(item.tmdb_rating)}`}>
                          {item.tmdb_rating.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>

                  {item.description && (
                    <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                      {item.description}
                    </p>
                  )}

                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-purple-300 mb-2 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Reviews Summary
                    </h4>
                    <p className="text-gray-300 text-sm line-clamp-3">
                      {item.reviews_summary}
                    </p>
                  </div>

                  {item.sources && item.sources.length > 0 && (
                    <div className="border-t border-white/10 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Sources Available</span>
                        <div className="flex gap-1">
                          {item.sources.slice(0, 3).map((source, idx) => (
                            <a
                              key={idx}
                              href={source}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 bg-white/10 hover:bg-white/20 rounded-md transition-colors"
                            >
                              <ExternalLink className="w-3 h-3 text-gray-400" />
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Features showcase */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
          {[
            { icon: Calendar, title: "Weekly Updates", desc: "Fresh releases every week" },
            { icon: Star, title: "TMDB Ratings", desc: "Authentic user ratings" },
            { icon: Play, title: "OTT Tracking", desc: "All platforms covered" },
            { icon: Clock, title: "Real-time Info", desc: "Latest reviews & news" }
          ].map(({ icon: Icon, title, desc }, index) => (
            <div
              key={index}
              className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 p-4 text-center hover:bg-white/10 transition-all duration-300 hover:scale-[1.02]"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-r from-pink-500 to-violet-500 rounded-xl mb-3">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-white font-semibold mb-1">{title}</h3>
              <p className="text-gray-400 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}