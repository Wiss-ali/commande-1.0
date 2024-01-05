<?php
session_start();
if (!isset($_SESSION["username"])) {
    header("Location: connexion.php");
    exit();
}

// Définissez les informations de connexion à la base de données
$serveur = "127.0.0.1:3306";
$nom_utilisateur = "u559440517__wiss";
$mot_de_passe = "Themigi69-";
$nom_base_de_donnees = "u559440517_wissem";

// Connexion à la base de données
$mysqli = new mysqli($serveur, $nom_utilisateur, $mot_de_passe, $nom_base_de_donnees);

if ($mysqli->connect_error) {
    die("Erreur de connexion à la base de données: " . $mysqli->connect_error);
}

// Récupérez la liste des projets depuis votre base de données
// Remplacez 'votre_table_projets' par le nom de votre table de projets
$query = "SELECT * FROM votre_table_projets";
$result = $mysqli->query($query);

if (!$result) {
    die("Erreur lors de la récupération des projets: " . $mysqli->error);
}

$projets = [];

while ($row = $result->fetch_assoc()) {
    $projets[] = [$row["nom"], $row["prenom"], $row["termine"], $row["date_demande"], $row["demande"], $row["date_livraison"]];
}

$mysqli->close();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page d'Accueil</title>
</head>
<body>

<h2>Bienvenue, <?php echo $_SESSION["username"]; ?>!</h2>

<!-- Affichez la liste des projets -->
<?php
// Nombre de projets par page
$projets_par_page = 15;

// Récupérez le numéro de page à partir de l'URL
if (isset($_GET["page"])) {
    $page_actuelle = $_GET["page"];
} else {
    $page_actuelle = 1; // Page par défaut
}

// Calculez l'indice de début pour la pagination
$indice_debut = ($page_actuelle - 1) * $projets_par_page;
$indice_fin = $indice_debut + $projets_par_page;

echo "<h3>Liste des Projets (Page $page_actuelle)</h3>";
echo "<ul>";

for ($i = $indice_debut; $i < min($indice_fin, count($projets)); $i++) {
    $projet = $projets[$i];
    echo "<li>";
    // Affichez ici les détails du projet comme le nom, la date de demande, la demande du client, la date de livraison prévue, etc.
    echo "<strong>Nom du Client:</strong> " . $projet[0] . "<br>";
    echo "<strong>Prénom du Client:</strong> " . $projet[1] . "<br>";
    echo "<strong>Terminé:</strong> " . ($projet[2] ? "Oui" : "Non") . "<br>";
    echo "<strong>Date de Demande:</strong> " . $projet[3] . "<br>";
    echo "<strong>Demande du Client:</strong> " . $projet[4] . "<br>";
    echo "<strong>Date de Livraison Prévue:</strong> " . $projet[5] . "<br>";
    echo "</li>";
}

echo "</ul>";

// Affichez les liens de pagination pour les autres pages
$nombre_de_pages = ceil(count($projets) / $projets_par_page);
echo "<div>";
for ($page = 1; $page <= $nombre_de_pages; $page++) {
    echo "<a href='page_accueil.php?page=$page'>$page</a> ";
}
echo "</div>";
?>

<!-- Lien pour ajouter un nouveau projet -->
<a href="page_saisie_donnees.php">Ajouter un Nouveau Projet</a>

</body>
</html>
