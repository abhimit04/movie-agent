// /pages/api/movieAgents.js
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { query, type = "movie", weekly } = req.query;

  console.log(`=== MovieAgent Request ===`);
  console.log(`Query: "${query}", Type: ${type}, Weekly: ${weekly}`);

  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

  if (!PERPLEXITY_API_KEY) {
    console.error("Missing Perplexity API key");
    return res.status(500).json({
      error: "Missing Perplexity API key",
      search_hints: {
        found_results: false,
        suggestions: ["API configuration issue - please contact support"]
      }
    });
  }

  try {
    // Handle weekly releases request
    if (weekly === "true") {
      console.log("Processing weekly releases request");
      return await handleWeeklyReleases(res, PERPLEXITY_API_KEY);
    }

    // Handle regular search request
    if (!query || !query.trim()) {
      return res.status(400).json({
        error: "Query parameter is required",
        search_hints: {
          found_results: false,
          suggestions: [
            "Add a search query like 'Netflix shows' or 'Stree 2'",
            "Try specific movie names or browsing queries"
          ]
        }
      });
    }

    // Simplified classification - start with basic logic
    const isListQuery = await classifyQuery(query, PERPLEXITY_API_KEY);
    console.log(`Query "${query}" classified as: ${isListQuery ? 'LIST' : 'SPECIFIC'}`);

    if (isListQuery) {
      return await handleListQuery(res, query, type, PERPLEXITY_API_KEY);
    } else {
      return await handleSpecificQuery(res, query, type, PERPLEXITY_API_KEY);
    }

  } catch (error) {
    console.error("MovieAgent Main Error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error.message,
      search_hints: {
        found_results: false,
        suggestions: [
          "Something went wrong - please try again",
          "Check your internet connection",
          "Try a different search term"
        ]
      }
    });
  }
}

// Simplified classification function
async function classifyQuery(query, apiKey) {
  try {
    console.log(`Classifying query: "${query}"`);

    // First try simple heuristics for speed
    const simpleClassification = simpleClassify(query);
    if (simpleClassification !== null) {
      console.log(`Simple classification result: ${simpleClassification ? 'LIST' : 'SPECIFIC'}`);
      return simpleClassification;
    }

    // Fall back to AI if unclear
    console.log("Using AI classification");
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "user",
            content: `Is this query asking for multiple items/recommendations (LIST) or info about one specific movie/show (SPECIFIC)?

Query: "${query}"

Reply with just one word: LIST or SPECIFIC`
          }
        ],
        temperature: 0.1,
        max_tokens: 5,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const result = data.choices?.[0]?.message?.content?.trim().toUpperCase();
      console.log(`AI classification result: ${result}`);
      return result === "LIST";
    }

    console.log("AI classification failed, using fallback");
    return simpleClassify(query) || false;

  } catch (error) {
    console.error("Classification error:", error);
    return simpleClassify(query) || false;
  }
}

// Simple rule-based classification
function simpleClassify(query) {
  const q = query.toLowerCase().trim();

  // Clear list indicators
  const listWords = [
    'shows on', 'movies on', 'top ', 'best ', 'popular',
    'netflix', 'prime', 'amazon', 'hotstar', 'jio',
    'what to watch', 'recommendations', 'new releases',
    'this month', 'this week', 'trending'
  ];

  if (listWords.some(word => q.includes(word))) {
    return true; // LIST
  }

  // Clear specific indicators (short, no question words)
  if (q.length < 50 && !q.includes('what') && !q.includes('which') && !q.includes('?')) {
    return false; // SPECIFIC
  }

  return null; // Unclear, use AI
}

async function handleWeeklyReleases(res, apiKey) {
  console.log("Fetching weekly releases");
  try {
    const response = await callPerplexityAPI(apiKey, `What are the new movie and OTT releases this week in India? Include both theatrical and streaming releases.`, 'weekly');

    if (response && response.releases) {
      return res.status(200).json(response);
    } else {
      throw new Error("No releases data received");
    }

  } catch (error) {
    console.error("Weekly releases error:", error);
    return res.status(200).json({
      releases: [
        {
          title: "Unable to fetch current releases",
          type: "movie",
          platform: "Various",
          release_date: "This week",
          genre: "N/A"
        }
      ],
      search_hints: {
        found_results: false,
        suggestions: [
          "Unable to fetch this week's releases",
          "Try searching for specific movies or shows",
          "Check back later for updated releases"
        ]
      }
    });
  }
}

async function handleListQuery(res, query, type, apiKey) {
  console.log(`Processing list query: "${query}"`);
  try {
    const response = await callPerplexityAPI(apiKey, query, 'list');

    if (response && response.releases && response.releases.length > 0) {
      // Add search hints if not present
      if (!response.search_hints) {
        response.search_hints = {
          found_results: true,
          suggestions: response.releases.length < 3 ?
            ["Try more specific terms for better results"] :
            response.releases.length > 8 ?
            ["Great results! Try more specific terms to narrow down further"] :
            []
        };
      }
      console.log(`Returning ${response.releases.length} list results`);
      return res.status(200).json(response);
    } else {
      throw new Error("No list data received");
    }

  } catch (error) {
    console.error("List query error:", error);
    return res.status(200).json({
      releases: [
        {
          title: `No results found for "${query}"`,
          type: type,
          platform: "N/A",
          release_date: "N/A",
          genre: "N/A",
          rating: "N/A"
        }
      ],
      search_hints: {
        found_results: false,
        suggestions: [
          "Check spelling of your search terms",
          "Try broader terms like 'Netflix movies' or 'top shows'",
          "Be more specific about platform or genre",
          "Example searches: 'Netflix shows 2024', 'Prime Video movies'"
        ]
      }
    });
  }
}

