// /pages/api/movieAgents.js
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { query, type = "movie" } = req.query;

  if (!query || !query.trim()) {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

  if (!PERPLEXITY_API_KEY) {
    return res.status(500).json({ error: "Missing Perplexity API key" });
  }

  try {
    // 1️⃣ Perplexity for structured details
    const detailsRes = await fetch(
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
              content: `You are an Indian entertainment data extractor.
Return ONLY valid JSON with this format:
{
  "title": "official title",
  "description": "brief plot summary",
  "release_date": "release date",
  "genre": "genre(s)",
  "cast": "main cast",
  "director": "director",
  "platform": "OTT platform if applicable",
  "rating": "IMDb or critic rating if available"
}`,
            },
            {
              role: "user",
              content: `Find details for ${type === "tv" ? "OTT show" : "movie"} "${query}" in India.`,
            },
          ],
          temperature: 0.1,
          max_tokens: 600,
        }),
      }
    );

    let movieData = {};
    if (detailsRes.ok) {
      const extractionResult = await detailsRes.json();
      let content = extractionResult.choices?.[0]?.message?.content || "{}";
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      try {
        movieData = JSON.parse(content);
      } catch {
        movieData = { title: query, description: "Info not parsed" };
      }
    }

    // 2️⃣ Perplexity for reviews
    let reviewsSummary = "No reviews available";
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
                  "You are a film critic. Write a concise, 150-word review summary covering story, acting, direction, and audience reception. Ensure it is properly formatted and use markup",
              },
              {
                role: "user",
                content: `Summarise reviews for "${query}" (${type}).`,
              },
            ],
            temperature: 0.3,
            max_tokens: 400,
          }),
        }
      );

      if (reviewRes.ok) {
        const reviewData = await reviewRes.json();
        const content = reviewData.choices?.[0]?.message?.content;
        if (content) reviewsSummary = content.trim();
      }
    } catch (err) {
      console.error("Review summary error:", err.message);
    }

    // 3️⃣ Final response
    const result = {
      title: movieData.title || query,
      description: movieData.description || "Description not available",
      release_date: movieData.release_date || null,
      genre: movieData.genre || null,
      cast: movieData.cast || null,
      director: movieData.director || null,
      platform: movieData.platform || null,
      rating: movieData.rating || null,
      reviews_summary: reviewsSummary,
    };

    res.status(200).json({ movies: [result] });
  } catch (error) {
    console.error("MovieAgent Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
