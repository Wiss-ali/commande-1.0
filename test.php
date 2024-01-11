<?php
session_start();

// Vérifiez si l'utilisateur est connecté
if (!isset($_SESSION["nom_utilisateur"])) {
    header("Location: connexion.php");
    exit();
}

// Activation du rapport d'erreurs
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Informations de connexion à la base de données
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

// Traiter la demande de suppression
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['supprimer']) && isset($_POST["id_projet"])) {
    $stmt = $mysqli->prepare("DELETE FROM projets WHERE id = ?");
    $stmt->bind_param("i", $_POST["id_projet"]);
    $stmt->execute();

    if ($stmt->affected_rows > 0) {
        echo "<script>alert('Projet supprimé avec succès');</script>";
    } else {
        echo "<script>alert('Erreur lors de la suppression du projet');</script>";
    }

    $stmt->close();
    echo "<script>window.location = window.location.href;</script>";
}

// Récupération des projets
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
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page d'Accueil</title>
    <link rel="stylesheet" href="page_accueil.css">
    <script type="text/javascript">

    function confirmerDeconnexion() {
    var confirmation = confirm("Êtes-vous sûr de vouloir vous déconnecter ?");
    if (confirmation) {
        window.location.href = "deconnexion.php";
      }
    }

    </script>
</head>
<body>

<header>
    <div class="med2">
     <h1>COMMANDES</h1>

     <img src="logo.wiss.png" class="logo" alt="mon logo">
     
     <ul>
        <li><a href="#">Accueil</a></li>
        <li><a href="page_saisie_donnees.php">Nouvelle demande</a></li>
        <li><a href="#" onclick="confirmerDeconnexion()">déconnexion</a></li>
     </ul>
    </div>

    <div class="med1">
        <a href="page_saisie_donnees.php" class="icomob" ><img src="ajouter.png" alt="icone ajouer fichier" class="modif"></a>
        <a href="page_accueil.php"><img src="logo.wiss.png" class="logo" alt="mon logo"></a>
        <a a class="icomob" href="#" onclick="confirmerDeconnexion()"><img src="deconnecter.png" class="modif" alt="icone de deconnexion"></a>
    </div>
</header>

<h2>N'oublie pas de rendre tes commandes <?php echo htmlspecialchars($_SESSION["nom_utilisateur"]); ?>!</h2>
<h3>Liste des Projets (Page <?php echo $page_actuelle; ?>)</h3>

<div class="part2">
<ul>
    <?php
    for ($i = $indice_debut; $i < min($indice_fin, count($projets)); $i++) {
        $projet = $projets[$i];

        if ($projet["termine"]) {
            $classe_statut = "termine";
           } else {
            $classe_statut = "non-termine";
           }
        // Affichage des détails du projet
        echo "<li class='$classe_statut'>";
        echo "<strong>ID du Projet:</strong> " . htmlspecialchars($projet["id"]) . "<br>";
        echo "<strong>Nom du Client:</strong> " . htmlspecialchars($projet["nom"]) . "<br>";
        echo "<strong>Prénom du Client:</strong> " . htmlspecialchars($projet["prenom"]) . "<br>";
        echo "<strong>Terminé:</strong> " . ($projet["termine"] ? "Oui" : "Non") . "<br>";
        echo "<strong>Date de Demande:</strong> " . htmlspecialchars($projet["date_demande"]) . "<br>";
        echo "<strong>Demande du Client:</strong> <span class='demande-client'>" . htmlspecialchars($projet["demande"]) . "</span><br>";
        echo "<strong>Date de Livraison Prévue:</strong> " . htmlspecialchars($projet["date_livraison"]) . "<br>";

        echo "<form method='post' action=''>";
        echo "<input type='hidden' name='id_projet' value='" . htmlspecialchars($projet["id"]) . "'>";
        echo "<input type='checkbox' name='termine' value='1'" . ($projet["termine"] ? " checked" : "") . "> Marquer comme terminé";
        echo "<input type='submit' value='Enregistrer'>";
        echo "</form>";

        // Formulaire de suppression
        echo "<form method='post'>";
        echo "<input type='hidden' name='id_projet' value='" . htmlspecialchars($projet["id"]) . "'>";
        echo "<input type='submit' name='supprimer' value='Supprimer' onclick='return confirm(\"Êtes-vous sûr de vouloir supprimer ce projet ?\");'>";
        echo "</form>";
        echo "</li>";
    }
    ?>
</ul>
</div>

<div class="listep">
    <?php
    for ($page = 1; $page <= $nombre_de_pages; $page++) {
        echo "<a href='?page=$page'>$page</a> ";
    }
    ?>
</div>

</body>
</html>
