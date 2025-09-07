// /pages/api/movieAgents.js
import { GoogleGenerativeAI } from "@google/generative-ai";

// Helper function to call the Tavily API
async function callTavilyAPI(query) {
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
  if (!TAVILY_API_KEY) {
    throw new Error("Missing Tavily API key");
  }

  const response = await fetch("https://api.tavily.com/v1/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query: query,
      search_depth: "basic",
      include_answer: true,
      include_images: false,
      max_results: 5,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily API failed with status: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

// Helper function to call the SerpAPI
async function callSerpAPI(query) {
  const SERPAPI_KEY = process.env.SERPAPI_KEY;
  if (!SERPAPI_KEY) {
    throw new Error("Missing SerpAPI key");
  }

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.append("engine", "google");
  url.searchParams.append("q", query);
  url.searchParams.append("api_key", SERPAPI_KEY);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`SerpAPI failed with status: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

// Helper function to call the Gemini API for summarization/classification
async function callGemini(prompt, systemPrompt) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error("Missing Gemini API key");
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const result = await model.generateContent({
    contents: [{
      role: "user",
      parts: [{ text: systemPrompt + prompt }]
    }],
  });
  const response = await result.response;
  return response.text();
}

// New classification logic using Gemini
async function classifyQuery(query) {
  const systemPrompt = `Is this query asking for multiple items/recommendations (LIST) or info about one specific movie/show (SPECIFIC)?

  Query: "${query}"

  Reply with just one word: LIST or SPECIFIC`;

  const result = await callGemini(systemPrompt, '');
  return result.trim().toUpperCase() === "LIST";
}

// Handle weekly releases using Tavily and Gemini
async function handleWeeklyReleases(res) {
  console.log("Fetching weekly releases");
  try {
    const searchResult = await callTavilyAPI("new movie and OTT releases this week in India");
    const searchContent = searchResult.results.map(r => r.content).join("\n\n");

    const geminiPrompt = `Summarize the following search results into a JSON array of movie/show releases.

      Search Results:
      ${searchContent}

      Return ONLY valid JSON with this format (no other text):
      {
        "releases": [
          {
            "title": "Movie/Show Title",
            "type": "movie" or "tv",
            "platform": "Netflix/Prime/Theaters/etc",
            "release_date": "Date or Year",
            "genre": "Genre"
          }
        ]
      }`;

    const geminiResponse = await callGemini(geminiPrompt, '');
    const parsedData = JSON.parse(geminiResponse.replace(/```json\s*|```/g, "").trim());
    return res.status(200).json(parsedData);
  } catch (error) {
    console.error("Weekly releases error:", error);
    return res.status(200).json({
      releases: [],
      search_hints: {
        found_results: false,
        suggestions: ["Unable to fetch this week's releases. Please try again later."]
      }
    });
  }
}

// Handle list queries using Tavily and Gemini
async function handleListQuery(res, query) {
  console.log(`Processing list query: "${query}"`);
  try {
    const searchResult = await callTavilyAPI(query);
    const searchContent = searchResult.results.map(r => r.content).join("\n\n");

    const geminiPrompt = `Summarize the following search results into a JSON array of movie/show releases.

    Search Results:
    ${searchContent}

    Return ONLY valid JSON with this format (no other text):
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

    const geminiResponse = await callGemini(geminiPrompt, '');
    const parsedData = JSON.parse(geminiResponse.replace(/```json\s*|```/g, "").trim());

    if (parsedData.releases && parsedData.releases.length > 0) {
      return res.status(200).json(parsedData);
    } else {
      throw new Error("No list data received");
    }
  } catch (error) {
    console.error("List query error:", error);
    return res.status(200).json({
      releases: [],
      search_hints: {
        found_results: false,
        suggestions: [
          "No results found. Try a different query.",
          "Example searches: 'Netflix movies', 'top 10 shows'"
        ]
      }
    });
  }
}

// Handle specific queries using SerpAPI and Gemini
async function handleSpecificQuery(res, query) {
  console.log(`Processing specific query: "${query}"`);
  try {
    const serpResult = await callSerpAPI(query);
    const knowledgeGraph = serpResult.knowledge_graph;
    const relatedSearches = serpResult.related_searches?.map(s => s.query) || [];

    if (!knowledgeGraph || !knowledgeGraph.title) {
      return res.status(200).json({
        movies: [],
        search_hints: {
          found_results: false,
          suggestions: generateSpecificHints(query, "movie")
        }
      });
    }

    // Get a detailed summary from Gemini
    const geminiSummaryPrompt = `Based on the following search result data, provide a comprehensive summary and review.

      Search Result Data:
      Title: ${knowledgeGraph.title}
      Description: ${knowledgeGraph.description}
      Release Date: ${knowledgeGraph.start_date || knowledgeGraph.year}
      Genres: ${knowledgeGraph.genres?.join(', ') || 'N/A'}
      Cast: ${knowledgeGraph.cast?.map(c => c.name).join(', ') || 'N/A'}
      Director: ${knowledgeGraph.director?.join(', ') || 'N/A'}
      Platforms: ${knowledgeGraph.streaming_platforms?.map(p => p.name).join(', ') || 'N/A'}
      Rating: ${serpResult.organic_results?.find(r => r.source?.toLowerCase().includes('imdb'))?.snippet || knowledgeGraph.rating}

      Write a detailed review summary of the movie "${knowledgeGraph.title}". Focus on the plot, performances, and audience reception. Use markdown for formatting.`;

    const reviewSummary = await callGemini(geminiSummaryPrompt, '');

    const result = {
      title: knowledgeGraph.title,
      description: knowledgeGraph.description,
      release_date: knowledgeGraph.start_date || knowledgeGraph.year,
      genre: knowledgeGraph.genres?.join(', ') || null,
      cast: knowledgeGraph.cast?.map(c => c.name).join(', ') || null,
      director: knowledgeGraph.director?.join(', ') || null,
      platform: knowledgeGraph.streaming_platforms?.map(p => p.name).join(', ') || null,
      rating: knowledgeGraph.rating,
      reviews_summary: reviewSummary,
      type: "movie",
      search_hints: {
        found_match: true,
        confidence: "high",
        suggestions: relatedSearches
      }
    };

    return res.status(200).json({ movies: [result] });
  } catch (error) {
    console.error("Specific query error:", error);
    return res.status(200).json({
      movies: [],
      search_hints: {
        found_results: false,
        suggestions: generateSpecificHints(query, "movie")
      }
    });
  }
}

// Main handler function
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { query, type = "movie", weekly } = req.query;

  console.log(`=== MovieAgent Request ===`);
  console.log(`Query: "${query}", Type: ${type}, Weekly: ${weekly}`);

  try {
    if (weekly === "true") {
      return await handleWeeklyReleases(res);
    }

    if (!query || !query.trim()) {
      return res.status(400).json({
        error: "Query parameter is required",
        search_hints: {
          found_results: false,
          suggestions: ["Add a search query like 'Netflix shows' or 'Stree 2'"]
        }
      });
    }

    const isListQuery = await classifyQuery(query);
    console.log(`Query "${query}" classified as: ${isListQuery ? 'LIST' : 'SPECIFIC'}`);

    if (isListQuery) {
      return await handleListQuery(res, query);
    } else {
      return await handleSpecificQuery(res, query);
    }

  } catch (error) {
    console.error("MovieAgent Main Error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error.message,
      search_hints: {
        found_results: false,
        suggestions: ["Something went wrong - please try again"]
      }
    });
  }
}

function generateSpecificHints(query, type) {
  const hints = [];
  const q = query.toLowerCase().trim();

  if (q.length < 3) {
    hints.push("Search term too short - try the full movie/show name");
  } else if (['movie', 'show', 'series'].includes(q)) {
    hints.push("Search term too generic - try a specific title");
  } else {
    hints.push("Check spelling of the movie/show name");
    hints.push(`Try adding the year if it's a recent ${type}`);
    hints.push("Make sure you have the correct title");
  }
  return hints;
}