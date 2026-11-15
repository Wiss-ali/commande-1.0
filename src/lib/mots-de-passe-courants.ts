// Mots de passe refusés car trop courants. Liste locale : aucun service extérieur n'est appelé.
// On compare le mot de passe entier, en minuscules.
const LISTE = `
123456 1234567 12345678 123456789 1234567890 12345678910 0123456789 987654321 0987654321 123123123
111111 1111111 11111111 111111111 1111111111 000000 00000000 0000000000 121212 12121212 123321 654321
112233 11223344 1122334455 123654 147258369 159753 159357 741852963 102030 10203040 123abc abc123 abcd1234
1q2w3e 1q2w3e4r 1q2w3e4r5t 1qaz2wsx qazwsx qazwsxedc zaq12wsx q1w2e3r4 qwerty qwerty123 qwertyuiop
azerty azerty123 azertyuiop azerty1234 azertyui aqwzsx aqwzsxedc password password1 password12 password123
passw0rd p@ssw0rd p@ssword motdepasse motdepasse1 motdepasse123 mot2passe admin admin123 admin1234
administrateur administrator root toor user guest test test1234 demo welcome welcome1 bienvenue bonjour
bonjour123 salut soleil chocolat doudou loulou nicolas marseille iloveyou jetaime jetaime123 monamour
amour123 princesse secret letmein login master dragon monkey football superman batman shadow sunshine
trustno1 changeme changezmoi algerie algerie123 algeria algeria123 dzair dz123456 alger alger123 oran
oran123 constantine annaba setif hanout hanout123 magasin magasin123 boutique boutique123 commerce caisse
caisse123 vendeur vendeur123 mohamed mohamed123 mohammed ahmed ahmed123 fatima fatima123 amine amine123
yacine karim khaled bismillah allah allahakbar hamdoulilah inchallah mouloudia jsk123 usma1937 mca1921
zidane mahrez belmadi barcelona realmadrid juventus liverpool chelsea samsung iphone nokia google facebook
instagram whatsapp internet computer ordinateur telephone android 20202020 20212021 20222022 20232023
20242024 20252025 20262026 19901990 19951995 20002000 aaaaaaaa aaaaaaaaaa abcdefgh abcdefghij abcdefghijkl
aaaaaaaaaaaaaaa 123456789012345 012345678901234 111111111111111 000000000000000 qwertyuiopasdfg
azertyuiopqsdfg passwordpassword motdepassemotdepasse 1234567890123456 123456781234567
`;
export const COURANTS: ReadonlySet<string> = new Set(LISTE.split(/\s+/).filter(Boolean));
