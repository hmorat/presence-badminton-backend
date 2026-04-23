const express = require('express');
const router = express.Router();
const supabase = require('../db');

router.get('/', async (req, res) => {
  try {
    // On utilise l'astérisque '*' pour récupérer TOUTES les colonnes de Supabase
    const { data, error } = await supabase
      .from('creneaux')
      .select('*'); 

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;