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

    // Determine if this is a list query or specific item query
    const isListQuery = detectListQuery(query);

    if (isListQuery) {
      return await handleListQuery(res, query, type, PERPLEXITY_API_KEY);
    } else {
      return await handleSpecificSearchQuery(res, query, type, PERPLEXITY_API_KEY);
    }
  } catch (error) {
    console.error("MovieAgent Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Function to detect if query is asking for a list vs specific item
function detectListQuery(query) {
  const listKeywords = [
    'shows in netflix', 'movies in netflix', 'shows on netflix', 'movies on netflix',
    'shows in amazon', 'movies in amazon', 'shows on prime', 'movies on prime',
    'shows in hotstar', 'movies in hotstar', 'shows on hotstar', 'movies on hotstar',
    'top shows', 'top movies', 'best shows', 'best movies',
    'new shows', 'new movies', 'latest shows', 'latest movies',
    'upcoming shows', 'upcoming movies',
    'this month', 'this week', 'recently added', 'new releases',
    'trending shows', 'trending movies', 'popular shows', 'popular movies',
    'shows to watch', 'movies to watch', 'recommended shows', 'recommended movies'
  ];

  const queryLower = query.toLowerCase();
  return listKeywords.some(keyword => queryLower.includes(keyword));
}

async function handleWeeklyReleases(res, apiKey) {
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
              Perform a web search on primarily the following sites to get the most accurate and up-to-date information:
              - google.com
              - imdb.com
              - rottentomatoes.com
              - bookmyshow.com
              - filmibeat.com
              - livemint.com
From the search,Return ONLY valid JSON with this exact format. IMPORTANT: Use double quotes for all strings and property names. IMPORTANT: Limit to only number of releases to fit within response limits. Do not include any text outside the JSON object:
{
  "releases": [
    {
      "title": "official title",
      "type": "movie" or "tv" or "OTT",
      "platform": "theater/Netflix/Prime Video/JioHotstar/SonyLiv/etc",
      "release_date": "release date this week",
      "genre": "genre(s)"
      ]
    }
  ]
}
Ensure the response is valid JSON only. Focus on the latest and popular releases for the current week only.
Include both Bollywood/regional movies in theaters AND new OTT show/movie releases this week in India.`,
          },
          {
            role: "user",
            content:
              "What movies and OTT shows are releasing this week in India? Include both theatrical releases and streaming platform releases.",
          },
        ],
        temperature: 0.1,
        max_tokens: 1200,
      }),
    });

    if (weeklyRes.ok) {
      const weeklyData = await weeklyRes.json();
      let content =
        weeklyData.choices?.[0]?.message?.content || '{"releases": []}';

      content = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      try {
        const parsedData = JSON.parse(content);
        console.log("Weekly releases parsed data:", parsedData);
        return res.status(200).json(parsedData);
      } catch (parseError) {
        console.error("JSON parse error for weekly releases:", parseError);
        console.error("Raw content that failed to parse:", content);

        try {
          // Fix common JSON formatting issues
          let cleanedContent = content
            .replace(/'/g, '"') // Replace single quotes with double quotes
            .replace(/(\w+):/g, '"$1":') // Add quotes around unquoted keys
            .replace(/,(\s*[}\]])/g, "$1") // Remove trailing commas
            .replace(/\n/g, " ") // Remove newlines
            .trim();

          const parsedData = JSON.parse(cleanedContent);
          console.log("Successfully parsed cleaned JSON:", parsedData);
          return res.status(200).json(parsedData);
        } catch (secondParseError) {
          console.error("Even cleaned JSON failed to parse:", secondParseError);

          return res.status(200).json({
            releases: [
              {
                title: "Stree 2",
                type: "movie",
                platform: "Theaters",
                release_date: "August 2024",
                genre: "Horror Comedy",
                description: "Sequel to the hit horror-comedy Stree",
              },
              {
                title: "IC 814: The Kandahar Hijack",
                type: "tv",
                platform: "Netflix",
                release_date: "August 2024",
                genre: "Thriller Drama",
                description:
                  "Netflix series based on the 1999 hijacking incident",
              },
            ],
          });
        }
      }
    } else {
      throw new Error("Failed to fetch weekly releases");
    }
  } catch (error) {
    console.error("Weekly releases error:", error);

    // Return fallback data
    return res.status(200).json({
      releases: [
        {
          title: "Khel Khel Mein",
          type: "movie",
          platform: "Theaters",
          release_date: "August 2024",
          genre: "Comedy Drama",
          description: "Comedy starring Akshay Kumar",
        },
        {
          title: "Phir Aayi Hasseen Dillruba",
          type: "movie",
          platform: "Netflix",
          release_date: "August 2024",
          genre: "Romantic Thriller",
          description: "Sequel to Haseen Dillruba on Netflix",
        },
        {
          title: "Mirzapur Season 3",
          type: "tv",
          platform: "Amazon Prime Video",
          release_date: "July 2024",
          genre: "Crime Thriller",
          description: "Continuation of the popular crime series",
        },
      ],
    });
  }
}

// New function to handle list-based queries (Netflix shows, top movies, etc.)
async function handleListQuery(res, query, type, apiKey) {
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
            content: `You are an Indian entertainment data extractor for list queries.
              Perform a web search to get the most accurate and up-to-date information.
Return ONLY valid JSON with this exact format. IMPORTANT: Use double quotes for all strings and property names. IMPORTANT: Limit to 8-12 items to fit within response limits. Do not include any text outside the JSON object:
{
  "releases": [
    {
      "title": "official title",
      "type": "movie" or "tv",
      "platform": "Netflix/Prime Video/JioHotstar/SonyLiv/Theaters/etc",
      "release_date": "release date or year",
      "genre": "genre(s)",
      "rating": "IMDb rating if available"
    }
  ]
}
Ensure the response is valid JSON only. Focus on the most relevant and popular items based on the query.`,
          },
          {
            role: "user",
            content: query,
          },
        ],
        temperature: 0.1,
        max_tokens: 1200,
      }),
    });

    if (listRes.ok) {
      const listData = await listRes.json();
      let content = listData.choices?.[0]?.message?.content || '{"releases": []}';

      content = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      try {
        const parsedData = JSON.parse(content);
        console.log("List query parsed data:", parsedData);
        return res.status(200).json(parsedData);
      } catch (parseError) {
        console.error("JSON parse error for list query:", parseError);
        console.error("Raw content that failed to parse:", content);

        try {
          // Fix common JSON formatting issues
          let cleanedContent = content
            .replace(/'/g, '"')
            .replace(/(\w+):/g, '"$1":')
            .replace(/,(\s*[}\]])/g, "$1")
            .replace(/\n/g, " ")
            .trim();

          const parsedData = JSON.parse(cleanedContent);
          console.log("Successfully parsed cleaned list JSON:", parsedData);
          return res.status(200).json(parsedData);
        } catch (secondParseError) {
          console.error("Even cleaned list JSON failed to parse:", secondParseError);

          // Return fallback list data based on query context
          return res.status(200).json({
            releases: [
              {
                title: "Sample Movie/Show 1",
                type: type,
                platform: "Netflix",
                release_date: "2024",
                genre: "Drama",
                rating: "7.5"
              },
              {
                title: "Sample Movie/Show 2",
                type: type,
                platform: "Prime Video",
                release_date: "2024",
                genre: "Action",
                rating: "8.0"
              }
            ],
          });
        }
      }
    } else {
      throw new Error("Failed to fetch list query results");
    }
  } catch (error) {
    console.error("List query error:", error);

    // Return basic fallback
    return res.status(200).json({
      releases: [
        {
          title: "Unable to fetch results",
          type: type,
          platform: "Various",
          release_date: "N/A",
          genre: "N/A",
          rating: "N/A"
        }
      ],
    });
  }
}

// Renamed and kept for specific movie/show searches only
async function handleSpecificSearchQuery(res, query, type, apiKey) {
  // 1️⃣ Perplexity for structured details
  const detailsRes = await fetch(
    "https://api.perplexity.ai/chat/completions",
    {
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
            content: `You are an Indian entertainment data extractor.
Return ONLY valid JSON with this format:
{
  "title": "official title",
  "description": "brief plot summary",
  "release_date": "release date",
  "genre": "genre(s)",
  "cast": "main cast members",
  "director": "director name",
  "platform": "OTT platform if applicable or 'Theaters' for movies",
  "rating": "IMDb rating as number (e.g., 7.5) or critic rating"
}`,
          },
          {
            role: "user",
            content: `Find detailed information for ${type === "tv" ? "OTT show/web series" : "movie"} "${query}" in India. Include IMDB rating if available.`,
          },
        ],
        temperature: 0.1,
        max_tokens: 1200,
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

  // 2️⃣ Perplexity for enhanced reviews with better formatting
  let reviewsSummary = "No reviews available";
  try {
    const reviewRes = await fetch(
      "https://api.perplexity.ai/chat/completions",
      {
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
              content: `You are a professional film/show critic. Write a comprehensive review summary in 200-250 words with proper markdown formatting:

Use this structure:
## Overall Assessment
Brief overall verdict with rating context

**Story & Plot**: Your analysis of the narrative
**Performances**: Acting quality and standout performances
**Direction & Technical**: Direction, cinematography, music
**Audience Reception**: How viewers and critics received it

Use **bold** for emphasis on key points and *italics* for movie/show titles. Write in an engaging, informative style.`,
            },
            {
              role: "user",
              content: `Write a detailed review summary for "${query}" (${type}). Include critic and audience perspectives, story analysis, performances, and technical aspects.`,
            },
          ],
          temperature: 0.3,
          max_tokens: 800,
        }),
      }
    );

    if (reviewRes.ok) {
      const reviewData = await reviewRes.json();
      const content = reviewData.choices?.[0]?.message?.content;
      if (content && content.trim() !== "") {
        reviewsSummary = content.trim();
      }
    }
  } catch (err) {
    console.error("Review summary error:", err.message);
  }

  // 3️⃣ Final response with enhanced data structures
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

  res.status(200).json({ movies: [result] });
}