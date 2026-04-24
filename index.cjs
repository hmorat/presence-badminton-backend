const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// 1. Configuration CORS pour autoriser ton frontend Vercel
app.use(cors());
app.use(express.json());

// 2. Configuration de la connexion Supabase
// Utilise la variable DATABASE_URL configurée sur Vercel
// Remplace toute la partie du pool par ceci :
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // <--- C'est cette ligne qui va lire le lien du Pooler
  ssl: {
    rejectUnauthorized: false
  }
});

// Test de connexion immédiat au démarrage
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Erreur de connexion à Supabase:', err.stack);
  }
  console.log('✅ Connecté à la base de données Supabase');
  release();
});

// --- ROUTES ---

// Route de test
app.get('/', (req, res) => {
  res.send('API Badminton OK');
});

// Charger les créneaux
app.get('/api/creneaux', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM creneaux ORDER BY jour ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    // On renvoie l'erreur précise pour comprendre le blocage
    res.status(500).json({ 
        error: "Détail technique de l'erreur", 
        message: err.message, 
        code: err.code 
    });
  }
});

// Charger les joueurs pour un créneau
app.get('/api/joueurs', async (req, res) => {
  const { creneau } = req.query;
  try {
    const result = await pool.query(
      'SELECT * FROM joueurs WHERE creneau_code = $1 ORDER BY nom ASC',
      [creneau]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors du chargement des joueurs" });
  }
});

// Charger les présences pour une séance donnée
app.get('/api/presences', async (req, res) => {
  const { creneau, date } = req.query;
  try {
    const result = await pool.query(
      'SELECT * FROM presences WHERE creneau_code = $1 AND date_seance = $2',
      [creneau, date]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors du chargement des présences" });
  }
});

// Enregistrer ou modifier une présence
app.post('/api/presence', async (req, res) => {
  const { licence, creneau_code, date_seance, present } = req.body;
  try {
    await pool.query(
      `INSERT INTO presences (licence, creneau_code, date_seance, present)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (licence, creneau_code, date_seance)
       DO UPDATE SET present = EXCLUDED.present`,
      [licence, creneau_code, date_seance, present]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de l'enregistrement" });
  }
});

// Route d'exportation Excel
app.get('/api/export/all', async (req, res) => {
  try {
    const query = `
      SELECT p.creneau_code, p.date_seance, p.licence, p.present, j.nom, j.prenom
      FROM presences p
      JOIN joueurs j ON p.licence = j.licence
      ORDER BY p.date_seance DESC, j.nom ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de l'exportation" });
  }
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});