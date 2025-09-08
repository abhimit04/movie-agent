// /pages/api/movieAgents.js
import { GoogleGenerativeAI } from "@google/generative-ai";


const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const TMDB_KEY = process.env.TMDB_API_KEY;
const OMDB_KEY = process.env.OMDB_API_KEY;

// ----------------- Utilities -----------------
function isWithinDays(dateStr, days) {
  if (!dateStr) return false;
  const today = new Date();
  const given = new Date(dateStr);
  const diff = (today - given) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}

function mapGenreIdsToNames(ids = []) {
  if (!global.tmdbGenres) return null;
  return ids.map(id => global.tmdbGenres[id]).filter(Boolean).join(", ");
}

// ----------------- TMDB Functions -----------------
async function getTmdbGenreMap() {
  if (global.tmdbGenres) return global.tmdbGenres;
  const url = `https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB_KEY}&language=en-IN`;
  const res = await fetch(url);
  const json = await res.json();
  global.tmdbGenres = {};
  (json.genres || []).forEach(g => (global.tmdbGenres[g.id] = g.name));
  return global.tmdbGenres;
}

async function fetchTMDBNowPlaying(page = 1) {
  const url = `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_KEY}&language=en-IN&region=IN&page=${page}`;
  const res = await fetch(url);
  return res.json();
}

async function fetchTMDBOnAir(page = 1) {
  const url = `https://api.themoviedb.org/3/tv/on_the_air?api_key=${TMDB_KEY}&language=en-IN&page=${page}`;
  const res = await fetch(url);
  return res.json();
}

async function fetchTMDBProviders(id, type = "movie") {
  const url = `https://api.themoviedb.org/3/${type}/${id}/watch/providers?api_key=${TMDB_KEY}`;
  const res = await fetch(url);
  const json = await res.json();
  const inProviders = json.results?.IN;
  if (!inProviders) return [];
  return [
    ...(inProviders.flatrate?.map(p => p.provider_name) || []),
    ...(inProviders.rent?.map(p => p.provider_name) || []),
    ...(inProviders.buy?.map(p => p.provider_name) || []),
  ];
}

// ----------------- OMDB Function -----------------
async function fetchOMDBDetails(title, year = "") {
  if (!OMDB_KEY) return null;
  const url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}${year ? `&y=${year}` : ""}&apikey=${OMDB_KEY}`;
  console.log("🔎 OMDB lookup:", url);
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.Response === "True") {
      return {
        genre: data.Genre || null,
        imdbRating: data.imdbRating !== "N/A" ? data.imdbRating : null,
        runtime: data.Runtime || null,
        platform: data.Type === "series" ? "OTT" : null,
      };
    }
  } catch (err) {
    console.error("OMDB fetch error:", err);
  }
  return null;
}

// ----------------- Gemini Wrapper -----------------
async function callGemini(prompt) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ----------------- Handlers -----------------
async function handleSpecificQuery(res, query) {
  console.log("🎯 Handling specific query:", query);
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=en-IN`;
  const tmdbRes = await fetch(url);
  const tmdbJson = await tmdbRes.json();
  const first = tmdbJson.results?.[0];

  if (!first) return res.json({ result: "No results found" });

  const year = first.release_date ? new Date(first.release_date).getFullYear() : "";
  const omdb = await fetchOMDBDetails(first.title, year);

  const summaryPrompt = `Summarize the movie/show "${first.title}" (overview: ${first.overview}). Include genre, release year, rating, and where it's available.`;
  const summary = await callGemini(summaryPrompt);

  return res.json({
    title: first.title,
    release_date: first.release_date,
    overview: first.overview,
    genre: omdb?.genre || mapGenreIdsToNames(first.genre_ids),
    rating: omdb?.imdbRating || first.vote_average,
    runtime: omdb?.runtime || null,
    platform: omdb?.platform || "Unknown",
    summary,
  });
}

