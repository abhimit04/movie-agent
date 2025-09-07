// /pages/api/movieAgents.js
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { query, type = "movie", weekly } = req.query;

  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

  if (!PERPLEXITY_API_KEY) {
    return res.status(500).json({ error: "Missing Perplexity API key" });
  }

  try {
    // Handle weekly releases request
    if (weekly === "true") {
      return await handleWeeklyReleases(res, PERPLEXITY_API_KEY);
    }

    // Handle regular search request
    if (!query || !query.trim()) {
      return res.status(400).json({ error: "Query parameter is required" });
    }

    // Determine if this is a list query or specific item query using AI
    console.log(`Processing query: "${query}"`);
    const isListQuery = await detectListQuery(query, PERPLEXITY_API_KEY);
    console.log(`Query classified as list query: ${isListQuery}`);

    if (isListQuery) {
      console.log("Routing to handleListQuery");
      return await handleListQuery(res, query, type, PERPLEXITY_API_KEY);
    } else {
      console.log("Routing to handleSpecificSearchQuery");
      return await handleSpecificSearchQuery(res, query, type, PERPLEXITY_API_KEY);
    }
  } catch (error) {
    console.error("MovieAgent Error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
}

// AI-powered function to detect if query is asking for a list vs specific item
async function detectListQuery(query, apiKey) {
  try {
    console.log(`Starting AI classification for: "${query}"`);

    const detectionRes = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: `You are a query classifier for entertainment searches. Analyze the user's query and determine if they are asking for:

LIST_QUERY: Multiple items, recommendations, collections, or browsing requests. Examples:
- "Netflix shows this month"
- "top movies in 2024"
- "best series to watch"
- "new releases"
- "what should I watch"
- "trending movies"
- "popular shows on Prime"
- "comedy movies recommendations"

SPECIFIC_QUERY: Information about one specific movie, show, or person. Examples:
- "Stree 2"
- "Breaking Bad review"
- "tell me about Oppenheimer"
- "Shah Rukh Khan latest movie"
- "analyze Game of Thrones"
- "Scam 1992 details"

Respond with EXACTLY one word: either "LIST_QUERY" or "SPECIFIC_QUERY"`
          },
          {
            role: "user",
            content: `Classify this query: "${query}"`
          }
        ],
        temperature: 0.1,
        max_tokens: 10,
      }),
    });

    if (detectionRes.ok) {
      const detectionData = await detectionRes.json();
      const classification = detectionData.choices?.[0]?.message?.content?.trim();

      console.log(`AI classified "${query}" as: ${classification}`);

      // More robust classification check
      if (classification && classification.includes("LIST_QUERY")) {
        return true;
      } else if (classification && classification.includes("SPECIFIC_QUERY")) {
        return false;
      } else {
        console.log(`Unexpected AI response: ${classification}, using fallback`);
        return fallbackListDetection(query);
      }
    } else {
      console.log(`AI classification API failed with status: ${detectionRes.status}`);
      return fallbackListDetection(query);
    }
  } catch (error) {
    console.error("Query classification error:", error);
    return fallbackListDetection(query);
  }
}

// Improved fallback function with better logic
function fallbackListDetection(query) {
  const queryLower = query.toLowerCase().trim();
  console.log(`Using fallback classification for: "${queryLower}"`);

  // Clear list indicators - words that almost always indicate wanting multiple items
  const strongListWords = [
    'shows on', 'movies on', 'films on',
    'top ', 'best ', 'popular ', 'trending ',
    'new releases', 'latest releases', 'recent releases',
    'what to watch', 'what should i watch', 'recommendations',
    'this week', 'this month', 'this year',
    'netflix shows', 'prime movies', 'hotstar series'
  ];

  // Platform names often indicate browsing
  const platforms = ['netflix', 'prime', 'amazon', 'hotstar', 'jiocinema', 'sonyliv'];

  // Question words that usually indicate browsing
  const browsingQuestions = ['what ', 'which ', 'any good', 'suggest ', 'recommend'];

  // Check for strong list indicators
  const hasStrongListWord = strongListWords.some(word => queryLower.includes(word));

  // Check for platform + content type combination
  const hasPlatformAndType = platforms.some(platform => queryLower.includes(platform)) &&
    (queryLower.includes('show') || queryLower.includes('movie') || queryLower.includes('series'));

  // Check for browsing questions
  const hasBrowsingQuestion = browsingQuestions.some(q => queryLower.includes(q));

  // If it has strong indicators, it's likely a list query
  if (hasStrongListWord || hasPlatformAndType || hasBrowsingQuestion) {
    console.log(`Fallback detected list query due to: strong=${hasStrongListWord}, platform=${hasPlatformAndType}, browsing=${hasBrowsingQuestion}`);
    return true;
  }

  // Check if it looks like a specific title (short, no question words, no plural indicators)
  const looksSpecific = queryLower.length < 60 &&
    !queryLower.includes('?') &&
    !hasStrongListWord &&
    !hasBrowsingQuestion;

  console.log(`Fallback classified as specific query: ${looksSpecific}`);
  return !looksSpecific;
}

