const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting simple (en mémoire)
const rateLimits = new Map();
const RATE_LIMIT = 20;
const RATE_WINDOW = 3600000;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Route de test
app.get('/', (req, res) => {
  res.json({ message: 'Backend Inspiration App fonctionne !' });
});

// Route de génération
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, language } = req.body;
    const clientIp = req.ip;

    // Vérifier le rate limit
    const now = Date.now();
    const userLimits = rateLimits.get(clientIp) || { count: 0, resetTime: now + RATE_WINDOW };

    if (now > userLimits.resetTime) {
      userLimits.count = 0;
      userLimits.resetTime = now + RATE_WINDOW;
    }

    if (userLimits.count >= RATE_LIMIT) {
      return res.status(429).json({ 
        error: 'Limite atteinte. Réessayez dans une heure.' 
      });
    }

    userLimits.count++;
    rateLimits.set(clientIp, userLimits);

    // Instructions de langue pour Claude
    const languageInstructions = {
      fr: "Réponds en français.",
      pt: "Responde em português.",
      de: "Antworte auf Deutsch."
    };

    const fullPrompt = `${languageInstructions[language] || languageInstructions.fr} ${prompt}`;

    // Appel à l'API Anthropic
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        { role: 'user', content: fullPrompt }
      ],
    });

    const generatedContent = message.content[0].text.trim();
    
    res.json({ 
      content: generatedContent,
      remainingRequests: RATE_LIMIT - userLimits.count
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: 'Erreur lors de la génération' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});