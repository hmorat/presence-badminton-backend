const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test de connexion à la base au démarrage
pool.query('SELECT NOW()', (err) => {
  if (err) console.error("❌ Erreur de connexion DB:", err.message);
  else console.log("✅ Connexion à PostgreSQL réussie");
});

app.get('/api/creneaux', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM creneaux ORDER BY LENGTH(creneau_code), creneau_code ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/joueurs', async (req, res) => {
  const { creneau, date } = req.query;
  try {
    const result = await pool.query(`
      SELECT 
        j.licence, 
        j.nom, 
        j.prenom,
        -- On force le résultat de la présence en TEXT pour éviter le conflit
        COALESCE(p.present::TEXT, 'ABSENT') as present
      FROM joueurs_creneaux jc
      LEFT JOIN joueurs j ON TRIM(j.licence::TEXT) = TRIM(jc.licence::TEXT)
      LEFT JOIN presences p ON TRIM(p.licence::TEXT) = TRIM(j.licence::TEXT) AND p.date_seance = $2
      WHERE jc.creneau_code = $1
      ORDER BY j.nom ASC
    `, [creneau, date]);
    
    console.log(`✅ ${result.rows.length} joueurs envoyés pour ${creneau}`);
    res.json(result.rows);
  } catch (err) { 
    console.error("❌ ERREUR SQL JOUEURS :", err.message);
    res.status(500).json([]); 
  }
});

// SAUVEGARDE AMÉLIORÉE (C'est ici que ça bloquait probablement)
app.post('/api/presences', async (req, res) => {
  const { date, joueurs, creneau } = req.body;
  try {
    for (const j of joueurs) {
      await pool.query(`
        INSERT INTO presences (licence, date_seance, creneau_code, present)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (licence, date_seance) 
        DO UPDATE SET 
          present = EXCLUDED.present,
          creneau_code = EXCLUDED.creneau_code,
          updated_at = NOW()
      `, [j.licence, date, creneau, j.present]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error("❌ ERREUR DB ENREGISTREMENT :", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export-global', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        TO_CHAR(p.date_seance, 'DD/MM/YYYY') as "Date",
        p.creneau_code as "Créneau",
        j.nom as "Nom",
        j.prenom as "Prénom",
        p.present as "Statut" -- On prend directement la valeur texte
      FROM presences p
      JOIN joueurs j ON j.licence = p.licence
      ORDER BY p.date_seance DESC, p.creneau_code ASC, j.nom ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Serveur prêt sur port ${PORT}`));