async function handleWeeklyReleases(res, apiKey) {
  console.log("Handling weekly releases request");
  try {
    const weeklyRes = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: `You are an Indian entertainment data extractor for this week's releases.
Perform a web search to get the most accurate and up-to-date information.
Return ONLY valid JSON with this exact format. IMPORTANT: Use double quotes for all strings and property names. Do not include any text outside the JSON object:

{
  "releases": [
    {
      "title": "official title",
      "type": "movie",
      "platform": "Theaters",
      "release_date": "specific date",
      "genre": "genre(s)"
    },
    {
      "title": "official title",
      "type": "tv",
      "platform": "Netflix",
      "release_date": "specific date",
      "genre": "genre(s)"
    }
  ]
}

Focus on current week releases in India. Include both theatrical and OTT releases.`
          },
          {
            role: "user",
            content: "What movies and OTT shows are releasing this week in India?"
          }
        ],
        temperature: 0.1,
        max_tokens: 1500,
      }),
    });

    if (!weeklyRes.ok) {
      throw new Error(`Perplexity API failed: ${weeklyRes.status}`);
    }

    const weeklyData = await weeklyRes.json();
    let content = weeklyData.choices?.[0]?.message?.content || '{"releases": []}';

    // Clean the response
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    console.log("Raw weekly content:", content);

    try {
      const parsedData = JSON.parse(content);
      console.log("Successfully parsed weekly data:", parsedData);
      return res.status(200).json(parsedData);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);

      // Try to fix common issues
      try {
        let cleaned = content
          .replace(/'/g, '"')
          .replace(/(\w+):/g, '"$1":')
          .replace(/,(\s*[}\]])/g, "$1");

        const parsedData = JSON.parse(cleaned);
        return res.status(200).json(parsedData);
      } catch (secondError) {
        console.error("Could not parse even cleaned content");
        return res.status(200).json(getFallbackWeeklyData());
      }
    }
  } catch (error) {
    console.error("Weekly releases error:", error);
    return res.status(200).json(getFallbackWeeklyData());
  }
}

// Handle list-based queries
async function handleListQuery(res, query, type, apiKey) {
  console.log(`Handling list query: "${query}"`);
  try {
    const listRes = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: `You are an entertainment data extractor for list queries in India.
Perform a web search and return ONLY valid JSON with this exact format. Use double quotes for all strings:

{
  "releases": [
    {
      "title": "official title",
      "type": "movie",
      "platform": "Netflix",
      "release_date": "2024",
      "genre": "Drama",
      "rating": "8.1"
    }
  ]
}

Limit to 8-12 most relevant items. Include ratings when available.`
          },
          {
            role: "user",
            content: query
          }
        ],
        temperature: 0.1,
        max_tokens: 1500,
      }),
    });

    if (!listRes.ok) {
      throw new Error(`Perplexity API failed: ${listRes.status}`);
    }

    const listData = await listRes.json();
    let content = listData.choices?.[0]?.message?.content || '{"releases": []}';

    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    console.log("Raw list content:", content);

    try {
      const parsedData = JSON.parse(content);
      console.log("Successfully parsed list data:", parsedData);
      return res.status(200).json(parsedData);
    } catch (parseError) {
      console.error("List JSON parse error:", parseError);

      try {
        let cleaned = content
          .replace(/'/g, '"')
          .replace(/(\w+):/g, '"$1":')
          .replace(/,(\s*[}\]])/g, "$1");

        const parsedData = JSON.parse(cleaned);
        return res.status(200).json(parsedData);
      } catch (secondError) {
        return res.status(200).json(getFallbackListData(type));
      }
    }
  } catch (error) {
    console.error("List query error:", error);
    return res.status(200).json(getFallbackListData(type));
  }
}

// Handle specific movie/show searches with detailed reviews
async function handleSpecificSearchQuery(res, query, type, apiKey) {
  console.log(`Handling specific search: "${query}"`);

  try {
    // Get basic details
    const detailsRes = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: `Extract entertainment details and return ONLY valid JSON:
{
  "title": "official title",
  "description": "brief plot summary",
  "release_date": "release date",
  "genre": "genre(s)",
  "cast": "main cast",
  "director": "director name",
  "platform": "platform or 'Theaters'",
  "rating": "IMDb rating number"
}`
          },
          {
            role: "user",
            content: `Find details for ${type === "tv" ? "show/series" : "movie"}: "${query}"`
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    let movieData = {};
    if (detailsRes.ok) {
      const result = await detailsRes.json();
      let content = result.choices?.[0]?.message?.content || "{}";
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      try {
        movieData = JSON.parse(content);
      } catch (e) {
        console.error("Could not parse movie details:", e);
        movieData = { title: query, description: "Details not available" };
      }
    }

    // Get review summary
    let reviewsSummary = "No reviews available";
    try {
      const reviewRes = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "sonar-pro",
          messages: [
            {
              role: "system",
              content: `Write a comprehensive review summary in 200-250 words with markdown formatting:

## Overall Assessment
Brief verdict with rating context

**Story & Plot**: Narrative analysis
**Performances**: Acting quality
**Direction & Technical**: Direction, cinematography, music
**Audience Reception**: Critical and public reception

Use **bold** for emphasis and *italics* for titles.`
            },
            {
              role: "user",
              content: `Write a detailed review for "${query}" (${type})`
            }
          ],
          temperature: 0.3,
          max_tokens: 800,
        }),
      });

      if (reviewRes.ok) {
        const reviewData = await reviewRes.json();
        const content = reviewData.choices?.[0]?.message?.content;
        if (content?.trim()) {
          reviewsSummary = content.trim();
        }
      }
    } catch (err) {
      console.error("Review error:", err);
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
      type: type
    };

    console.log("Returning specific search result:", result.title);
    return res.status(200).json({ movies: [result] });

  } catch (error) {
    console.error("Specific search error:", error);
    return res.status(500).json({ error: "Failed to process specific search" });
  }
}

