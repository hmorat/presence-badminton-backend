const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configuration de la connexion à Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());

// --- 1. RÉCUPÉRER LES CRÉNEAUX ---
app.get('/api/creneaux', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM creneaux ORDER BY creneau_code ASC');
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur creneaux:", err.message);
    res.status(500).json([]);
  }
});

// --- 2. RÉCUPÉRER LES JOUEURS ET LEURS PRÉSENCES (POUR UNE DATE DONNÉE) ---
app.get('/api/joueurs', async (req, res) => {
  try {
    const { creneau, date } = req.query;
    if (!creneau || !date) return res.status(400).json({ error: "Paramètres manquants" });

    // Cette requête récupère tous les inscrits au créneau
    // ET leur état de présence si une ligne existe dans la table 'presences'
    const query = `
      SELECT 
        j.nom, 
        j.prenom, 
        jc.licence,
        COALESCE(p.present, false) AS present
      FROM joueurs_creneaux jc
      JOIN joueurs j ON jc.licence = j.licence
      LEFT JOIN presences p ON (
        p.licence = jc.licence 
        AND p.date_seance = $2 
        AND p.creneau_code = $1
      )
      WHERE jc.creneau_code = $1
      ORDER BY j.nom ASC
    `;

    const result = await pool.query(query, [creneau, date]);
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur joueurs:", err.message);
    res.status(500).json([]);
  }
});

// --- 3. ENREGISTRER LES PRÉSENCES (POST) ---
app.post('/api/presences', async (req, res) => {
  const { creneau, date, joueurs } = req.body;

  try {
    // On utilise une transaction pour être sûr que tout est enregistré
    for (const j of joueurs) {
      await pool.query(`
        INSERT INTO presences (licence, creneau_code, date_seance, present)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (licence, date_seance, creneau_code) 
        DO UPDATE SET present = EXCLUDED.present
      `, [j.licence, creneau, date, j.present]);
    }
    res.json({ success: true, message: "Présences mises à jour" });
  } catch (err) {
    console.error("Erreur enregistrement:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 4. EXPORT GLOBAL (HISTORIQUE COMPLET) ---
app.get('/api/export-global', async (req, res) => {
  try {
    const query = `
      SELECT 
        p.creneau_code, 
        p.date_seance, 
        j.nom, 
        j.prenom, 
        p.present
      FROM presences p
      JOIN joueurs j ON p.licence = j.licence
      ORDER BY p.date_seance DESC, p.creneau_code ASC, j.nom ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur export global:", err.message);
    res.status(500).json({ error: "Impossible de récupérer l'historique" });
  }
});

// --- DÉMARRAGE DU SERVEUR ---
app.listen(port, () => {
  console.log(`Serveur backend actif sur le port ${port}`);
});