import { GoogleGenerativeAI } from "@google/generative-ai";
// Simple in-memory cache
const cache = new Map();
function setCache(key, data, ttl = 600000) { // default 10 min
  cache.set(key, { data, expiry: Date.now() + ttl });
}
function getCache(key) {
  const cached = cache.get(key);
  if (!cached) return null;
  if (cached.expiry < Date.now()) {
    cache.delete(key);
    return null;
  }
  return cached.data;
}
// Tavily API helper
async function callTavilyAPI(query) {
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
  if (!TAVILY_API_KEY) throw new Error("Missing Tavily API key");

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TAVILY_API_KEY}` },
    body: JSON.stringify({ query, search_depth: "basic", include_answer: true, include_images: false, max_results: 50 }),
  });

  if (!response.ok) throw new Error(`Tavily API failed: ${response.status}`);
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
function getGeminiModel() { return genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); }

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

  if (data?.Response === "True") {
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
  try {
    const model = getGeminiModel();
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: systemPrompt + prompt }] }],
    });
    const text = (await result.response).text();
    return text;
  } catch (err) {
    console.error("Gemini call failed:", err);
    return "";
  }
}

// Normalize array/string fields
function safeJoin(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object" && value.name) return value.name;
  return String(value);
}

// Classify queries
async function classifyQuery(query) {
  const systemPrompt = `Is this query asking for multiple items/recommendations (LIST)
or about one specific movie/show (SPECIFIC)?
Query: "${query}"
Reply with just one word: LIST or SPECIFIC`;

  const result = await callGemini(systemPrompt);
  return result.trim().toUpperCase() === "LIST";
}

// Safe JSON parse
function safeParseJSON(str) {
  try {
    return JSON.parse(str.replace(/```json\s*|```/g, "").trim());
  } catch (err) {
    console.error("JSON parse failed:", err);
    return null;
  }
}

// Pagination helper
function paginateArray(arr, page = 1, pageSize = 5) {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return arr.slice(start, end);

// Weekly releases
async function handleWeeklyReleases(res, page = 1, pageSize = 5) {
  const cacheKey = `weekly`;
  const cached = getCache(cacheKey);
  if (cached) return res.status(200).json({ releases: paginateArray(cached.releases, page, pageSize) });

  try {
    const searchResult = await callTavilyAPI("new movie and OTT releases this week in India");
    const searchContent = searchResult.results.map(r => r.content).join("\n\n");
    const geminiPrompt = `Summarize into JSON with format: { "releases": [ { "title": "", "type": "movie/tv", "platform": "", "release_date": "", "genre": "" } ] } Input: ${searchContent}`;
    const geminiResponse = await callGemini(geminiPrompt);
    const parsedData = safeParseJSON(geminiResponse) || { releases: [] };
    setCache(cacheKey, parsedData, 10 * 60 * 1000); // 10 min cache
    return res.status(200).json({ releases: paginateArray(parsedData.releases, page, pageSize) });
  } catch (error) {
    console.error("Weekly releases error:", error);
    return res.status(200).json({ releases: [] });
  }
}

// List queries
async function handleListQuery(res, query, page = 1, pageSize = 5) {
  const cacheKey = `list:${query}`;
  const cached = getCache(cacheKey);
  if (cached) return res.status(200).json({ releases: paginateArray(cached.releases, page, pageSize) });

  try {
    const searchResult = await callTavilyAPI(query);
    const searchContent = searchResult.results.map(r => r.content).join("\n\n");
    const geminiPrompt = `Summarize the following search results into a JSON array of movie/show releases.\n\nSearch Results:\n${searchContent}\n\nReturn ONLY valid JSON with this format: { "releases": [ { "title": "", "type": "movie/tv", "platform": "", "release_date": "", "genre": "", "rating": "" } ] }`;
    const geminiResponse = await callGemini(geminiPrompt);
    const parsedData = safeParseJSON(geminiResponse) || { releases: [] };
    setCache(cacheKey, parsedData, 60 * 60 * 1000); // 1 hour cache
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

    if (!knowledgeGraph || !knowledgeGraph.title) {
      return res.status(200).json({ movies: [] });
    }

    let rating = knowledgeGraph.rating;
    if (!rating) {
      try {
        const omdbData = await callOMDBAPI(knowledgeGraph.title, knowledgeGraph.year);
        rating = omdbData.rating;
      } catch (err) {
        console.error("OMDB fallback failed:", err);
      }
    }

    const geminiSummaryPrompt = `Based on the following search result data, provide a comprehensive summary and review.

Title: ${knowledgeGraph.title}
Description: ${knowledgeGraph.description}
Release Date: ${knowledgeGraph.start_date || knowledgeGraph.year}
Genres: ${safeJoin(knowledgeGraph.genres)}
Cast: ${safeJoin(knowledgeGraph.cast?.map(c => c.name))}
Director: ${safeJoin(knowledgeGraph.director)}
Platforms: ${safeJoin(knowledgeGraph.streaming_platforms?.map(p => p.name))}
Rating: ${rating || "N/A"}

Write a detailed review summary of the movie "${knowledgeGraph.title}". Use markdown formatting.`;

    const reviewSummary = await callGemini(geminiSummaryPrompt);

    const result = {
      title: knowledgeGraph.title,
      description: knowledgeGraph.description,
      release_date: knowledgeGraph.start_date || knowledgeGraph.year,
      genre: safeJoin(knowledgeGraph.genres),
      cast: safeJoin(knowledgeGraph.cast?.map(c => c.name)),
      director: safeJoin(knowledgeGraph.director),
      platform: safeJoin(knowledgeGraph.streaming_platforms?.map(p => p.name)),
      rating,
      reviews_summary: reviewSummary || "",
      type: "movie",
    };

    return res.status(200).json({ movies: [result] });
  } catch (error) {
    console.error("Specific query error:", error);
    return res.status(200).json({ movies: [] });
  }
}

// Main handler
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { query, weekly, page = 1, pageSize = 5 } = req.query;
  const pageNum = parseInt(page, 10) || 1;
  const pageLimit = parseInt(pageSize, 10) || 5;

  if (weekly === "true") return handleWeeklyReleases(res, pageNum, pageLimit);
  if (!query || !query.trim()) return res.status(400).json({ error: "Query required" });

  try {
    const isListQuery = await classifyQuery(query);
    if (isListQuery) return handleListQuery(res, query, pageNum, pageLimit);
    return handleSpecificQuery(res, query); // optional caching for specific queries
  } catch (err) {
    console.error("Main handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
