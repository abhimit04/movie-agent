import { useState } from "react";
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
import { useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Home() {
  const [hoveredCard, setHoveredCard] = useState(null);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

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
//    {
//      title: "Stock Market Advisor",
//      description: "Get AI-powered insights for Indian equity markets",
//      icon: TrendingUp,
//      link: "/stockTips",
//      color: "emerald"
//    }
  ];
  const handleSubmit = async () => {
      if (!query.trim()) return;

      setLoading(true);
      setResponse("");

      try {
        const res = await fetch("/api/movieAgents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        const data = await res.json();
        setResponse(data.markdown);

      } catch (err) {
        console.error(err);
        setResponse("Sorry, there was an error processing your request. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter") {
          handleSubmit();
        }
      };

      useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, [response]);


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-60 h-60 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-4000"></div>
        <div className="absolute top-1/2 right-1/4 w-40 h-40 bg-emerald-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-1000"></div>
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      ></div>

      <div className="relative z-10 p-6 max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16 pt-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 rounded-3xl mb-6 shadow-2xl">
            <Sparkles className="w-10 h-10 text-white animate-pulse" />
          </div>

          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-white via-purple-100 to-pink-200 bg-clip-text text-transparent mb-6 leading-tight">
            AI-Powered
            <br />
            <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
              Intelligence Hub
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
            Your ultimate destination for entertainment insights and market intelligence.
            Powered by cutting-edge AI technology.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="group px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-500 rounded-2xl font-semibold text-white shadow-lg hover:shadow-pink-500/25 transition-all duration-300 hover:scale-[1.05] flex items-center justify-center gap-2">
              Get Started
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="px-8 py-4 backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl font-semibold text-white hover:bg-white/20 transition-all duration-300 hover:scale-[1.05]">
              Learn More
            </button>
          </div>
        </div>

        {/* Services Section */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Explore Our Services
            </h2>
            <p className="text-gray-400 text-lg">
              Choose from our AI-powered platforms
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {services.map((service, index) => {
              const IconComponent = service.icon;
              return (
                <div
                  key={index}
                  className="group backdrop-blur-xl bg-white/5 hover:bg-white/10 rounded-3xl border border-white/10 hover:border-white/20 p-8 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl cursor-pointer"
                  onMouseEnter={() => setHoveredCard(index)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className={`p-4 bg-gradient-to-r ${
                      service.color === 'pink'
                        ? 'from-pink-500 to-purple-500'
                        : 'from-emerald-500 to-blue-500'
                    } rounded-2xl shadow-lg group-hover:shadow-${service.color}-500/25 transition-all duration-300`}>
                      <IconComponent className="w-8 h-8 text-white" />
                    </div>
                    <ArrowRight className={`w-6 h-6 text-gray-400 group-hover:text-white transition-all duration-300 ${
                      hoveredCard === index ? 'translate-x-1' : ''
                    }`} />
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-purple-200 transition-colors">
                    {service.title}
                  </h3>

                  <p className="text-gray-400 text-lg leading-relaxed mb-6">
                    {service.description}
                  </p>

                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r ${
                    service.color === 'pink'
                      ? 'from-pink-500/20 to-purple-500/20 border-pink-500/30'
                      : 'from-emerald-500/20 to-blue-500/20 border-emerald-500/30'
                  } border text-white font-medium`}>
                    <Play className="w-4 h-4" />
                    Launch App
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Features Section */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Powerful Features
            </h2>
            <p className="text-gray-400 text-lg">
              Everything you need in one intelligent platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <div
                  key={index}
                  className="backdrop-blur-xl bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 hover:border-white/20 p-6 transition-all duration-300 hover:scale-[1.05] hover:shadow-xl text-center"
                >
                  <div className={`inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r ${feature.gradient} rounded-xl mb-4 shadow-lg`}>
                    <IconComponent className="w-6 h-6 text-white" />
                  </div>

                  <h3 className="text-lg font-bold text-white mb-3">
                    {feature.title}
                  </h3>

                  <p className="text-gray-400 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats Section */}
        <div className="backdrop-blur-xl bg-white/5 rounded-3xl border border-white/10 p-8 mb-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent mb-2">
                15K+
              </div>
              <div className="text-gray-400">Movies & Shows Tracked</div>
              <div className="text-xs text-gray-500 mt-1">via TMDB API</div>
            </div>
            <div>
              <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-2">
                50+
              </div>
              <div className="text-gray-400">OTT Platforms Covered</div>
              <div className="text-xs text-gray-500 mt-1">Netflix, Prime & more</div>
            </div>
            <div>
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent mb-2">
                AI
              </div>
              <div className="text-gray-400">Powered Reviews</div>
              <div className="text-xs text-gray-500 mt-1">Perplexity & Tavily</div>
            </div>
            <div>
              <div className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent mb-2">
                24/7
              </div>
              <div className="text-gray-400">Real-time Updates</div>
              <div className="text-xs text-gray-500 mt-1">Latest releases</div>
            </div>
          </div>
        </div>

        {/* Bottom Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Globe, title: "Multi-Platform Coverage", desc: "Netflix, Prime, Disney+ & 50+ OTT platforms" },
            { icon: Zap, title: "Real-time Updates", desc: "Weekly movie releases & instant search" },
            { icon: Shield, title: "Trusted Data Sources", desc: "TMDB ratings, Perplexity & Tavily APIs" }
          ].map(({ icon: Icon, title, desc }, index) => (
            <div
              key={index}
              className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 p-6 text-center hover:bg-white/10 transition-all duration-300 hover:scale-[1.02]"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl mb-4">
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-white font-bold mb-2">{title}</h3>
              <p className="text-gray-400 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .animation-delay-1000 { animation-delay: 1s; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>
    </div>
  );
}