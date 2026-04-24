const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());

// 1. MENU CRÉNEAUX : Trié par code (A, B, C...)
app.get('/api/creneaux', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM creneaux ORDER BY creneau_code ASC`);
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur créneaux:", err.message);
    res.status(500).json([]);
  }
});

// 2. LISTE DES JOUEURS : Fusion entre Inscrits et Présences
app.get('/api/joueurs', async (req, res) => {
  try {
    const { creneau, date } = req.query;
    if (!creneau || !date) return res.json([]);

    // On extrait le code court (ex: "F11") au cas où le front envoie "F11 : LUNDI"
    const codeCourt = creneau.split(' ')[0].trim();

    const query = `
      SELECT 
        j.nom, 
        j.prenom, 
        j.licence,
        COALESCE(s.presence, false) as presence
      FROM joueurs_creneaux jc
      JOIN joueurs j ON jc.licence = j.licence
      LEFT JOIN seances s ON (
        s.licence = j.licence 
        AND s.date_seance = $2 
        AND s.creneau_code = $1
      )
      WHERE jc.creneau_code = $1
      ORDER BY j.nom ASC, j.prenom ASC
    `;

    const result = await pool.query(query, [codeCourt, date]);
    console.log(`[LOG] ${codeCourt} à la date ${date} : ${result.rowCount} joueurs trouvés`);
    res.json(result.rows);

  } catch (err) {
    console.error("Erreur SQL Joueurs:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 3. SAUVEGARDE DES PRÉSENCES
app.post('/api/presences', async (req, res) => {
  const { creneau, date, joueurs } = req.body;
  if (!creneau || !date || !joueurs) return res.status(400).json({ error: "Données manquantes" });
  
  const codeCourt = creneau.split(' ')[0].trim();

  try {
    for (const j of joueurs) {
      await pool.query(`
        INSERT INTO seances (licence, creneau_code, date_seance, presence, nom, prenom)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (licence, date_seance, creneau_code) 
        DO UPDATE SET presence = EXCLUDED.presence
      `, [j.licence, codeCourt, date, j.presence, j.nom, j.prenom]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Erreur Save:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => console.log(`Serveur prêt sur le port ${port}`));