async function handleListQuery(res, query, days = 10) {
  console.log("📋 Handling list query:", query);

  await getTmdbGenreMap();
  const lc = query.toLowerCase();
  let movies = [];
  let shows = [];

  if (lc.includes("latest") || lc.includes("weekly") || lc.includes("new release")) {
    console.log("🔎 Detected weekly/latest intent → fetching now_playing + on_the_air");

    // --- Movies ---
    const nowPage = await fetchTMDBNowPlaying(1);
    const nowMoviesRaw = nowPage.results || [];
    const recentMovies = nowMoviesRaw.filter(m =>
      m.release_date && isWithinDays(m.release_date, days)
    );

    for (const m of recentMovies) {
      try {
        const providers = await fetchTMDBProviders(m.id);
        const platform = providers.length ? `OTT (${providers.join(", ")})` : "Theaters";
        const year = m.release_date ? new Date(m.release_date).getFullYear() : "";
        const omdb = await fetchOMDBDetails(m.title, year);

        movies.push({
          type: "Movie",
          id: m.id,
          title: m.title,
          release_date: m.release_date,
          overview: m.overview,
          genre: omdb?.genre || mapGenreIdsToNames(m.genre_ids),
          rating: omdb?.imdbRating || (m.vote_average ? `${m.vote_average}/10 (TMDB)` : null),
          runtime: omdb?.runtime || null,
          platform: omdb?.platform || platform,
          providers,
          source: omdb ? "TMDB+OMDB" : "TMDB.now_playing",
        });
      } catch (err) {
        console.error("Error enriching movie", m.title, err);
      }
    }

    // --- TV Shows ---
    const onAirPage = await fetchTMDBOnAir(1);
    const onAirShowsRaw = onAirPage.results || [];
    const recentShows = onAirShowsRaw.filter(s =>
      s.first_air_date && isWithinDays(s.first_air_date, days)
    );

    for (const s of recentShows) {
      try {
        const providers = await fetchTMDBProviders(s.id, "tv");
        const platform = providers.length ? `OTT (${providers.join(", ")})` : "Theaters";
        shows.push({
          type: "TV Show",
          id: s.id,
          title: s.name,
          release_date: s.first_air_date,
          overview: s.overview,
          genre: mapGenreIdsToNames(s.genre_ids),
          rating: s.vote_average ? `${s.vote_average}/10 (TMDB)` : null,
          runtime: null,
          platform,
          providers,
          source: "TMDB.on_the_air",
        });
      } catch (err) {
        console.error("Error enriching show", s.name, err);
      }
    }

    return res.json([...movies, ...shows]);
  }

  console.log("Fallback → TMDB search only for:", query);
  const results = await searchAndEnrichMovies(query);
  return res.json(results);
}

async function searchAndEnrichMovies(query) {
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=en-IN`;
  const res = await fetch(url);
  const json = await res.json();
  const movies = json.results || [];

  const result = [];
  for (const m of movies) {
    try {
      const providers = await fetchTMDBProviders(m.id);
      const platform = providers.length ? `OTT (${providers.join(", ")})` : "Theaters";
      const year = m.release_date ? new Date(m.release_date).getFullYear() : "";
      const omdb = await fetchOMDBDetails(m.title, year);

      result.push({
        type: "Movie",
        id: m.id,
        title: m.title,
        release_date: m.release_date,
        overview: m.overview,
        genre: omdb?.genre || mapGenreIdsToNames(m.genre_ids),
        rating: omdb?.imdbRating || (m.vote_average ? `${m.vote_average}/10 (TMDB)` : null),
        runtime: omdb?.runtime || null,
        platform: omdb?.platform || platform,
        providers,
        source: omdb ? "TMDB+OMDB" : "TMDB.search",
      });
    } catch (err) {
      console.error("Error enriching movie", m.title, err);
    }
  }
  return result;
}

// ----------------- API Handler -----------------
export default async function handler(req, res) {
  try {
    const { query = "", page = 1, limit = 10 } = req.query;
    if (!query) return res.status(400).json({ error: "Missing query" });

    // Classify query: LIST or SPECIFIC
    const isList = await (async () => {
      try {
        const systemPrompt = `Classify if the user query is asking for multiple movies/shows (LIST) or one specific title (SPECIFIC).
Query: "${query}"
Reply with only LIST or SPECIFIC.`;
        const r = await callGemini(systemPrompt);
        return r.trim().toUpperCase() === "LIST";
      } catch (err) {
        console.warn("Classification failed, default SPECIFIC. Error:", err);
        return false;
      }
    })();

    console.log(`Query "${query}" classified as: ${isList ? "LIST" : "SPECIFIC"}`);
    if (isList) return await handleListQuery(res, query, 10);
    return await handleSpecificQuery(res, query);
  } catch (err) {
    console.error("Main handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
