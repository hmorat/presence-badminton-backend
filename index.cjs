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

/**
 * 1. RÉCUPÉRER LES CRÉNEAUX
 * Utilisé pour remplir le premier menu déroulant
 */
app.get('/api/creneaux', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM creneaux 
      ORDER BY 
        CASE 
          WHEN jour = 'LUNDI' THEN 1 WHEN jour = 'MARDI' THEN 2
          WHEN jour = 'MERCREDI' THEN 3 WHEN jour = 'JEUDI' THEN 4
          WHEN jour = 'VENDREDI' THEN 5 WHEN jour = 'SAMEDI' THEN 6
          WHEN jour = 'DIMANCHE' THEN 7
        END ASC, 
        creneau_code ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur /api/creneaux:", err.message);
    res.status(500).json([]);
  }
});

/**
 * 2. RÉCUPÉRER LES JOUEURS ET LEURS PRÉSENCES
 * Logique : On prend TOUS les joueurs du créneau et on cherche 
 * s'ils ont un statut dans la table 'seances' pour cette date.
 */
app.get('/api/joueurs', async (req, res) => {
  try {
    const { creneau, date } = req.query; 

    if (!creneau || !date) {
      return res.json([]);
    }

    // Requête pour fusionner la liste théorique et les présences réelles
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

    const result = await pool.query(query, [creneau, date]);
    res.json(result.rows);
    
  } catch (err) {
    console.error("Erreur /api/joueurs:", err.message);
    res.json([]);
  }
});

/**
 * 3. ENREGISTRER LES PRÉSENCES (UPSERT)
 * Cette route permet de sauvegarder ou modifier une séance
 */
app.post('/api/presences', async (req, res) => {
  const { creneau, date, joueurs } = req.body; 

  try {
    // On utilise une transaction pour tout enregistrer d'un coup
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const joueur of joueurs) {
        const upsertQuery = `
          INSERT INTO seances (licence, creneau_code, date_seance, presence, nom, prenom)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (licence, date_seance, creneau_code) 
          DO UPDATE SET presence = EXCLUDED.presence
        `;
        await client.query(upsertQuery, [
          joueur.licence, 
          creneau, 
          date, 
          joueur.presence,
          joueur.nom,
          joueur.prenom
        ]);
      }
      
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Erreur enregistrement:", err.message);
    res.status(500).json({ error: "Erreur lors de la sauvegarde" });
  }
});

app.get('/', (req, res) => res.send("Backend Presence Badminton Opérationnel"));

app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
});