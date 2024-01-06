<?php
session_start();

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Définissez les informations de connexion à la base de données
$serveur = "127.0.0.1:3306";
$nom_utilisateur = "u559440517_wissem";
$mot_de_passe = "Wisshafa69-";
$nom_base_de_donnees = "u559440517_wedevcommandes";


if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $username = $_POST["nom_utilisateur"];
    $password = $_POST["mot_de_passe"];

    // Connexion à la base de données
    $mysqli = new mysqli($serveur, $nom_utilisateur, $mot_de_passe, $nom_base_de_donnees);

    if ($mysqli->connect_error) {
        die("Erreur de connexion à la base de données: " . $mysqli->connect_error);
    }

    // Vérifiez les informations de connexion depuis votre base de données
    // Remplacez 'votre_table_utilisateurs' par le nom de votre table d'utilisateurs
    $query = "SELECT * FROM users WHERE nom_utilisateur = ? AND mot_de_passe = ?";
    $stmt = $mysqli->prepare($query);
    $stmt->bind_param("ss", $username, $password);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 1) {
        // L'authentification a réussi, générez un token d'authentification et stockez-le en session
        $_SESSION["username"] = $username;
        header("Location: page_accueil.php");
        exit();
    } else {
        // L'authentification a échoué, affichez un message d'erreur
        $error_message = "Nom d'utilisateur ou mot de passe incorrect.";
    }

    $stmt->close();
    $mysqli->close();
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page de Connexion</title>
</head>
<body>

<h2>Connexion</h2>

<?php
if (isset($error_message)) {
    echo "<p style='color: red;'>$error_message</p>";
}
?>

<form method="post" action="<?php echo htmlspecialchars($_SERVER["PHP_SELF"]); ?>">
    <label for="nom_utilisateur">Nom d'utilisateur:</label>
    <input type="text" id="nom_utilisateur" name="nom_utilisateur" required><br>

    <label for="mot_de_passe">Mot de passe:</label>
    <input type="password" id="mot_de_passe" name="mot_de_passe" required><br>

    <button type="submit">Se Connecter</button>
</form>

</body>
</html>
