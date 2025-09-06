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
    // -------------------------
    // 1️⃣ Tavily: Discover new releases / search
    // -------------------------
    let tavilyQuery;
    if (query) {
      tavilyQuery = `Latest reviews and info about "${query}" ${
        type === "tv" ? "OTT series" : "movie"
      } released in India`;
    } else {
      tavilyQuery = `List of new ${
        type === "tv" ? "OTT shows" : "movies"
      } released in India this week`;
    }

    const tavilyRes = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query: tavilyQuery,
        max_results: 5,
      }),
    });

    const tavilyData = await tavilyRes.json();
    const tavilyLinks = tavilyData.results?.map((r) => r.url) || [];

    // -------------------------
    // 2️⃣ Perplexity: Summarise search into structured list
    // -------------------------
    const perplexityListRes = await fetch(
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
                "You are an Indian entertainment tracker. Extract a structured list of movies/OTT shows (title + 1 line description) from the given links.",
            },
            {
              role: "user",
              content: `Summarise these pages into 3–5 ${
                type === "tv" ? "OTT shows" : "movies"
              } released this week in India:\n${tavilyLinks.join("\n")}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 600,
        }),
      }
    );

    const perplexityListData = await perplexityListRes.json();
    const parsedList =
      perplexityListData.choices?.[0]?.message?.content || "[]";

    // Try parsing into array of objects if JSON-like
    let releases = [];
    try {
      releases = JSON.parse(parsedList);
    } catch {
      // fallback: crude text split
      releases = parsedList
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => ({ title: line.trim() }));
    }

    // -------------------------
    // 3️⃣ TMDB: Fetch ratings for each title
    // -------------------------
    const enriched = await Promise.all(
      releases.map(async (item) => {
        let rating = null;

        try {
          const tmdbSearchUrl =
            type === "tv"
              ? `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
                  item.title
                )}&region=IN`
              : `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
                  item.title
                )}&region=IN`;

          const tmdbRes = await fetch(tmdbSearchUrl);
          const tmdbData = await tmdbRes.json();
          if (tmdbData.results?.length) {
            rating = tmdbData.results[0].vote_average;
          }
        } catch (e) {
          console.error("TMDB fetch error:", e);
        }

        // -------------------------
        // 4️⃣ Perplexity: Summarise reviews
        // -------------------------
        let reviews_summary = "No reviews available";
        try {
          const reviewRes = await fetch(
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
                      "You are a movie and OTT critic. Summarise reviews in a concise, user-friendly way.",
                  },
                  {
                    role: "user",
                    content: `Summarise 3-4 key reviews for "${
                      item.title
                    }" from these sources:\n${tavilyLinks.join("\n")}`,
                  },
                ],
                temperature: 0.3,
                max_tokens: 500,
              }),
            }
          );

          const reviewData = await reviewRes.json();
          reviews_summary =
            reviewData.choices?.[0]?.message?.content || reviews_summary;
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

    res.status(200).json(enriched);
  } catch (error) {
    console.error("MovieAgent Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
