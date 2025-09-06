import { useState } from "react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchMovies = async () => {
    setLoading(true);
    setMovies([]);

    try {
      const res = await fetch(`/api/movieAgents${query ? `?query=${encodeURIComponent(query)}` : ""}`);
      const data = await res.json();
      setMovies(Array.isArray(data) ? data : [data]);
    } catch (err) {
      console.error("Error fetching movies:", err);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-8">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">🎬 Movie & OTT Release Tracker</h1>
        <p className="text-gray-300 mb-6">Search movies or discover trending releases this week</p>

        {/* Search Bar */}
        <div className="flex justify-center gap-2 mb-8">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter movie/show name..."
            className="w-full md:w-2/3 p-3 rounded-xl text-black"
          />
          <button
            onClick={fetchMovies}
            className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-semibold"
          >
            {query ? "Search" : "Show Trending"}
          </button>
        </div>

        {loading && <p className="text-gray-400">Loading...</p>}

        {/* Movie Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {movies.map((movie, idx) => (
            <div
              key={idx}
              className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 shadow-xl p-6 text-left"
            >
              <h2 className="text-2xl font-bold mb-2">{movie.title}</h2>
              <p className="text-gray-400 text-sm mb-2">Release: {movie.release_date || "N/A"}</p>
              <p className="text-yellow-400 font-semibold mb-3">⭐ {movie.tmdb_rating?.toFixed(1) || "N/A"}</p>
              <p className="text-gray-300 mb-4">{movie.overview}</p>
              <h3 className="font-semibold mb-2">📝 Reviews:</h3>
              <p className="text-gray-200 text-sm whitespace-pre-line">{movie.reviews_summary}</p>

              {movie.sources?.length > 0 && (
                <div className="mt-3">
                  <p className="text-gray-400 text-sm">Sources:</p>
                  <ul className="list-disc list-inside text-blue-400 text-sm">
                    {movie.sources.map((src, i) => (
                      <li key={i}>
                        <a href={src} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {src}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
