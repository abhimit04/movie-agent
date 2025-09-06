import { useState, useRef, useEffect } from "react";
import {
  Film,
  Tv,
  TrendingUp,
  Sparkles,
  Star,
  Search
} from "lucide-react";

export default function Home() {
  const [hoveredCard, setHoveredCard] = useState(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("movie");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState([]);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);

  const features = [
    {
      icon: Film,
      title: "Movie Reviews & Ratings",
      description:
        "Get comprehensive reviews and TMDB ratings for the latest theatrical releases",
      gradient: "from-pink-500 to-red-500"
    },
    {
      icon: Tv,
      title: "OTT Platform Tracking",
      description:
        "Track new releases across Netflix, Prime Video, Disney+, and more",
      gradient: "from-purple-500 to-violet-500"
    },
    {
      icon: TrendingUp,
      title: "Trending Entertainment",
      description:
        "Stay updated with what's trending in movies and web series",
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      icon: Sparkles,
      title: "AI-Powered Insights",
      description:
        "Get intelligent recommendations and detailed entertainment analysis",
      gradient: "from-emerald-500 to-green-500"
    }
  ];

  // Fixed submit handler with proper error handling
  const handleSubmit = async () => {
    if (!query.trim()) {
      setError("Please enter a search query");
      return;
    }

    setLoading(true);
    setResponse([]);
    setError("");

    try {
      const res = await fetch(
        `/api/movieAgents?query=${encodeURIComponent(query)}&type=${type}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setResponse(data.movies || []);

      if (!data.movies || data.movies.length === 0) {
        setError("No results found. Try a different search term.");
      }
    } catch (err) {
      console.error("Error fetching movies:", err);
      setError(`Failed to fetch results: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !loading) {
      handleSubmit();
    }
  };

  // Scroll to bottom when response updates
  useEffect(() => {
    if (response.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [response]);

  // Clear error when user starts typing
  useEffect(() => {
    if (query.trim() && error) {
      setError("");
    }
  }, [query]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-1000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 text-center pt-20 pb-10">
        <div className="max-w-4xl mx-auto px-6">
          <h1 className="text-6xl font-bold text-white mb-6 bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
            Entertainment Hub
          </h1>
          <p className="text-xl text-gray-300 mb-8 leading-relaxed">
            Discover the latest movies and OTT shows with AI-powered insights, ratings, and reviews
          </p>
        </div>
      </header>

      {/* Search Section */}
      <div className="relative z-10 max-w-4xl mx-auto mb-20 p-6">
        <div className="backdrop-blur-xl bg-white/10 rounded-3xl border border-white/20 shadow-2xl p-8">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/10 text-white placeholder-gray-400 border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                placeholder="Search for a movie or OTT show..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
            </div>
//            <select
//              value={type}
//              onChange={(e) => setType(e.target.value)}
//              className="px-4 py-4 rounded-xl bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 min-w-[120px]"
//              disabled={loading}
//            >
//              <option value="movie">Movie</option>
//              <option value="tv">OTT Show</option>
//            </select>
            <button
              onClick={handleSubmit}
              disabled={loading || !query.trim()}
              className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-500 rounded-xl font-semibold text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300">
              {error}
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <div className="inline-flex items-center gap-3 text-gray-300">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400"></div>
                <span>Searching for the latest entertainment...</span>
              </div>
            </div>
          )}

          {/* Results */}
          {!loading && response.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white mb-4">
                Search Results ({response.length} found)
              </h2>
              {response.map((item, idx) => (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 shadow-lg hover:bg-white/10 transition-all duration-300"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-xl font-bold text-white flex-1 pr-4">
                      {item.title}
                    </h3>
                    {item.tmdb_rating && (
                      <div className="flex items-center gap-1 bg-yellow-500/20 px-3 py-1 rounded-full">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-yellow-400 font-semibold">
                          {item.tmdb_rating.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>

                  {item.description && (
                    <p className="text-gray-300 mb-3 leading-relaxed">
                      {item.description}
                    </p>
                  )}

                  {item.reviews_summary && item.reviews_summary !== "No reviews available" && (
                    <div className="text-gray-400 leading-relaxed bg-white/5 p-4 rounded-lg border border-white/10">
                      <h4 className="text-white font-semibold mb-2">Reviews Summary:</h4>
                      <div className="prose prose-invert max-w-none">
                        {item.reviews_summary}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div ref={messagesEndRef}></div>
        </div>
      </div>

      {/* Features Section */}
      {!response.length && !loading && (
        <section className="relative z-10 max-w-6xl mx-auto px-6 mb-20">
          <h2 className="text-4xl font-bold text-center text-white mb-16">
            Discover Entertainment Like Never Before
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group relative"
                onMouseEnter={() => setHoveredCard(index)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="h-full p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl transition-all duration-300 hover:bg-white/10 hover:scale-105">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${feature.gradient} flex items-center justify-center mb-6 transition-transform duration-300 ${hoveredCard === index ? 'rotate-12' : ''}`}>
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}