// pages/api/movieAgents.js
import { GoogleGenerativeAI } from "@google/generative-ai";

// -------------------------------
// Config / Keys (from env)
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY;
const SERPAPI_KEY = process.env.SERPAPI_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// -------------------------------
// Gemini (Google Generative AI) setup
if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
function getGeminiModel() {
  // keep the model you prefer
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}
async function callGemini(prompt, systemPrompt = "") {
  try {
    const model = getGeminiModel();
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: systemPrompt + prompt }] }],
    });
    return (await result.response).text();
  } catch (err) {
    console.error("Gemini error:", err);
    throw err;
  }
}

// -------------------------------
// Utilities
function safeJoin(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object" && value.name) return value.name;
  return String(value);
}

function safeParseJSON(str) {
  try {
    return JSON.parse(str.replace(/```json\s*|```/g, "").trim());
  } catch (err) {
    console.warn("safeParseJSON failed:", err);
    return null;
  }
}

function paginateArray(arr, page = 1, pageSize = 5) {
  const start = (page - 1) * pageSize;
  return arr.slice(start, start + pageSize);
}

function isWithinDays(dateStr, days = 10) {
  if (!dateStr) return false;
  const releaseDate = new Date(dateStr);
  if (isNaN(releaseDate)) return false;
  const now = new Date();
  const diff = (now - releaseDate) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}

// -------------------------------
// External API wrappers
async function callTavilyAPI(query) {
  if (!TAVILY_API_KEY) throw new Error("Missing TAVILY_API_KEY");
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TAVILY_API_KEY}`,
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
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.detail || `Tavily API failed: ${response.status}`);
    }

    return response.json();
  } catch (err) {
    console.error("Tavily API error:", err);
    throw err;
  }
}

async function callSerpAPI(query) {
  if (!SERPAPI_KEY) throw new Error("Missing SERPAPI_KEY");
  try {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.append("engine", "google");
    url.searchParams.append("q", query);
    url.searchParams.append("api_key", SERPAPI_KEY);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`SerpAPI failed: ${res.status}`);
    return res.json();
  } catch (err) {
    console.error("SerpAPI error:", err);
    throw err;
  }
}

// -------------------------------
// TMDB discovery (movies + TV) for last N days
async function fetchTMDBMoviesByDateRange(days = 10, page = 1) {
  if (!TMDB_API_KEY) throw new Error("Missing TMDB_API_KEY");
  const today = new Date();
  const start = new Date();
  start.setDate(today.getDate() - days);

  const from = start.toISOString().split("T")[0];
  const to = today.toISOString().split("T")[0];

  const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&primary_release_date.gte=${from}&primary_release_date.lte=${to}&region=IN&sort_by=release_date.desc&page=${page}`;
  console.log("TMDB movies URL:", url);

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("TMDB movies failed:", res.status, text);
    return { results: [], total_pages: 0 };
  }
  return res.json();
}

async function fetchTMDBTVByDateRange(days = 10, page = 1) {
  if (!TMDB_API_KEY) throw new Error("Missing TMDB_API_KEY");
  // TMDB doesn't have a simple discover for TV release dates like movies,
  // we'll use "on the air" and then filter by first_air_date.
  const url = `https://api.themoviedb.org/3/tv/on_the_air?api_key=${TMDB_API_KEY}&page=${page}`;
  console.log("TMDB tv URL:", url);

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("TMDB tv failed:", res.status, text);
    return { results: [], total_pages: 0 };
  }
  return res.json();
}

// -------------------------------
// OMDB enrichment: use exact title + optional year (y) with `t` param
async function fetchOMDBDetails(title, year = "") {
  if (!OMDB_API_KEY) {
    console.warn("OMDB API key missing, skipping OMDB enrichment.");
    return null;
  }

  try {
    const url = new URL("https://www.omdbapi.com/");
    url.searchParams.append("apikey", OMDB_API_KEY);
    url.searchParams.append("t", title);
    if (year) url.searchParams.append("y", year);

    console.log(`OMDB lookup: ${title} ${year ? "(" + year + ")" : ""} -> ${url.toString()}`);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.Response === "False") {
      console.warn(`OMDB no match for "${title}" (${year})`, data);
      return null;
    }

    // Normalize fields
    return {
      title: data.Title || title,
      released: data.Released || null,
      genre: data.Genre && data.Genre !== "N/A" ? data.Genre : null,
      imdbRating: data.imdbRating && data.imdbRating !== "N/A" ? `${data.imdbRating}/10` : null,
      runtime: data.Runtime && data.Runtime !== "N/A" ? data.Runtime : null,
      platform: data.Type === "movie" ? "Theaters/OTT" : "OTT/TV",
      source: "OMDB",
    };
  } catch (err) {
    console.error("OMDB fetch error:", err);
    return null;
  }
}

