import { useState } from "react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const fetchMovie = async () => {
    if (!query) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`/api/movieAgent?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to fetch movie info.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold mb-6">🎬 Movie & OTT AI Agent</h1>

      {/* Search Box */}
      <div className="flex w-full max-w-lg">
        <input
          type="text"
          value={query}
          placeholder="Search movie or show..."
          onChange={(e) => setQuery(e.target.value)}
          className="flex-grow p-3 rounded-l-lg text-black focus:outline-none"
        />
        <button
          onClick={fetchMovie}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 px-5 py-3 rounded-r-lg text-white font-semibold"
        >
          {loading ? "Loading..." : "Search"}
        </button>
      </div>

      {/* Error */}
      {error && <p className="mt-4 text-red-400">{error}</p>}

      {/* Results */}
      {result && (
        <div className="mt-8 max-w-2xl w-full bg-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/10">
          <h2 className="text-2xl font-semibold mb-2">{result.title}</h2>
          <p className="text-gray-300 mb-2">
            📅 Release: {result.release_date || "N/A"} | ⭐ Rating:{" "}
            {result.tmdb_rating || "N/A"}
          </p>
          <p className="mb-4">{result.overview}</p>

          <h3 className="text-xl font-semibold mt-4">📝 Review Summary</h3>
          <p className="whitespace-pre-line mt-2">{result.reviews_summary}</p>

          {result.sources?.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold">🔗 Sources</h4>
              <ul className="list-disc list-inside text-blue-300">
                {result.sources.map((src, i) => (
                  <li key={i}>
                    <a href={src} target="_blank" rel="noopener noreferrer">
                      {src}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
