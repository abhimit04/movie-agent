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
    // 1️⃣ Tavily Search for comprehensive information
    const tavilyQuery = `"${query.trim()}" ${
      type === "tv" ? "web series OTT show" : "movie"
    } reviews ratings IMDB Rotten Tomatoes 2024 2025 India`;

    console.log('Tavily search query:', tavilyQuery);

    const tavilyRes = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query: tavilyQuery,
        max_results: 8,
        search_depth: "advanced",
        include_domains: [
          "imdb.com",
          "rottentomatoes.com",
          "metacritic.com",
          "bollywoodhungama.com",
          "filmcompanion.in",
          "indiatoday.in",
          "hindustantimes.com",
          "indianexpress.com",
          "thehindu.com",
          "firstpost.com"
        ]
      }),
    });

    if (!tavilyRes.ok) {
      throw new Error(`Tavily API error: ${tavilyRes.status}`);
    }

    const tavilyData = await tavilyRes.json();
    const tavilyResults = tavilyData.results || [];
    const tavilyLinks = tavilyResults.map((r) => r.url);
    const tavilyContent = tavilyResults.map((r) => `${r.title}: ${r.content || ''}`).join('\n\n');

    console.log(`Found ${tavilyLinks.length} Tavily results`);

    if (tavilyResults.length === 0) {
      return res.status(404).json({
        error: "No information found for the specified search query",
        movies: []
      });
    }

    // 2️⃣ Perplexity Pro for structured data extraction
    const dataExtractionRes = await fetch("https://api.perplexity.ai/chat/completions", {
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
            content: `You are an expert film data extractor. Extract structured information from search results and return ONLY a valid JSON object with this exact format:
{
  "title": "official title of the movie/show",
  "description": "brief plot summary (50-100 words)",
  "rating": "numerical rating if found (e.g., 7.2, 8.5)",
  "rating_source": "source of rating (IMDB/Rotten Tomatoes/etc)",
  "release_date": "release date if available",
  "genre": "genre(s)",
  "cast": "main cast members",
  "director": "director name",
  "platform": "streaming platform if OTT show"
}`
          },
          {
            role: "user",
            content: `Extract structured data for "${query}" from these search results:\n\n${tavilyContent.substring(0, 4000)}`
          }
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    let movieData = {};
    try {
      if (dataExtractionRes.ok) {
        const extractionResult = await dataExtractionRes.json();
        const content = extractionResult.choices?.[0]?.message?.content || '{}';

        // Clean up JSON response (remove markdown formatting if present)
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        movieData = JSON.parse(cleanContent);
      }
    } catch (err) {
      console.error("Data extraction parsing error:", err.message);
      // Continue with fallback data
      movieData = {
        title: query,
        description: "Information extracted from search results",
        rating: null,
        rating_source: null
      };
    }

    // 3️⃣ Perplexity Pro for comprehensive review summary
    let reviewsSummary = "No reviews available";
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
            {
              role: "system",
              content: "You are a professional film critic. Analyze the provided information and write a comprehensive review summary covering plot, performances, direction, technical aspects, and critical/audience reception. Keep it informative yet engaging, around 150-200 words."
            },
            {
              role: "user",
              content: `Write a review summary for "${movieData.title || query}" based on these search results:\n\n${tavilyContent.substring(0, 3000)}`
            }
          ],
          temperature: 0.3,
          max_tokens: 400,
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

    // 4️⃣ Construct final response
    const result = {
      title: movieData.title || query,
      description: movieData.description || "Description not available",
      rating: movieData.rating ? parseFloat(movieData.rating) : null,
      rating_source: movieData.rating_source || null,
      release_date: movieData.release_date || null,
      genre: movieData.genre || null,
      cast: movieData.cast || null,
      director: movieData.director || null,
      platform: movieData.platform || null,
      reviews_summary: reviewsSummary,
      sources: tavilyLinks
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