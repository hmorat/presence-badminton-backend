const express = require('express');
const router = express.Router();
const supabase = require('../db'); // Connexion à ta base Supabase

router.get('/', async (req, res) => {
  try {
    // CRUCIAL : On utilise '*' pour dire à Supabase de TOUT envoyer 
    // (incluant Gymnase et Entraineur)
    const { data, error } = await supabase
      .from('creneaux')
      .select('*'); 

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Erreur serveur :", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;