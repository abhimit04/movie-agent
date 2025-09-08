import { GoogleGenerativeAI } from "@google/generative-ai";

// Tavily API helper
async function callTavilyAPI(query) {
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
  if (!TAVILY_API_KEY) throw new Error("Missing Tavily API key");

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      include_answer: true,
      include_images: false,
      max_results: 50,
    }),
  });

  if (!response.ok) {
    const errorDetails = await response.json().catch(() => ({}));
    throw new Error(errorDetails.detail || `Tavily API failed: ${response.status}`);
  }

  return response.json();
}

// SerpAPI helper
async function callSerpAPI(query) {
  const SERPAPI_KEY = process.env.SERPAPI_KEY;
  if (!SERPAPI_KEY) throw new Error("Missing SerpAPI key");

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.append("engine", "google");
  url.searchParams.append("q", query);
  url.searchParams.append("api_key", SERPAPI_KEY);

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`SerpAPI failed: ${response.status}`);
  return response.json();
}

// Gemini setup
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) throw new Error("Missing Gemini API key");
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
function getGeminiModel() {
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

// OMDB fallback helper
async function callOMDBAPI(title, year = "") {
  const OMDB_API_KEY = process.env.OMDB_API_KEY;
  if (!OMDB_API_KEY) throw new Error("Missing OMDB API key");

  const url = new URL("https://www.omdbapi.com/");
  url.searchParams.append("apikey", OMDB_API_KEY);
  url.searchParams.append("t", title);
  if (year) url.searchParams.append("y", year);

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`OMDB API failed: ${response.status}`);
  const data = await response.json();

  if (data && data.Response === "True") {
    return {
      rating: data.imdbRating !== "N/A" ? `${data.imdbRating}/10` : null,
      votes: data.imdbVotes !== "N/A" ? data.imdbVotes : null,
      runtime: data.Runtime !== "N/A" ? data.Runtime : null,
    };
  }
  return { rating: null, votes: null, runtime: null };
}

// Gemini helper
async function callGemini(prompt, systemPrompt = "") {
  const model = getGeminiModel();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: systemPrompt + prompt }] }],
  });
  return (await result.response).text();
}

// Normalize array/string fields
function safeJoin(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object" && value.name) return value.name;
  return String(value);
}

// Safe JSON parse
function safeParseJSON(str) {
  try {
    return JSON.parse(str.replace(/```json\s*|```/g, "").trim());
  } catch (err) {
    return null;
  }
}

// Pagination helper
function paginateArray(arr, page = 1, pageSize = 5) {
  const start = (page - 1) * pageSize;
  return arr.slice(start, start + pageSize);
}

// Classify query (LIST vs SPECIFIC)
async function classifyQuery(query) {
  const systemPrompt = `Is this query asking for multiple items/recommendations (LIST)
or about one specific movie/show (SPECIFIC)?
Query: "${query}"
Reply with just one word: LIST or SPECIFIC`;

  const result = await callGemini(systemPrompt);
  return result.trim().toUpperCase() === "LIST";
}

const GENRES = {
  movie: {
    28: "Action",
    12: "Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    14: "Fantasy",
    36: "History",
    27: "Horror",
    10402: "Music",
    9648: "Mystery",
    10749: "Romance",
    878: "Science Fiction",
    10770: "TV Movie",
    53: "Thriller",
    10752: "War",
    37: "Western",
  },
  tv: {
    10759: "Action & Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    10762: "Kids",
    9648: "Mystery",
    10763: "News",
    10764: "Reality",
    10765: "Sci-Fi & Fantasy",
    10766: "Soap",
    10767: "Talk",
    10768: "War & Politics",
    37: "Western",
  }
};

function mapGenres(ids, type) {
  if (!ids || ids.length === 0) return null;
  return ids.map(id => GENRES[type][id] || `Unknown(${id})`).join(", ");
}

