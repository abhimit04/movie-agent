// /pages/api/movieAgent.js
export default async function handler(req, res) {
  const { query, type } = req.query; // type: "movie" | "tv"

  const TMDB_API_KEY = process.env.TMDB_API_KEY;
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

  if (!TMDB_API_KEY || !TAVILY_API_KEY || !PERPLEXITY_API_KEY) {
    return res.status(500).json({ error: "Missing one or more API keys" });
  }

  try {
    // 1️⃣ Tavily Search
    let tavilyQuery = query
      ? `Latest reviews and info about "${query}" ${type === "tv" ? "OTT series" : "movie"} released in India`
      : `List of new ${type === "tv" ? "OTT shows" : "movies"} released in India this week`;

    const tavilyRes = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({ query: tavilyQuery, max_results: 5 }),
    });
    const tavilyData = await tavilyRes.json();
    const tavilyLinks = tavilyData.results?.map((r) => r.url) || [];

    // 2️⃣ Perplexity - structured list
    const perplexityListRes = await fetch("https://api.perplexity.ai/chat/completions", {
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
            content: "You are an Indian entertainment tracker. Extract a JSON array of objects {title, description} for movies/OTT shows.",
          },
          {
            role: "user",
            content: `Summarise into 3–5 ${type === "tv" ? "OTT shows" : "movies"} released this week in India:\n${tavilyLinks.join("\n")}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });
    const perplexityListData = await perplexityListRes.json();
    const parsedList = perplexityListData.choices?.[0]?.message?.content || "[]";

    let releases = [];
    try {
      releases = JSON.parse(parsedList);
    } catch {
      releases = parsedList.split("\n").filter((l) => l.trim()).map((t) => ({ title: t }));
    }

    // 3️⃣ TMDB ratings + 4️⃣ Perplexity reviews
    const enriched = await Promise.all(
      releases.map(async (item) => {
        let rating = null;
        try {
          const tmdbUrl =
            type === "tv"
              ? `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(item.title)}&region=IN`
              : `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(item.title)}&region=IN`;
          const tmdbRes = await fetch(tmdbUrl);
          const tmdbData = await tmdbRes.json();
          if (tmdbData.results?.length) {
            rating = tmdbData.results[0].vote_average;
          }
        } catch (e) {
          console.error("TMDB fetch error:", e);
        }

        let reviews_summary = "No reviews available";
        try {
          const reviewRes = await fetch("https://api.perplexity.ai/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
            },
            body: JSON.stringify({
              model: "sonar-pro",
              messages: [
                { role: "system", content: "You are a movie/OTT critic. Summarise reviews concisely, user-friendly." },
                { role: "user", content: `Summarise reviews for "${item.title}" from:\n${tavilyLinks.join("\n")}` },
              ],
              temperature: 0.3,
              max_tokens: 500,
            }),
          });
          const reviewData = await reviewRes.json();
          reviews_summary = reviewData.choices?.[0]?.message?.content || reviews_summary;
        } catch (err) {
          console.error("Review summary error:", err);
        }

        return {
          title: item.title,
          description: item.description || "",
          tmdb_rating: rating,
          reviews_summary,
          sources: tavilyLinks,
        };
      })
    );

    // ✅ Wrap response in { movies: [] } for frontend compatibility
    res.status(200).json({ movies: enriched });
  } catch (error) {
    console.error("MovieAgent Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