async function handleSpecificQuery(res, query, type, apiKey) {
  console.log(`Processing specific query: "${query}"`);
  try {
    // Get basic movie data
    const movieData = await callPerplexityAPI(apiKey, `Find detailed information about the ${type} "${query}"`, 'specific');

    if (!movieData || !movieData.title || movieData.title === query) {
      // Poor match - return with hints
      return res.status(200).json({
        movies: [{
          title: query,
          description: "Movie/show not found or limited information available",
          release_date: null,
          genre: null,
          cast: null,
          director: null,
          platform: null,
          rating: null,
          reviews_summary: "Cannot provide review - please verify the title and try again.",
          type: type,
          search_hints: {
            found_match: false,
            confidence: "low",
            alternative_titles: [],
            suggestions: generateSpecificHints(query, type)
          }
        }],
        search_hints: {
          found_results: false,
          suggestions: generateSpecificHints(query, type)
        }
      });
    }

    // Get review only if we have good data
    let reviewsSummary = "No reviews available";
    try {
      const reviewData = await callPerplexityAPI(apiKey, `Write a detailed review summary for "${movieData.title}" (${type})`, 'review');
      if (reviewData && typeof reviewData === 'string') {
        reviewsSummary = reviewData;
      }
    } catch (reviewError) {
      console.error("Review error:", reviewError);
    }

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
      type: type,
      search_hints: {
        found_match: true,
        confidence: "high",
        suggestions: []
      }
    };

    return res.status(200).json({ movies: [result] });

  } catch (error) {
    console.error("Specific query error:", error);
    return res.status(200).json({
      movies: [{
        title: query,
        description: "Error processing search",
        reviews_summary: "Unable to process search at this time",
        search_hints: {
          found_match: false,
          confidence: "low",
          suggestions: generateSpecificHints(query, type)
        }
      }]
    });
  }
}

// Unified Perplexity API caller
async function callPerplexityAPI(apiKey, prompt, type) {
  try {
    let systemPrompt = "";
    let maxTokens = 1200;

    if (type === 'weekly' || type === 'list') {
      systemPrompt = `Return ONLY valid JSON with this format (no other text):
{
  "releases": [
    {
      "title": "Movie/Show Title",
      "type": "movie" or "tv",
      "platform": "Netflix/Prime/Theaters/etc",
      "release_date": "Date or Year",
      "genre": "Genre",
      "rating": "Rating if available"
    }
  ]
}`;
    } else if (type === 'specific') {
      systemPrompt = `Return ONLY valid JSON (no other text):
{
  "title": "Official Title",
  "description": "Brief plot summary",
  "release_date": "Release date",
  "genre": "Genres",
  "cast": "Main cast",
  "director": "Director",
  "platform": "Platform or Theaters",
  "rating": "IMDb rating"
}`;
    } else if (type === 'review') {
      systemPrompt = `Write a comprehensive review summary in 200-250 words with markdown formatting. Focus on story, performances, direction, and audience reception.`;
      maxTokens = 800;
    }

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: type === 'review' ? 0.3 : 0.1,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`API failed: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in response");
    }

    // For review type, return raw text
    if (type === 'review') {
      return content.trim();
    }

    // For JSON types, parse the response
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    try {
      return JSON.parse(content);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Raw content:", content);

      // Try to clean and parse again
      const cleaned = content
        .replace(/'/g, '"')
        .replace(/(\w+):/g, '"$1":')
        .replace(/,(\s*[}\]])/g, "$1");

      try {
        return JSON.parse(cleaned);
      } catch (secondError) {
        console.error("Even cleaned JSON failed:", secondError);
        return null;
      }
    }

  } catch (error) {
    console.error("Perplexity API error:", error);
    return null;
  }
}

function generateSpecificHints(query, type) {
  const hints = [];
  const q = query.toLowerCase().trim();

  if (q.length < 3) {
    hints.push("Search term too short - try the full movie/show name");
  } else if (/^\d+$/.test(q)) {
    hints.push("Try the full title instead of just numbers (e.g., 'Stree 2' not '2')");
  } else if (['movie', 'show', 'series'].includes(q)) {
    hints.push("Search term too generic - try a specific title");
  } else {
    hints.push("Check spelling of the movie/show name");
    hints.push(`Try adding the year if it's a recent ${type}`);
    if (type === 'tv') {
      hints.push("For TV shows, try adding 'series' or 'season'");
    }
    hints.push("Make sure you have the correct title");
  }

  return hints;
}