// Helper function to generate search hints for list queries
function generateSearchHints(query, releases) {
  const hints = {
    found_results: true,
    suggestions: []
  };

  // Check if we got good results
  if (!releases || releases.length === 0) {
    hints.found_results = false;
    hints.suggestions = [
      "Check the spelling of the platform or genre",
      "Try broader terms like 'Netflix shows' or 'top movies'",
      "Be more specific about time period (e.g., '2024 releases')",
      "Try different platforms like 'Prime Video', 'Hotstar', 'JioCinema'"
    ];
  } else if (releases.length < 3) {
    // Few results - might need better search terms
    hints.suggestions = [
      "Try more specific search terms for better results",
      "Add year or genre for more targeted results"
    ];
  } else if (releases.some(r => r.title.includes("Sample") || r.title.includes("Unable"))) {
    // Fallback data was returned
    hints.found_results = false;
    hints.suggestions = [
      "Search terms might be too specific or contain typos",
      "Try simpler terms like 'Netflix movies' or 'top shows'",
      "Check if the platform name is spelled correctly"
    ];
  }

  return hints;
}

// Helper function to generate search hints for specific queries
function generateSpecificSearchHints(query, type, movieData = null) {
  const hints = {
    found_match: movieData?.title && movieData.title !== query,
    confidence: "medium",
    alternative_titles: [],
    suggestions: []
  };

  // Analyze the query for common issues
  const queryLower = query.toLowerCase().trim();

  // Check for very short queries
  if (queryLower.length < 3) {
    hints.found_match = false;
    hints.confidence = "low";
    hints.suggestions = [
      "Search term is too short - try the full movie/show name",
      "Add more details like year or main actor's name"
    ];
  }
  // Check for numbers without context
  else if (/^\d+$/.test(queryLower)) {
    hints.found_match = false;
    hints.suggestions = [
      "Searching by number alone won't work",
      "Try the full title like 'Movie Name 2' instead of just '2'"
    ];
  }
  // Check for very generic terms
  else if (['movie', 'show', 'series', 'film'].includes(queryLower)) {
    hints.found_match = false;
    hints.suggestions = [
      "Search term is too generic",
      "Try the specific name of the movie or show you're looking for"
    ];
  }
  // Check for possible misspellings (common patterns)
  else if (queryLower.includes(' ') && queryLower.split(' ').some(word => word.length > 8)) {
    hints.suggestions = [
      "If no results found, check spelling of longer words",
      "Try searching with just the main title without subtitles"
    ];
  }

  // Add type-specific suggestions
  if (type === "tv") {
    hints.suggestions.push("For TV shows, try adding 'series' or 'season' to your search");
  } else {
    hints.suggestions.push("For movies, try adding the release year if known");
  }

  // If we have movie data but it seems generic, lower confidence
  if (movieData && (movieData.description === "Details not available" || movieData.description === "Info not parsed")) {
    hints.confidence = "low";
    hints.suggestions.unshift("Limited information found - please verify the title spelling");
  }

  return hints;
}

// Fallback data functions with hints
function getFallbackWeeklyData() {
  return {
    releases: [
      {
        title: "Sample Movie Release",
        type: "movie",
        platform: "Theaters",
        release_date: "This Week",
        genre: "Drama"
      },
      {
        title: "Sample OTT Show",
        type: "tv",
        platform: "Netflix",
        release_date: "This Week",
        genre: "Thriller"
      }
    ],
    search_hints: {
      found_results: false,
      suggestions: [
        "Unable to fetch current week's releases",
        "Try searching for specific movies or shows instead",
        "Check your internet connection and try again"
      ]
    }
  };
}

function getFallbackListDataWithHints(type, query) {
  return {
    releases: [
      {
        title: "Search results unavailable",
        type: type,
        platform: "Various",
        release_date: "N/A",
        genre: "N/A",
        rating: "N/A"
      }
    ],
    search_hints: {
      found_results: false,
      suggestions: [
        "Unable to process your search at the moment",
        "Try simpler search terms like 'Netflix movies' or 'top shows'",
        "Check spelling and try again",
        "Make sure you're connected to the internet"
      ]
    }
  };
}

function getFallbackListData(type) {
  return getFallbackListDataWithHints(type, "unknown");
}