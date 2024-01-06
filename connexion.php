<?php
session_start();

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Définissez les informations de connexion à la base de données
$db_server = "";
$db_username = "";
$db_password = "";
$db_name = "";

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $username = $_POST["nom_utilisateur"];
    $password = $_POST["mot_de_passe"];

    $mysqli = new mysqli($db_server, $db_username, $db_password, $db_name);

    if ($mysqli->connect_error) {
        die("Erreur de connexion à la base de données: " . $mysqli->connect_error);
    }

    $query = "SELECT mot_de_passe FROM users WHERE nom_utilisateur = ?";
    $stmt = $mysqli->prepare($query);
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 1) {
        $row = $result->fetch_assoc();
        $hashed_password = $row['mot_de_passe'];

        if (password_verify($password, $hashed_password)) {
            $_SESSION["username"] = $username;
            header("Location: page_accueil.php");
            exit();
        } else {
            $error_message = "Nom d'utilisateur ou mot de passe incorrect.";
        }
    } else {
        $error_message = "Nom d'utilisateur ou mot de passe incorrect.";
    }

    $stmt->close();
    $mysqli->close();
}
?>


<!DOCTYPE html>
<html lang="fr">
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
