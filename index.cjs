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

// 1. CRÉNEAUX : Tri alphabétique sur le code (ex: A, B, C...)
app.get('/api/creneaux', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM creneaux 
      ORDER BY creneau_code ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json([]);
  }
});

// 2. JOUEURS : On récupère via la table de liaison
app.get('/api/joueurs', async (req, res) => {
  try {
    const { creneau, date } = req.query;
    if (!creneau || !date) return res.json([]);

    // On utilise ILIKE pour être moins strict sur les majuscules/minuscules
    // On garde INNER JOIN car la licence est censée être identique
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
      WHERE jc.creneau_code ILIKE $1
      ORDER BY j.nom ASC, j.prenom ASC
    `;

    const result = await pool.query(query, [creneau, date]);
    console.log(`Recherche ${creneau} : ${result.rowCount} joueurs trouvés`);
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur SQL:", err.message);
    res.json([]);
  }
});

// 3. SAUVEGARDE (POST)
app.post('/api/presences', async (req, res) => {
  const { creneau, date, joueurs } = req.body;
  try {
    for (const j of joueurs) {
      await pool.query(`
        INSERT INTO seances (licence, creneau_code, date_seance, presence, nom, prenom)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (licence, date_seance, creneau_code) 
        DO UPDATE SET presence = EXCLUDED.presence
      `, [j.licence, creneau, date, j.presence, j.nom, j.prenom]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => console.log(`Backend Badminton sur port ${port}`));