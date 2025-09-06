// /pages/api/movieAgents.js (note: filename should match the endpoint)
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, type = 'movie' } = req.query;

  // Validate required parameters
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  const TMDB_API_KEY = process.env.TMDB_API_KEY;
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

  if (!TMDB_API_KEY || !TAVILY_API_KEY || !PERPLEXITY_API_KEY) {
    console.error('Missing API keys:', {
      TMDB: !!TMDB_API_KEY,
      TAVILY: !!TAVILY_API_KEY,
      PERPLEXITY: !!PERPLEXITY_API_KEY
    });
    return res.status(500).json({ error: "Missing one or more API keys" });
  }

  try {
    // 1️⃣ Tavily Search with better query construction
    const tavilyQuery = `Latest reviews and info about "${query.trim()}" ${
      type === "tv" ? "web series OTT show" : "movie"
    } released in India 2024 2025`;

    console.log('Tavily search query:', tavilyQuery);

    const tavilyRes = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query: tavilyQuery,
        max_results: 5,
        search_depth: "basic",
        include_domains: ["imdb.com", "rottentomatoes.com", "metacritic.com", "bollywoodhungama.com", "filmcompanion.in"]
      }),
    });

    if (!tavilyRes.ok) {
      throw new Error(`Tavily API error: ${tavilyRes.status}`);
    }

    const tavilyData = await tavilyRes.json();
    const tavilyResults = tavilyData.results || [];
    const tavilyLinks = tavilyResults.map((r) => r.url);
    const tavilyContent = tavilyResults.map((r) => r.content || '').join('\n');

    console.log(`Found ${tavilyLinks.length} Tavily results`);

    // 2️⃣ TMDB Search first to get accurate data
    let tmdbData = null;
    try {
      const tmdbUrl = type === "tv"
        ? `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&region=IN&language=en-US`
        : `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&region=IN&language=en-US`;

      const tmdbRes = await fetch(tmdbUrl);
      if (tmdbRes.ok) {
        const tmdbResponse = await tmdbRes.json();
        tmdbData = tmdbResponse.results?.[0] || null;
      }
    } catch (e) {
      console.error("TMDB fetch error:", e.message);
    }

    // 3️⃣ Perplexity for review summary with better context
    let reviewsSummary = "No reviews available";
    try {
      const reviewPrompt = tavilyContent
        ? `Based on the following search results about "${query}", provide a concise review summary (max 200 words) covering plot, performances, direction, and overall reception:\n\n${tavilyContent.substring(0, 2000)}`
        : `Provide a concise review summary for "${query}" ${type === "tv" ? "web series" : "movie"} including plot, performances, and critical reception`;

      const reviewRes = await fetch("https://api.perplexity.ai/chat/completions", {
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
              content: "You are a film critic. Provide concise, informative reviews focusing on plot, performances, direction, and audience reception. Keep responses under 200 words."
            },
            { role: "user", content: reviewPrompt },
          ],
          temperature: 0.3,
          max_tokens: 300,
        }),
      });

      if (reviewRes.ok) {
        const reviewData = await reviewRes.json();
        const content = reviewData.choices?.[0]?.message?.content;
        if (content && content.trim()) {
          reviewsSummary = content.trim();
        }
      }
    } catch (err) {
      console.error("Review summary error:", err.message);
    }

    // 4️⃣ Construct response with proper fallbacks
    const result = {
      title: tmdbData?.title || tmdbData?.name || query,
      description: tmdbData?.overview || "Description not available",
      tmdb_rating: tmdbData?.vote_average || null,
      release_date: tmdbData?.release_date || tmdbData?.first_air_date || null,
      reviews_summary: reviewsSummary,
      sources: tavilyLinks,
      poster_path: tmdbData?.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : null
    };

    // Validate result has meaningful data
    if (!result.title || result.title.trim() === '') {
      return res.status(404).json({
        error: "No results found for the specified search query",
        movies: []
      });
    }

    console.log('Successfully processed query:', query);
    res.status(200).json({ movies: [result] });

  } catch (error) {
    console.error("MovieAgent Error:", error);

    // Provide more specific error messages
    let errorMessage = "Internal server error";
    if (error.message.includes('fetch')) {
      errorMessage = "Failed to fetch data from external services";
    } else if (error.message.includes('API')) {
      errorMessage = "External API error";
    }

    res.status(500).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}