import { useState, useRef, useEffect } from "react";
import {
  Film,
  Tv,
  TrendingUp,
  Sparkles,
  Star,
  Search,
  Calendar,
  Play,
  Clock,
  MessageSquare,
  Home as HomeIcon
} from "lucide-react";

export default function Home() {
  const [hoveredCard, setHoveredCard] = useState(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("movie");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState([]);
  const [error, setError] = useState("");
  const [weeklyReleases, setWeeklyReleases] = useState([]);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("movies");
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

  const suggestedQuestions = [
    {
      icon: Star,
      question: "What's the IMDB rating of Stree 2?",
      type: "movie"
    },
    {
      icon: MessageSquare,
      question: "Reviews for Mirzapur Season 3",
      type: "tv"
    },
    {
      icon: Play,
      question: "What new shows are on Netflix this month?",
      type: "tv"
    },
    {
      icon: Film,
      question: "Box office collection of Khel Khel Mein",
      type: "movie"
    },
    {
      icon: TrendingUp,
      question: "Best rated web series on Amazon Prime",
      type: "tv"
    },
    {
      icon: Calendar,
      question: "Upcoming Bollywood releases this month",
      type: "movie"
    }
  ];

  // Fetch weekly releases on component mount
  useEffect(() => {
    fetchWeeklyReleases();
  }, []);

  const fetchWeeklyReleases = async () => {
    setWeeklyLoading(true);
    try {
      const res = await fetch('/api/movieAgents?weekly=true', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        setWeeklyReleases(data.releases || []);
      }
    } catch (err) {
      console.error("Error fetching weekly releases:", err);
    } finally {
      setWeeklyLoading(false);
    }
  };

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

  const handleSuggestedQuestion = (question, questionType) => {
    setQuery(question);
    setType(questionType);
    // Auto-submit after a brief delay to show the update
    setTimeout(() => {
      handleSubmit();
    }, 100);
  };

  const handleBackToHome = () => {
    setQuery("");
    setResponse([]);
    setError("");
    setType("movie");
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

  const renderReviewContent = (reviewText) => {
    if (!reviewText || reviewText === "No reviews available") {
      return <p className="text-gray-400">No reviews available</p>;
    }

    // Convert markdown-like formatting to HTML
    const formatReview = (text) => {
      return text
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em class="text-yellow-400">$1</em>')
        .replace(/###\s*(.*?)$/gm, '<h3 class="text-lg font-semibold text-purple-300 mb-2">$1</h3>')
        .replace(/##\s*(.*?)$/gm, '<h2 class="text-xl font-bold text-purple-300 mb-3">$1</h2>')
        .replace(/\n\n/g, '</p><p class="mb-3">')
        .replace(/\n/g, '<br/>');
    };

    return (
      <div
        className="prose prose-invert max-w-none text-gray-300"
        dangerouslySetInnerHTML={{
          __html: `<p class="mb-3">${formatReview(reviewText)}</p>`
        }}
      />
    );
  };

  const filteredReleases = weeklyReleases.filter(item =>
    activeTab === "movies" ? item.type === "movie" : item.type === "tv"
  );

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
      <div className="relative z-10 max-w-4xl mx-auto mb-12 p-6">
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
              {/* Back to Home Button */}
              <div className="flex justify-center pb-4">
                <button
                  onClick={handleBackToHome}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-xl text-white font-semibold transition-all hover:scale-105 shadow-lg"
                >
                  <HomeIcon className="w-5 h-5" />
                  Back to Home
                </button>
              </div>

              {response.map((item, idx) => (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 shadow-lg hover:bg-white/10 transition-all duration-300"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-xl font-bold text-white flex-1 pr-4">
                      {item.title}
                    </h3>
                    {item.rating && (
                      <div className="flex items-center gap-1 bg-yellow-500/20 px-3 py-1 rounded-full">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-yellow-400 font-semibold">
                          {typeof item.rating === 'number' ? item.rating.toFixed(1) : item.rating}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Movie/Show Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
                    {item.release_date && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <Calendar className="w-4 h-4" />
                        <span>{item.release_date}</span>
                      </div>
                    )}
                    {item.platform && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <Play className="w-4 h-4" />
                        <span>{item.platform}</span>
                      </div>
                    )}
                    {item.genre && (
                      <div className="text-gray-400">
                        <span className="font-medium">Genre:</span> {item.genre}
                      </div>
                    )}
                    {item.director && (
                      <div className="text-gray-400">
                        <span className="font-medium">Director:</span> {item.director}
                      </div>
                    )}
                  </div>

                  {item.description && (
                    <p className="text-gray-300 mb-4 leading-relaxed">
                      {item.description}
                    </p>
                  )}

                  {item.cast && (
                    <div className="mb-4">
                      <span className="text-white font-medium">Cast: </span>
                      <span className="text-gray-300">{item.cast}</span>
                    </div>
                  )}

                  {item.reviews_summary && item.reviews_summary !== "No reviews available" && (
                    <div className="text-gray-400 leading-relaxed bg-white/5 p-4 rounded-lg border border-white/10">
                      <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Reviews Summary:
                      </h4>
                      {renderReviewContent(item.reviews_summary)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div ref={messagesEndRef}></div>
        </div>
      </div>

      {/* This Week's Releases Section */}
      {!response.length && !loading && (
        <section className="relative z-10 max-w-6xl mx-auto px-6 mb-16">
          <div className="backdrop-blur-xl bg-white/10 rounded-3xl border border-white/20 shadow-2xl p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                <Calendar className="w-8 h-8 text-purple-400" />
                This Week's Releases
              </h2>
              <div className="flex rounded-xl bg-white/10 border border-white/20 overflow-hidden">
                <button
                  onClick={() => setActiveTab("movies")}
                  className={`px-6 py-2 font-medium transition-all ${
                    activeTab === "movies"
                      ? "bg-purple-500 text-white"
                      : "text-gray-300 hover:text-white"
                  }`}
//                >
//                  Movies
//                </button>
//                <button
//                  onClick={() => setActiveTab("shows")}
//                  className={`px-6 py-2 font-medium transition-all ${
//                    activeTab === "shows"
//                      ? "bg-purple-500 text-white"
//                      : "text-gray-300 hover:text-white"
//                  }`}
//                >
//                  OTT Shows
//                </button>
              </div>
            </div>

            {weeklyLoading ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center gap-3 text-gray-300">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400"></div>
                  <span>Loading this week's releases...</span>
                </div>
              </div>
            ) : filteredReleases.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredReleases.map((release, idx) => (
                  <div
                    key={idx}
                    className="p-6 rounded-2xl bg-white/5 border border-white/10 shadow-lg hover:bg-white/10 transition-all duration-300 cursor-pointer"
                    onClick={() => handleSuggestedQuestion(release.title, release.type)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-bold text-white pr-2 flex-1">
                        {release.title}
                      </h3>
                      {release.type === "movie" ? (
                        <Film className="w-5 h-5 text-pink-400 flex-shrink-0" />
                      ) : (
                        <Tv className="w-5 h-5 text-purple-400 flex-shrink-0" />
                      )}
                    </div>

                    <div className="space-y-2 text-sm text-gray-400">
                      {release.platform && (
                        <div className="flex items-center gap-2">
                          <Play className="w-3 h-3" />
                          <span>{release.platform}</span>
                        </div>
                      )}
                      {release.release_date && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          <span>{release.release_date}</span>
                        </div>
                      )}
                      {release.genre && (
                        <div className="text-gray-300 text-xs bg-white/5 px-2 py-1 rounded-full inline-block">
                          {release.genre}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No releases found for this week.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Suggested Questions Section */}
      {!response.length && !loading && (
        <section className="relative z-10 max-w-6xl mx-auto px-6 mb-16">
          <h2 className="text-3xl font-bold text-center text-white mb-8">
            Try These Popular Searches
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suggestedQuestions.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestedQuestion(item.question, item.type)}
                className="p-4 rounded-xl bg-white/5 border border-white/10 shadow-lg hover:bg-white/10 transition-all duration-300 text-left group hover:scale-105"
              >
                <div className="flex items-center gap-3 mb-2">
                  <item.icon className="w-5 h-5 text-purple-400 group-hover:text-purple-300" />
                  <span className="text-xs font-medium text-purple-300 uppercase">
                    {item.type}
                  </span>
                </div>
                <p className="text-white group-hover:text-gray-100 transition-colors">
                  {item.question}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

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