function isWithinDays(dateStr, days = 10) {
  if (!dateStr) return false;
  const releaseDate = new Date(dateStr);
  const now = new Date();
  const diff = (now - releaseDate) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}

async function fetchOMDBDetails(title) {
  try {
    const OMDB_API_KEY = process.env.OMDB_API_KEY;
    if (!OMDB_API_KEY) {
      console.warn("⚠️ OMDB_API_KEY is missing in environment variables.");
      return null;
    }

    const url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}`;
    console.log(`🔎 Fetching OMDB for title: "${title}" → ${url}`);

    const omdbRes = await fetch(url);
    const omdbData = await omdbRes.json();

    if (omdbData.Response === "False") {
      console.warn(`❌ OMDB: No data found for "${title}". Full response:`, omdbData);
      return null;
    }

    console.log(`✅ OMDB data for "${title}":`, {
      imdbRating: omdbData.imdbRating,
      genre: omdbData.Genre,
      type: omdbData.Type
    });

    return {
      imdbRating: omdbData.imdbRating !== "N/A" ? omdbData.imdbRating : null,
      genre: omdbData.Genre !== "N/A" ? omdbData.Genre : null,
      platform: omdbData.Type === "movie" ? "Theaters/OTT" : "OTT/TV"
    };
  } catch (err) {
    console.error(`🔥 OMDB fetch error for "${title}":`, err);
    return null;
  }
}


async function handleWeeklyReleases(res, page = 1) {
  try {
    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    if (!TMDB_API_KEY) throw new Error("Missing TMDB API key");

    // Movies (India)
    const movieRes = await fetch(
      `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-IN&region=IN&page=${page}`
    );
    const movieData = await movieRes.json();

    // TV shows
    const tvRes = await fetch(
      `https://api.themoviedb.org/3/tv/on_the_air?api_key=${TMDB_API_KEY}&language=en-IN&page=${page}`
    );
    const tvData = await tvRes.json();

    let rawReleases = [
      ...(movieData.results || [])
        .filter(m => isWithinDays(m.release_date, 10))
        .map(m => ({
          title: m.title,
          type: "movie",
          release_date: m.release_date,
          rating: m.vote_average ? `${m.vote_average}/10 (TMDB)` : null,
          genre: m.genre_ids || [],
          platform: "Theaters/OTT"
        })),
      ...(tvData.results || [])
        .filter(t => isWithinDays(t.first_air_date, 10))
        .map(t => ({
          title: t.name,
          type: "tv",
          release_date: t.first_air_date,
          rating: t.vote_average ? `${t.vote_average}/10 (TMDB)` : null,
          genre: t.genre_ids || [],
          platform: "OTT/TV"
        }))
    ];

    // Enrich with OMDB (and deduplicate)
    const seen = new Set();
    const releases = [];
    for (const item of rawReleases) {
      const key = item.title.toLowerCase();
      if (seen.has(key)) continue; // skip duplicates
      seen.add(key);

      const omdb = await fetchOMDBDetails(item.title);

      releases.push({
        title: item.title,
        type: item.type,
        release_date: item.release_date,
        genre: omdb?.genre || item.genre,
        platform: omdb?.platform || item.platform,
        rating: omdb?.imdbRating
          ? `${omdb.imdbRating}/10 (IMDb)`
          : item.rating
      });
    }

    return res.status(200).json({
      page,
      total_pages: Math.max(movieData.total_pages, tvData.total_pages),
      releases
    });
  } catch (error) {
    console.error("Weekly releases error:", error);
    return res.status(200).json({
      releases: [],
      search_hints: {
        found_results: false,
        suggestions: [
          "Unable to fetch this week's releases. Please try again later."
        ]
      }
    });
  }
}

