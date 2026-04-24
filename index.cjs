const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// 1. Configuration de la connexion (Utilise les variables d'environnement)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Indispensable pour Supabase/Render
  }
});

// 2. Middlewares
app.use(cors());
app.use(express.json());

// 3. Route pour récupérer la liste des créneaux (Dropdown)
app.get('/api/creneaux', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM creneaux ORDER BY jour, horaire');
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur /api/creneaux:", err.message);
    res.status(500).json({ error: "Erreur lors de la récupération des créneaux" });
  }
});

// 4. Route pour récupérer les séances/joueurs (Avec la JOINTURE)
// C'est ici qu'on fait le lien entre 'seances' et 'creneaux'
app.get('/api/joueurs', async (req, res) => {
  try {
    const { creneau } = req.query; // Récupère le code envoyé par le frontend (ex: PE41:1)

    if (!creneau) {
      return res.status(400).json({ error: "Le paramètre creneau est requis" });
    }

    // Requête SQL corrigée : 
    // On sélectionne tout dans 'seances' (s.*)
    // Mais on vérifie que le 'creneau_code' dans la table 'creneaux' (c) correspond
    const query = `
      SELECT s.* FROM seances s
      JOIN creneaux c ON s.creneau_id = c.id
      WHERE c.creneau_code = $1
    `;

    const result = await pool.query(query, [creneau]);
    
    // On renvoie toujours un tableau (même vide) pour éviter le plantage .map
    res.json(result.rows || []);
    
  } catch (err) {
    console.error("Erreur /api/joueurs:", err.message);
    res.status(500).json({ error: "Erreur technique", message: err.message });
  }
});

// 5. Test de connexion simple
app.get('/', (req, res) => {
  res.send('Backend Presence Badminton opérationnel !');
});

app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
});