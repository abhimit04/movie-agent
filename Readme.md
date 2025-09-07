# 🎬 AI Movie & OTT Agent

This project is a **Next.js API-powered movie/OTT search assistant**.  
It integrates with the **Perplexity AI API** to fetch structured entertainment data such as:

- 📅 **Weekly releases** (theaters + OTT platforms in India)
- 📺 **List queries** (e.g., “top Netflix movies this month”, “best comedy movies of 2025”)
- 🎞️ **Specific movie/show details** with **summarized reviews**

The project consists of:
- `pages/api/movieAgents.js` → API route logic
- `pages/index.js` → Simple UI to test queries

---

## 🚀 Features

- **Weekly releases** → List of movies/OTT shows releasing this week in India
- **List queries** → Top trending/recommended movies/shows across platforms
- **Specific queries** → Detailed info (plot, cast, director, platform, rating) + **AI review summary**
- **Robust JSON parsing** → Handles malformed AI responses gracefully
- **Environment-based config** → Secure Perplexity API key usage

---

## 🛠️ Tech Stack

- **Next.js** (API routes + React frontend)
- **Perplexity AI API (`sonar-pro` model)**
- **Node.js / Vercel runtime**

---

## ⚙️ Setup

1. **Clone repo**
   ```bash
   git clone https://github.com/your-username/ai-movie-agent.git
   cd ai-movie-agent
    ```
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Set environment variable**
   - Create a `.env.local` file in the root
   - Add your Perplexity API key:
     ```
     PERPLEXITY_API_KEY=your_perplexity_api_key
     ``` 
          
4. **Run development server**
    ```bash
    npm run dev
    ```
5. **Open in browser**
    - Navigate to `http://localhost:3000`
    - Test queries in the input box           
    - API endpoint: `http://localhost:3000/api/movieAgents?query=your_query`
    - Examples:
      - `weekly releases`
      - `top Netflix movies this month`
      - `best comedy movies of 2025`

6. **Deploy**
   - Push to GitHub and deploy on Vercel for easy hosting
     - Ensure environment variables are set in Vercel dashboard
     - Vercel will handle building and running the Next.js app
     - API endpoint will be live at `https://your-vercel-app.vercel.app/api/movieAgents`
     - Frontend UI at `https://your-vercel-app.vercel.app`

7. **Usage**
   - Use the frontend UI to test various movie/OTT queries
   - Or call the API endpoint directly from your applications
   - Integrate with other services or build a chatbot interface using this API

---## 📄 License
This project is licensed under the MIT License. 

Feel free to use and contribute or raise issues! 
