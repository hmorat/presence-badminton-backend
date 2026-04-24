app.get('/api/joueurs', async (req, res) => {
  try {
    const { creneau } = req.query; // ex: PE41:1

    if (!creneau) return res.json([]);

    // Puisque creneau_code est maintenant la clé, on cherche directement
    // dans la table qui lie les joueurs aux créneaux (ex: seances ou joueurs_creneaux)
    const query = `
      SELECT * FROM seances 
      WHERE creneau_code = $1 
      ORDER BY entraineur ASC
    `;

    const result = await pool.query(query, [creneau]);
    res.json(result.rows || []);
    
  } catch (err) {
    console.error(err.message);
    res.json([]); // Anti-écran blanc
  }
});