// List queries
async function handleListQuery(res, query, page = 1, pageSize = 5) {
  try {
    const searchResult = await callTavilyAPI(query);
    const searchContent = searchResult.results.map(r => r.content).join("\n\n");

    const geminiPrompt = `Summarize the following search results into a JSON array of movie/show releases.
Search Results:
${searchContent}
Return ONLY valid JSON with this format:
{
  "releases": [
    { "title": "", "type": "movie/tv", "platform": "", "release_date": "", "genre": "", "rating": "" }
  ]
}`;

    const geminiResponse = await callGemini(geminiPrompt);
    const parsedData = safeParseJSON(geminiResponse) || { releases: [] };

    return res.status(200).json({ releases: paginateArray(parsedData.releases, page, pageSize) });
  } catch (error) {
    console.error("List query error:", error);
    return res.status(200).json({ releases: [] });
  }
}

// Specific queries
async function handleSpecificQuery(res, query) {
  try {
    const serpResult = await callSerpAPI(query);
    const knowledgeGraph = serpResult.knowledge_graph;
    const relatedSearches = serpResult.related_searches?.map(s => s.query) || [];

    let rating = knowledgeGraph?.rating;
    if (!rating && knowledgeGraph?.title) {
      try {
        const omdbData = await callOMDBAPI(knowledgeGraph.title, knowledgeGraph.year);
        rating = omdbData.rating;
      } catch (err) {
        console.error("OMDB fallback failed:", err);
      }
    }

    if (!knowledgeGraph || !knowledgeGraph.title) {
      return res.status(200).json({ movies: [], search_hints: { found_results: false, suggestions: ["No results found. Check spelling or add year."] } });
    }

    const geminiSummaryPrompt = `Based on the following search result data, provide a comprehensive summary and review.
Search Result Data:
Title: ${knowledgeGraph.title}
Description: ${knowledgeGraph.description}
Release Date: ${knowledgeGraph.start_date || knowledgeGraph.year}
Genres: ${safeJoin(knowledgeGraph.genres)}
Cast: ${safeJoin(knowledgeGraph.cast?.map(c => c.name))}
Director: ${safeJoin(knowledgeGraph.director)}
Platforms: ${safeJoin(knowledgeGraph.streaming_platforms?.map(p => p.name))}
Rating: ${rating}
Write a detailed review summary of the movie "${knowledgeGraph.title}". Focus on the plot, performances, and audience reception. Important : Ignore the missing data and do not include in summary. Use markdown for formatting.`;

    const reviewSummary = await callGemini(geminiSummaryPrompt);

    return res.status(200).json({
      movies: [{
        title: knowledgeGraph.title,
        description: knowledgeGraph.description,
        release_date: knowledgeGraph.start_date || knowledgeGraph.year,
        genre: safeJoin(knowledgeGraph.genres),
        cast: safeJoin(knowledgeGraph.cast?.map(c => c.name)),
        director: safeJoin(knowledgeGraph.director),
        platform: safeJoin(knowledgeGraph.streaming_platforms?.map(p => p.name)),
        rating,
        reviews_summary: reviewSummary,
        type: "movie",
        search_hints: { found_match: true, confidence: "high", suggestions: relatedSearches }
      }]
    });
  } catch (error) {
    console.error("Specific query error:", error);
    return res.status(200).json({ movies: [], search_hints: { found_results: false, suggestions: ["No results found. Check spelling or add year."] } });
  }
}

// Main handler
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { query, weekly, page = 1, pageSize = 5 } = req.query;
  const pageNum = parseInt(page, 10) || 1;
  const pageLimit = parseInt(pageSize, 10) || 5;

  try {
    if (weekly === "true") return handleWeeklyReleases(res, pageNum, pageLimit);
    if (!query || !query.trim()) return res.status(400).json({ error: "Query required" });

    const isListQuery = await classifyQuery(query);
    if (isListQuery) return handleListQuery(res, query, pageNum, pageLimit);
    return handleSpecificQuery(res, query);
  } catch (err) {
    console.error("Main handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
