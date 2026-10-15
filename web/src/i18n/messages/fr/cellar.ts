export default {
  cellar: {
    list: {
      title: 'Cave',
      count: '{count} vin en cave | {count} vins en cave',
      add: 'Ajouter un vin',
      loading: 'Chargement de votre cave…',
      loadError: 'Impossible de charger votre cave : {error}',
      empty: 'Aucun vin ne correspond à ces filtres.',
      unknownAppellation: 'Appellation inconnue',
      noMillesime: 'SA',
      columns: { quantity: 'Qté', status: 'Statut' },
    },
    filters: {
      title: 'Filtres',
      titleWithCount: 'Filtres ({count})',
      close: 'Fermer les filtres',
      anyMeal: 'Tous les plats',
      anyAppellation: 'Toutes les appellations',
      color: 'Couleur',
      anyColor: 'Toutes les couleurs',
      readyNow: 'À boire maintenant',
      clear: 'Effacer les filtres',
    },
    sort: {
      title: 'Trier',
      close: 'Fermer le tri',
      ascending: '↑ Croissant',
      descending: '↓ Décroissant',
      status: 'Statut',
    },
    firstVisit: {
      message: "Votre cave a besoin d'une première visite connectée avant de pouvoir s'afficher hors ligne. Connectez-vous une fois pour la télécharger.",
      link: 'Ouvrir la page de synchronisation',
    },
    pagination: {
      label: 'Pages de la cave',
      previous: 'Précédent',
      next: 'Suivant',
      status: 'Page {page} sur {pageCount}',
    },
  },
}
