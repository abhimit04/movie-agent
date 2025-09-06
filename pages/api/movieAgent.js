// /pages/api/movieAgent.js
export default async function handler(req, res) {
  const { query } = req.query;

  const TMDB_API_KEY = process.env.TMDB_API_KEY;
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

  if (!TMDB_API_KEY) {
    return res.status(500).json({ error: "Missing TMDB API Key" });
  }

  try {
    let movies = [];

    if (query) {
      // 🔍 Search specific movie
      const searchRes = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`
      );
      const searchData = await searchRes.json();

      if (!searchData.results?.length) {
        return res.status(404).json({ error: "Movie not found" });
      }

      const movie = searchData.results[0];
      movies.push(movie);
    } else {
      // 🆕 Fetch trending movies of this week
      const trendingRes = await fetch(
        `https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_API_KEY}`
      );
      const trendingData = await trendingRes.json();

      movies = trendingData.results.slice(0, 5); // top 5 trending
    }

    // Process each movie: fetch details + AI summary
    const enrichedMovies = await Promise.all(
      movies.map(async (movie) => {
        const detailsRes = await fetch(
          `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}`
        );
        const details = await detailsRes.json();

        // 🔗 Get reviews using Tavily + Perplexity
        let reviews_summary = "No reviews available";
        let sources = [];

        if (TAVILY_API_KEY && PERPLEXITY_API_KEY) {
          try {
            // 1. Tavily search for reviews
            const tavilyRes = await fetch("https://api.tavily.com/search", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${TAVILY_API_KEY}`,
              },
              body: JSON.stringify({
                query: `${movie.title} movie reviews site:indianexpress.com OR site:ndtv.com OR site:timesofindia.indiatimes.com`,
                max_results: 3,
              }),
            });

            const tavilyData = await tavilyRes.json();
            sources = tavilyData.results?.map((r) => r.url) || [];

            // 2. Summarize with Perplexity
            const perplexityRes = await fetch("https://api.perplexity.ai/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
              },
              body: JSON.stringify({
                model: "sonar-pro",
                messages: [
                  { role: "system", content: "You are a movie and OTT show reviewer. Summarize reviews concisely." },
                  { role: "user", content: `Summarize 3-4 key points from these reviews of ${movie.title}:\n${sources.join("\n")}` },
                ],
                temperature: 0.3,
                max_tokens: 500,
              }),
            });

            const perplexityData = await perplexityRes.json();
            reviews_summary = perplexityData.choices?.[0]?.message?.content || reviews_summary;
          } catch (err) {
            console.error("AI fetch error:", err);
          }
        }

        return {
          title: movie.title,
          release_date: movie.release_date,
          tmdb_rating: movie.vote_average,
          overview: details.overview,
          reviews_summary,
          sources,
        };
      })
    );

    res.status(200).json(enrichedMovies);
  } catch (error) {
    console.error("MovieAgent Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
