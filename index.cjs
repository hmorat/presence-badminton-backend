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

/**
 * 1. RÉCUPÉRER LES CRÉNEAUX (Trié par Nom de créneau)
 */
app.get('/api/creneaux', async (req, res) => {
  try {
    // Tri alphabétique simple sur le code du créneau (ex: F11, PE41...)
    const result = await pool.query(`
      SELECT * FROM creneaux 
      ORDER BY creneau_code ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur /api/creneaux:", err.message);
    res.status(500).json([]);
  }
});

/**
 * 2. RÉCUPÉRER LES JOUEURS (Via table de liaison joueurs_creneaux)
 */
app.get('/api/joueurs', async (req, res) => {
  try {
    const { creneau, date } = req.query;
    if (!creneau || !date) return res.json([]);

    // Note : On utilise LEFT JOIN pour s'assurer que si un joueur est dans 
    // joueurs_creneaux, il apparaît même s'il n'a pas encore de ligne dans seances.
    const query = `
      SELECT 
        j.nom, 
        j.prenom, 
        j.licence,
        COALESCE(s.presence, false) as presence
      FROM joueurs_creneaux jc
      INNER JOIN joueurs j ON jc.licence = j.licence
      LEFT JOIN seances s ON (
        s.licence = j.licence 
        AND s.date_seance = $2 
        AND s.creneau_code = $1
      )
      WHERE jc.creneau_code = $1
      ORDER BY j.nom ASC, j.prenom ASC
    `;

    const result = await pool.query(query, [creneau, date]);
    
    // Log crucial pour voir ce qui remonte dans Render
    console.log(`[DEBUG] Créneau: ${creneau}, Date: ${date} -> ${result.rowCount} joueurs trouvés`);
    
    res.json(result.rows);
  } catch (err) {
    console.error("ERREUR SQL JOUEURS:", err.message);
    res.json([]);
  }
});

/**
 * 3. ENREGISTRER LES PRÉSENCES
 */
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
    console.error("Erreur POST:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => res.send("Backend Badminton OK"));

app.listen(port, () => console.log(`Serveur sur port ${port}`));