<?php
session_start();
if (!isset($_SESSION["nom_utilisateur"])) {
    header("Location: connexion.php");
    exit();
}

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Définissez les informations de connexion à la base de données
$serveur = "127.0.0.1:3306";
$nom_utilisateur = "u559440517_wissem";
$mot_de_passe = "Wisshafa69-";
$nom_base_de_donnees = "u559440517_wedevcommandes";

// Connexion à la base de données
$mysqli = new mysqli($serveur, $nom_utilisateur, $mot_de_passe, $nom_base_de_donnees);
if ($mysqli->connect_error) {
    die("Erreur de connexion à la base de données: " . $mysqli->connect_error);
}

// Traiter la soumission du formulaire
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST["id_projet"])) {
    $id_projet = $mysqli->real_escape_string($_POST["id_projet"]);
    $termine = isset($_POST["termine"]) ? 1 : 0;

    $update_query = "UPDATE projets SET termine = '$termine' WHERE id = '$id_projet'";
    if (!$mysqli->query($update_query)) {
        die("Erreur lors de la mise à jour du projet: " . $mysqli->error);
    }
}

// Récupérez la liste des projets depuis votre base de données, triés par id de façon décroissante
$query = "SELECT * FROM projets ORDER BY id DESC";
$result = $mysqli->query($query);
if (!$result) {
    die("Erreur lors de la récupération des projets: " . $mysqli->error);
}

$projets = [];
while ($row = $result->fetch_assoc()) {
    $projets[] = $row;
}

$mysqli->close();

// Pagination
$projets_par_page = 15;
$page_actuelle = isset($_GET["page"]) ? (int)$_GET["page"] : 1;
$indice_debut = ($page_actuelle - 1) * $projets_par_page;
$indice_fin = $indice_debut + $projets_par_page;
$nombre_de_pages = ceil(count($projets) / $projets_par_page);
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page d'Accueil</title>
</head>
<body>

<h2>Commandes de <?php echo htmlspecialchars($_SESSION["nom_utilisateur"]); ?>!</h2>

<h3>Liste des Projets (Page <?php echo $page_actuelle; ?>)</h3>
<ul>
    <?php
    for ($i = $indice_debut; $i < min($indice_fin, count($projets)); $i++) {
        $projet = $projets[$i];

    /*on doit enlever les echo pour transformer en html en referment la baluse plus tot juste au decus*/

        echo "<li>";
        echo "<strong>ID du Projet:</strong> " .  htmlspecialchars($projet["id"])  . "<br>";
        echo "<strong>Nom du Client:</strong> " . htmlspecialchars($projet["nom"]) . "<br>";
        echo "<strong>Prénom du Client:</strong> " . htmlspecialchars($projet["prenom"]) . "<br>";
        echo "<strong>Terminé:</strong> " . ($projet["termine"] ? "Oui" : "Non") . "<br>";
        echo "<strong>Date de Demande:</strong> " . htmlspecialchars($projet["date_demande"]) . "<br>";
        echo "<strong>Demande du Client:</strong> " . htmlspecialchars($projet["demande"]) . "<br>";
        echo "<strong>Date de Livraison Prévue:</strong> " . htmlspecialchars($projet["date_livraison"]) . "<br>";

        echo "<form method='post' action=''>";
        echo "<input type='hidden' name='id_projet' value='" . htmlspecialchars($projet["id"]) . "'>";
        echo "<input type='checkbox' name='termine' value='1'" . ($projet["termine"] ? " checked" : "") . "> Marquer comme terminé";
        echo "<input type='submit' value='Enregistrer'>";
        echo "</form>";

        echo "</li>";
    }
    ?>
</ul>

<div>
    <?php
    for ($page = 1; $page <= $nombre_de_pages; $page++) {
        echo "<a href='?page=$page'>$page</a> ";
    }
    ?>
</div>

<a href="page_saisie_donnees.php">Ajouter un Nouveau Projet</a>

</body>
</html>