// -------------------------------
// Weekly releases: TMDB discovery + OMDB enrichment + dedupe
async function fetchWeeklyReleases({ days = 10, page = 1 } = {}) {
  // 1) TMDB movies
  const moviePage = await fetchTMDBMoviesByDateRange(days, page);
  const movies = (moviePage.results || []).filter(m => m.release_date && isWithinDays(m.release_date, days))
    .map(m => ({
      title: m.title,
      type: "movie",
      release_date: m.release_date,
      tmdb_genre_ids: m.genre_ids || [],
      overview: m.overview || null,
      tmdb_rating: m.vote_average ? `${m.vote_average}/10 (TMDB)` : null,
      source: "TMDB",
    }));

  // 2) TMDB TV (on the air) then filter by first_air_date within range
  const tvPage = await fetchTMDBTVByDateRange(days, page);
  const tvs = (tvPage.results || []).filter(t => t.first_air_date && isWithinDays(t.first_air_date, days))
    .map(t => ({
      title: t.name,
      type: "tv",
      release_date: t.first_air_date,
      tmdb_genre_ids: t.genre_ids || [],
      overview: t.overview || null,
      tmdb_rating: t.vote_average ? `${t.vote_average}/10 (TMDB)` : null,
      source: "TMDB",
    }));

  // Combine seed list
  const seed = [...movies, ...tvs];
  console.log("TMDB seed count:", seed.length);

  // Enrich each seed item with OMDB using title + year (year from release_date if present)
  const unique = [];
  const seen = new Set();

  for (const item of seed) {
    const key = item.title?.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const year = item.release_date ? (new Date(item.release_date).getFullYear() + "") : "";
    const omdb = await fetchOMDBDetails(item.title, year);

    const merged = {
      title: item.title,
      type: item.type,
      release_date: item.release_date,
      overview: item.overview,
      genre: omdb?.genre || null,
      rating: omdb?.imdbRating || item.tmdb_rating || null,
      runtime: omdb?.runtime || null,
      platform: omdb?.platform || (item.type === "movie" ? "Theaters/OTT" : "OTT/TV"),
      source: omdb ? "TMDB+OMDB" : item.source,
    };

    console.log("Weekly merged item:", merged.title, merged.release_date, "rating:", merged.rating);
    unique.push(merged);
  }

  return unique;
}

// -------------------------------
// List query (Tavily -> Gemini JSON) + OMDB enrichment
async function handleListQuery(res, query, page = 1, pageSize = 5) {
  try {
    console.log("Handling list query:", query);
    const searchResult = await callTavilyAPI(query);
    const searchContent = (searchResult.results || []).map(r => r.content).join("\n\n");

    // Ask Gemini to return JSON list
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
    const parsed = safeParseJSON(geminiResponse) || { releases: [] };
    console.log("Gemini returned releases:", (parsed.releases || []).length);

    // Enrich each with OMDB (if possible)
    const enriched = [];
    const seen = new Set();
    for (const r of (parsed.releases || [])) {
      const title = r.title;
      if (!title) continue;
      const key = title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      // try to extract year from release_date if available
      let year = "";
      if (r.release_date) {
        const d = new Date(r.release_date);
        if (!isNaN(d)) year = d.getFullYear() + "";
      }

      const omdb = await fetchOMDBDetails(title, year);
      enriched.push({
        title,
        type: r.type || null,
        platform: omdb?.platform || r.platform || null,
        release_date: r.release_date || null,
        genre: omdb?.genre || r.genre || null,
        rating: omdb?.imdbRating || r.rating || null,
        source: omdb ? "Gemini+OMDB" : "Gemini",
      });
    }

    return res.status(200).json({ releases: paginateArray(enriched, page, pageSize) });
  } catch (err) {
    console.error("List query error:", err);
    return res.status(200).json({ releases: [] });
  }
}

