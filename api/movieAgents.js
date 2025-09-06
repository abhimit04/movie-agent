// /pages/api/movieAgen
// /pages/api/movieAgent.js

export default async function handler(req, res) {
  const { query, type } = req.query; // type: "movie" | "tv"

  const TMDB_API_KEY = process.env.TMDB_API_KEY;
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

  if (!TMDB_API_KEY) {
    return res.status(500).json({ error: "Missing TMDB API Key" });
  }

  try {
    let results = [];

    if (query) {
      // 🔍 Search for movie or TV show
      const searchUrl =
        type === "tv"
          ? `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
              query
            )}&region=IN`
          : `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
              query
            )}&region=IN`;

      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();

      if (!searchData.results?.length) {
        return res.status(404).json({ error: "Not found" });
      }

      results.push(searchData.results[0]);
    } else {
      // 🆕 Fetch trending content in India this week
      const trendingUrl =
        type === "tv"
          ? `https://api.themoviedb.org/3/trending/tv/week?api_key=${TMDB_API_KEY}&region=IN`
          : `https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_API_KEY}&region=IN`;

      const trendingRes = await fetch(trendingUrl);
      const trendingData = await trendingRes.json();

      results = trendingData.results.slice(0, 5); // Top 5
    }

    // Process each item (movie or show): fetch details + AI reviews
    const enriched = await Promise.all(
      results.map(async (item) => {
        const detailsUrl =
          type === "tv"
            ? `https://api.themoviedb.org/3/tv/${item.id}?api_key=${TMDB_API_KEY}&region=IN`
            : `https://api.themoviedb.org/3/movie/${item.id}?api_key=${TMDB_API_KEY}&region=IN`;

        const detailsRes = await fetch(detailsUrl);
        const details = await detailsRes.json();

        // Default values
        let reviews_summary = "No reviews available";
        let sources = [];

        if (TAVILY_API_KEY && PERPLEXITY_API_KEY) {
          try {
            // 1️⃣ Tavily search for Indian reviews
            const tavilyRes = await fetch("https://api.tavily.com/search", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${TAVILY_API_KEY}`,
              },
              body: JSON.stringify({
                query: `${item.title || item.name} ${
                  type === "tv" ? "OTT series" : "movie"
                } reviews site:indianexpress.com OR site:ndtv.com OR site:timesofindia.indiatimes.com`,
                max_results: 3,
              }),
            });

            const tavilyData = await tavilyRes.json();
            sources = tavilyData.results?.map((r) => r.url) || [];

            // 2️⃣ Perplexity Pro summarization
            const perplexityRes = await fetch(
              "https://api.perplexity.ai/chat/completions",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
                },
                body: JSON.stringify({
                  model: "sonar-pro",
                  messages: [
                    {
                      role: "system",
                      content:
                        "You are an Indian movie and OTT critic. Provide a concise, user-friendly review summary.",
                    },
                    {
                      role: "user",
                      content: `Summarize reviews for "${
                        item.title || item.name
                      }". Use these sources:\n${sources.join("\n")}`,
                    },
                  ],
                  temperature: 0.3,
                  max_tokens: 500,
                }),
              }
            );

            const perplexityData = await perplexityRes.json();
            reviews_summary =
              perplexityData.choices?.[0]?.message?.content ||
              reviews_summary;
          } catch (err) {
            console.error("AI fetch error:", err);
          }
        }

        return {
          title: item.title || item.name,
          release_date: item.release_date || item.first_air_date,
          tmdb_rating: item.vote_average,
          overview: details.overview,
          type: type || "movie",
          reviews_summary,
          sources,
        };
      })
    );

    res.status(200).json(enriched);
  } catch (error) {
    console.error("MovieAgent Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

