import { GoogleGenerativeAI } from "@google/generative-ai";


// 🔑 API Keys
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY;
const SERPAPI_KEY = process.env.SERPAPI_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 🧠 Gemini setup
if (!GEMINI_API_KEY) throw new Error("Missing Gemini API key");
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
function getGeminiModel() {
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

// ---------------------------
// 📌 Utilities
// ---------------------------
function isWithinDays(dateStr, days = 10) {
  if (!dateStr) return false;
  const releaseDate = new Date(dateStr);
  const now = new Date();
  const diff = (now - releaseDate) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}

function safeJoin(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object" && value.name) return value.name;
  return String(value);
}

function safeParseJSON(str) {
  try {
    return JSON.parse(str.replace(/```json\s*|```/g, "").trim());
  } catch {
    return null;
  }
}

function paginateArray(arr, page = 1, pageSize = 5) {
  const start = (page - 1) * pageSize;
  return arr.slice(start, start + pageSize);
}

// ---------------------------
// 🌐 External API Wrappers
// ---------------------------
async function callTavilyAPI(query) {
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

async function callSerpAPI(query) {
  if (!SERPAPI_KEY) throw new Error("Missing SerpAPI key");

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.append("engine", "google");
  url.searchParams.append("q", query);
  url.searchParams.append("api_key", SERPAPI_KEY);

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`SerpAPI failed: ${response.status}`);
  return response.json();
}

async function callGemini(prompt) {
  const model = getGeminiModel();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });
  return (await result.response).text();
}

// ---------------------------
// 🎬 TMDB Releases
// ---------------------------
async function fetchTMDBReleases() {
  const today = new Date();
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(today.getDate() - 10);

  const fromDate = tenDaysAgo.toISOString().split("T")[0];
  const toDate = today.toISOString().split("T")[0];

  const tmdbUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&primary_release_date.gte=${fromDate}&primary_release_date.lte=${toDate}&sort_by=release_date.desc`;
  console.log("🎬 Fetching TMDB releases:", tmdbUrl);

  const res = await fetch(tmdbUrl);
  const data = await res.json();

  return (data.results || []).map(movie => ({
    title: movie.title,
    releaseDate: movie.release_date,
    genres: movie.genre_ids || [],
    overview: movie.overview,
    rating: movie.vote_average || null,
    source: "TMDB",
  }));
}

// ---------------------------
// 🎥 OMDB Helpers
// ---------------------------
async function fetchOMDBDetails(title, year = "") {
  if (!OMDB_API_KEY) {
    console.warn("⚠️ OMDB_API_KEY missing");
    return null;
  }

  try {
    const url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}${year ? `&y=${year}` : ""}`;
    console.log(`🔎 OMDB fetching: ${url}`);

    const res = await fetch(url);
    const data = await res.json();

    if (data.Response === "False") {
      console.warn(`❌ OMDB: No data for "${title}"`, data);
      return null;
    }

    return {
      imdbRating: data.imdbRating !== "N/A" ? data.imdbRating : null,
      genre: data.Genre !== "N/A" ? data.Genre : null,
      platform: data.Type === "movie" ? "Theaters/OTT" : "OTT/TV",
      released: data.Released,
    };
  } catch (err) {
    console.error(`🔥 OMDB fetch error for "${title}":`, err);
    return null;
  }
}

// ---------------------------
// 📅 Weekly Releases (TMDB + OMDB)
// ---------------------------
async function fetchWeeklyReleases() {
  const tmdbReleases = await fetchTMDBReleases();

  const seen = new Set();
  const releases = [];

  for (const item of tmdbReleases) {
    const key = item.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const omdb = await fetchOMDBDetails(item.title);

    releases.push({
      title: item.title,
      release_date: item.releaseDate,
      genre: omdb?.genre || item.genres,
      platform: omdb?.platform || "Theaters/OTT",
      rating: omdb?.imdbRating || item.rating,
      source: omdb ? "TMDB+OMDB" : "TMDB",
    });
  }

  return releases.filter(r => isWithinDays(r.release_date, 10));
}
console.log("📅 Weekly releases from TMDB:", tmdbResults.length);
console.log("🎬 Weekly releases from OMDB:", omdbResults.length);
console.log("📦 Combined unique releases:", combined.length);
// ---------------------------
// 🤖 Query Handling
// ---------------------------
async function classifyQuery(query) {
  const systemPrompt = `Is this query asking for multiple items/recommendations (LIST) or about one specific movie/show (SPECIFIC)?
Query: "${query}"
Reply with just one word: LIST or SPECIFIC`;

  const result = await callGemini(systemPrompt);
  return result.trim().toUpperCase() === "LIST";
}

async function handleListQuery(res, query, page, pageSize) {
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

async function handleSpecificQuery(res, query) {
  try {
    const serpResult = await callSerpAPI(query);
    const knowledgeGraph = serpResult.knowledge_graph;
    const relatedSearches = serpResult.related_searches?.map(s => s.query) || [];

    let rating = knowledgeGraph?.rating;
    if (!rating && knowledgeGraph?.title) {
      const omdbData = await fetchOMDBDetails(knowledgeGraph.title, knowledgeGraph.year);
      rating = omdbData?.imdbRating;
    }

    if (!knowledgeGraph || !knowledgeGraph.title) {
      return res.status(200).json({
        movies: [],
        search_hints: { found_results: false, suggestions: ["No results found. Check spelling or add year."] }
      });
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
Write a detailed review summary of the movie "${knowledgeGraph.title}". Focus on the plot, performances, and audience reception. Important: Ignore missing data. Use markdown.`;

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
    return res.status(200).json({
      movies: [],
      search_hints: { found_results: false, suggestions: ["No results found. Check spelling or add year."] }
    });
  }
}

// ---------------------------
// 🚀 Main API Handler
// ---------------------------
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
    if (query === "weekly" || weekly === "true") {
      const releases = await fetchWeeklyReleases();
      return res.status(200).json({ releases });
    }

    if (!query || !query.trim()) return res.status(400).json({ error: "Query required" });

    const isListQuery = await classifyQuery(query);
    if (isListQuery) return handleListQuery(res, query, pageNum, pageLimit);
    return handleSpecificQuery(res, query);
  } catch (err) {
    console.error("Main handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