// -------------------------------
// Specific query (SerpAPI + OMDB fallback + Gemini summary)
async function handleSpecificQuery(res, query) {
  try {
    console.log("Handling specific query:", query);
    const serpResult = await callSerpAPI(query);
    const knowledgeGraph = serpResult.knowledge_graph;
    const relatedSearches = serpResult.related_searches?.map(s => s.query) || [];
    console.log("SerpAPI knowledgeGraph:", !!knowledgeGraph, "related:", relatedSearches.length);

    if (!knowledgeGraph || !knowledgeGraph.title) {
      console.warn("No knowledge graph title found.");
      return res.status(200).json({
        movies: [],
        search_hints: {
          found_results: false,
          suggestions: ["No match from SerpAPI. Try exact title or add year."]
        }
      });
    }

    // try OMDB if rating missing
    let rating = knowledgeGraph.rating || null;
    if (!rating) {
      try {
        const omdb = await fetchOMDBDetails(knowledgeGraph.title, knowledgeGraph.year || "");
        rating = omdb?.imdbRating || null;
        if (omdb) {
          console.log("OMDB provided rating for specific query:", omdb.imdbRating);
        }
      } catch (err) {
        console.warn("OMDB fallback failed:", err);
      }
    }

    // Build Gemini prompt for review; user asked earlier to ignore missing data
    const geminiSummaryPrompt = `Based on the following search result data, provide a comprehensive summary and review.

Search Result Data:
Title: ${knowledgeGraph.title}
Description: ${knowledgeGraph.description || ""}
Release Date: ${knowledgeGraph.start_date || knowledgeGraph.year || ""}
Genres: ${safeJoin(knowledgeGraph.genres)}
Cast: ${safeJoin(knowledgeGraph.cast?.map(c => c.name))}
Director: ${safeJoin(knowledgeGraph.director)}
Platforms: ${safeJoin(knowledgeGraph.streaming_platforms?.map(p => p.name))}
Rating: ${rating || "N/A"}

Write a detailed review summary of the movie/show "${knowledgeGraph.title}". Focus on plot, performances, and audience reception. Important: ignore missing fields and do not mention them in the summary. Use markdown.`;

    let reviewSummary = "";
    try {
      reviewSummary = await callGemini(geminiSummaryPrompt);
    } catch (err) {
      console.warn("Gemini summarisation failed for specific query; falling back to description.");
      reviewSummary = knowledgeGraph.description || "";
    }

    const result = {
      title: knowledgeGraph.title,
      description: knowledgeGraph.description || null,
      release_date: knowledgeGraph.start_date || knowledgeGraph.year || null,
      genre: safeJoin(knowledgeGraph.genres),
      cast: safeJoin(knowledgeGraph.cast?.map(c => c.name)),
      director: safeJoin(knowledgeGraph.director),
      platform: safeJoin(knowledgeGraph.streaming_platforms?.map(p => p.name)),
      rating,
      reviews_summary: reviewSummary,
      type: "movie",
      search_hints: {
        found_match: true,
        confidence: "high",
        suggestions: relatedSearches
      }
    };

    return res.status(200).json({ movies: [result] });
  } catch (err) {
    console.error("Specific query error:", err);
    return res.status(200).json({
      movies: [],
      search_hints: { found_results: false, suggestions: ["No results found. Check spelling or add year."] }
    });
  }
}

// -------------------------------
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
    // Weekly releases (tmdb discovery + omdb enrichment)
    if (query === "weekly" || weekly === "true") {
      console.log("API: weekly releases request");
      const releases = await fetchWeeklyReleases({ days: 10, page: pageNum });
      console.log("Weekly releases count:", releases.length);
      return res.status(200).json({ page: pageNum, releases: paginateArray(releases, pageNum, pageLimit) });
    }

    if (!query || !query.trim()) {
      return res.status(400).json({
        error: "Query parameter is required",
        search_hints: { found_results: false, suggestions: ["Try: 'Netflix movies', 'latest releases' or a movie title like 'Baaghi 2'"] }
      });
    }

    // classify list vs specific
    const isList = await (async () => {
      try {
        return await (async function classifyQueryLocal(q) {
          const systemPrompt = `Is this query asking for multiple items/recommendations (LIST) or about one specific movie/show (SPECIFIC)?
Query: "${q}"
Reply with just one word: LIST or SPECIFIC`;
          const r = await callGemini(systemPrompt);
          return r.trim().toUpperCase() === "LIST";
        })(query);
      } catch (err) {
        console.warn("Query classification failed; defaulting to SPECIFIC. Error:", err);
        return false;
      }
    })();

    console.log(`Query "${query}" classified as: ${isList ? "LIST" : "SPECIFIC"}`);

    if (isList) return await handleListQuery(res, query, pageNum, pageLimit);
    return await handleSpecificQuery(res, query);

  } catch (err) {
    console.error("Main handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
