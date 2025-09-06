// pages/api/movies.js
import fetch from "node-fetch";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

export default async function handler(req, res) {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: "Missing movie/show query" });
    }

    // 1️⃣ Get movie info from TMDB
    const tmdbResp = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
        query
      )}`
    );
    const tmdbData = await tmdbResp.json();

    if (!tmdbData.results?.length) {
      return res.status(404).json({ error: "Movie not found on TMDB" });
    }

    const movie = tmdbData.results[0];

    // 2️⃣ Search reviews/articles via Tavily
    const tavilyResp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query: `${movie.title} movie reviews site:rottentomatoes.com OR site:indianexpress.com OR site:hollywoodreporter.com`,
        num_results: 5,
      }),
    });

    const tavilyData = await tavilyResp.json();
    const topLinks = tavilyData.results?.map((r) => r.url) || [];

    // 3️⃣ Summarize reviews with Perplexity Pro
    let reviews_summary = "No reviews summary available.";
    if (topLinks.length > 0) {
      const perplexityResp = await fetch("https://api.perplexity.ai/chat/completions", {
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
                "You are a helpful Indian entertainment expert. Summarize reviews clearly without adding citations or sources.",
            },
            {
              role: "user",
              content: `Summarize 3–4 genuine review points about "${movie.title}" based on these links:\n${topLinks.join(
                "\n"
              )}`,
            },
          ],
          max_tokens: 500,
          temperature: 0.5,
        }),
      });

      const perplexityData = await perplexityResp.json();
      reviews_summary =
        perplexityData.choices?.[0]?.message?.content ||
        "Could not generate review summary.";
    }

    // 4️⃣ Return structured response
    res.status(200).json({
      title: movie.title,
      release_date: movie.release_date,
      tmdb_rating: movie.vote_average,
      overview: movie.overview,
      reviews_summary,
      sources: topLinks,
    });
  } catch (err) {
    console.error("❌ API Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
