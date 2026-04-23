// Dans ton fichier backend/routes/creneaux.js
router.get('/', async (req, res) => {
  try {
    // On demande TOUTES les colonnes avec l'astérisque * // ou on les liste précisément en respectant les majuscules de ta base
    const { data, error } = await supabase
      .from('creneaux')
      .select('creneau_code, Jour, Horaire, Gymnase, Entraineur'); 

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});