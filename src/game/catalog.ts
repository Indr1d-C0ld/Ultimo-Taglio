export interface Article {
  id: string;
  title: string;
  kicker: string;
  body: string[];
}

export const DISCLAIMER =
  "Archivio di scena. Ogni pezzo è un oggetto di finzione, scritto per somigliare ai film: nomi, percorsi e «metodi» valgono solo dentro questo copione. Non descrivono ordigni reali, né come si costruiscono, né come si neutralizzano fuori da un set.";

export const ARTICLES: Article[] = [
  {
    id: "regole",
    title: "Come si legge una scena",
    kicker: "Protocollo",
    body: [
      "Il cinema ha insegnato una bugia comoda: il rosso è sempre quello giusto, o sempre quello sbagliato. Qui il colore è un costume. Due fili possono vestirsi uguale e andare in posti opposti.",
      "Si risolve seguendo i morsetti, non il colore. L'INNESCO di scena è il tubo rosso etichettato come tale. La linea dell'INIBITORE va dal morsetto INIBITORE a BAT −: finché resta chiusa, il copione non si ferma. Una TRAPPOLA è ogni tratto che sta su un percorso da BAT + all'INNESCO, anche se si spezza su un giunto. Un'ESCA è tutto il resto: ritorni morti, rami ciechi, percorsi che sembrano veri ma non conducono.",
      "Ogni seme ricabla l'ordigno da capo: quanti giunti, quali rami, dove passa la linea. Nessun morsetto dice da solo qual è il filo giusto. La scheda mostra i capi di un filo solo dopo che li hai misurati.",
      "Si vince quando fra INIBITORE e BAT − non resta nessuna strada. Se la linea ha due rami in parallelo, servono due tagli. La scena è sempre risolvibile misurando i tratti uno per uno.",
      "L'orbita, lo zoom e il pan muovono la camera. Il maneggio muove l'oggetto. Solo il secondo può far rotolare il grano d'inclinazione.",
    ],
  },
  {
    id: "integrazione",
    title: "Integrazione dei moduli",
    kicker: "Schema",
    body: [
      "Cella di palco: il polo positivo alimenta il timer e, nelle scene lunghe, parte verso un giunto. Dal giunto un tratto continua all'innesco e un altro, spesso dello stesso colore, muore su un morsetto del bus. Tagliare l'alimentazione spegne il display LCD. Il tempo, da copione, continua al buio.",
      "Condensatore di scena: finché è carico, COND + è vincolato a BAT +. Il CARICO FITTIZIO assorbe la scarica in un clic da studio. Se tagli l'alimentazione mentre quel vincolo è ancora chiuso, la scarica di copione finisce sull'innesco.",
      "Relè del codice: sta in parallelo alla linea dell'inibitore, fra INIBITORE e BAT −. Finché il codice non è accettato, nessun taglio apre nulla. A relè aperto, la continuità passa solo dai fili.",
      "Codice: quattro cifre, e nessuna si scrive da sola. Prima sotto UV, da qualche parte sul guscio. Seconda, i lampi del cluster, contati a occhio. Terza, i battiti dell'antenna con lo stetoscopio, oppure la riga CIAK sul piatto se l'antenna non c'è. Quarta = numero di fili meno numero di trappole, ultima cifra del risultato. Le trappole sono i segmenti che portano davvero corrente da cella a innesco: perle girate e anime interrotte le tolgono dal conto.",
      "Il piatto inciso mente negli imperativi («taglia il rosso»). Dice la verità nella formula e, se presente, nella riga CIAK.",
    ],
  },
  {
    id: "timer",
    title: "Timer LCD",
    kicker: "Modulo",
    body: [
      "Il display a sette segmenti è il cliché che tiene la scena. In ripresa scende davvero. In prova generale resta fermo, per studiare.",
      "Sotto i dieci secondi il bip sale di tono. Se l'alimentazione viene tagliata a condensatore già scarico, il vetro si spegne ma il conteggio no: lo leggi ancora nel bordo dello schermo.",
      "Un'antenna non zittita ruba secondi a intervalli: più spesso e più a fondo man mano che la parte si fa importante. Il contatore B, se ignorato oltre metà tempo, ne brucia venticinque in un colpo.",
      "Dalla caratterista in su il timer può avere un secondo morsetto, CLOCK, con il filo del quarzo. È il cliché del taglio che peggiora tutto: aprirlo non ferma il conto, lo fa correre al doppio fino a fine scena. Il multimetro lo riconosce; il taccuino lo segna QUARZO.",
      "Dalla caratterista in su, a volte, l'innesco ha un terzo morsetto marcato TEST. Non collauda niente: alimenta un secondo timer nascosto sotto l'innesco. È il cliché del falso finale: apri la linea, il display si ferma, e dopo un attimo di silenzio parte un altro conteggio, corto. Lo ferma solo il filo del TEST. Chi lo misura prima lo taglia quando vuole, senza rischi; chi non l'ha cercato ha una manciata di secondi per trovarlo.",
      "Le durate sono tarate su chi fa tutto come da copione: ogni guardia, ogni cifra trovata di persona, ogni filo misurato. In comparsa c'è tempo per imparare. In caratterista ne avanza a chi ha la mano sicura. In protagonista non ne avanza quasi.",
    ],
  },
  {
    id: "fili",
    title: "Fili e gemelli",
    kicker: "Modulo",
    body: [
      "Sei ruoli, mai scritti sull'isolante: sicura (un tratto della linea INIBITORE → BAT −), trappola (segmento fra cella e innesco), esca (tutto ciò che non porta corrente utile), alimentazione (cella verso timer), senso (antenna verso cluster), quarzo (dal morsetto CLOCK del timer: tagliato, raddoppia la corsa del conto).",
      "I percorsi passano dai giunti. Due fili possono uscirne vestiti uguale: uno continua, l'altro è un ramo cieco. Una perla gialla sul filo conduce in un verso solo: se guarda dalla parte sbagliata, quel percorso è finto e i suoi tratti sono esche.",
      "Dalla caratterista in su un filo può avere l'anima interrotta sotto l'isolante. A vista è intero; il multimetro, sui suoi due capi, legge aperto. Un percorso che passa da lì non esiste: conta come esca, anche quando sembra una trappola o un secondo ramo della linea.",
      "La linea non si lascia aprire finché il relè del codice è chiuso in parallelo, il condensatore è ancora sulla cella, o la copertura è giù. Il primo taglio forzato non interrompe la linea e costa secondi. Il secondo chiude la scena.",
      "Le esche si possono tagliare: il percorso da BAT + all'INNESCO non le usa, ed è proprio il punto.",
    ],
  },
  {
    id: "pressione",
    title: "Microswitch di copertura",
    kicker: "Guardia",
    body: [
      "SW-A e SW-B stanno sulla chiusura, fuori. Sono il cliché della valigetta che non va aperta di slancio. Un ponticello fra i due tiene aperto il contatto di scena.",
      "Il cacciavite sulle chiusure, senza quel ponticello, fa scattare il finale. Con il ponticello, il coperchio, la calotta o il vetro si alza e scopre il banco.",
      "I morsetti interni non si toccano a copertura chiusa. L'antenna e il piatto, spesso, sì.",
    ],
  },
  {
    id: "condensatore",
    title: "Condensatore di scena",
    kicker: "Modulo",
    body: [
      "Cilindro con banda ambra e, accanto, un blocchetto marcato CARICO FITTIZIO. Non è un componente da laboratorio vero: è il «prima scarica, poi taglia» dei thriller.",
      "Multimetro fra COND + e BAT +: stesso nodo, finché non scarichi. Fra COND + e CARICO: aperto, ed è lì che va il ponticello. Fra COND + e INNESCO il misuratore può vedere un giro attraverso la cella; un ponticello diretto, comunque, chiude la scena.",
      "Ponticello fra COND + e INNESCO, o fra BAT + e INNESCO: finale immediato. Il multimetro, su quella coppia, lo dice prima.",
    ],
  },
  {
    id: "innesco",
    title: "Innesco e inibitore",
    kicker: "Modulo",
    body: [
      "L'innesco di scena è un tubo in una staffa, con due morsetti a vista: INNESCO e INIBITORE. Dentro, un ponte di copione: un filo che si accende se la cella lo raggiunge. Non è un componente vero e non ha una soglia da laboratorio.",
      "A riposo il ponte sta basso. Se il condensatore è ancora carico, il minimo è più alto: la scarica di scena lo tiene tiepido. L'inibitore, finché il filo è intero, gli impedisce di correre. Tagliare una trappola, o ponticellare il tubo, non lo scalda: chiude la scena subito.",
      "Forzare l'inibitore con una guardia ancora aperta ferisce il ponte. Da lì sale da solo, circa nove secondi fino a saturazione. Si raffredda solo sistemando la guardia che l'ha ferito: scaricare il condensatore, o aprire il relè del codice. Un secondo tentativo forzato non aspetta la salita.",
      "Il multimetro, su INNESCO o INIBITORE, legge la percentuale. I due morsetti del tubo non si parlano fra loro. Un ping dell'antenna, se il ponte è già in salita, gli dà una spinta. Non si smonta il tubo.",
    ],
  },
  {
    id: "codice",
    title: "Tastierino",
    kicker: "Guardia",
    body: [
      "Quattro cifre, poi OK. Giusto: lo sportello sulla sicura si ritrae e l'antenna, se c'era, smette di rubare tempo. Sbagliato: il codice si cancella e la ripresa perde dieci secondi.",
      "Le cifre non stanno mai tutte nello stesso posto e vanno lette di persona. La lampada UV spegne le luci di scena e fa brillare una cifra dipinta sul guscio: può stare su un fianco, dietro, sul fondo o, nella valigetta, sotto la base: lì la camera non arriva, e va sollevata con il maneggio. Va cercata girandoci intorno.",
      "Il taccuino del codice, nella scheda, ha quattro caselle: le riempi tu man mano. Il suggeritore, a pagamento di secondi, regala una cifra per volta.",
      "Puoi comporre dal dossier anche se il vetro è ancora chiuso. Lo sportello fisico, però, libera il filo solo quando il banco è aperto e le altre guardie sono a posto.",
    ],
  },
  {
    id: "tilt",
    title: "Grano d'inclinazione",
    kicker: "Rischio",
    body: [
      "Un tubetto di vetro, una pallina da film. Se maneggi l'ordigno oltre la tacca, la pallina chiude il contatto di scena.",
      "La camera può girarci intorno quanto vuole: l'assetto dell'oggetto non cambia. Il maneggio, invece, è la mano sul prop. Prima si serra la vite di blocco con la brugola, poi si inclina. La mano la solleva finché tieni premuto e la riposa quando lasci: serve a guardare sotto la base.",
      "La vista esplosa scosta i moduli senza ruotare il banco: non sveglia il grano. In comparsa, spesso, il grano non è nemmeno in scena.",
    ],
  },
  {
    id: "antenna",
    title: "Ricevitore di copione",
    kicker: "Modulo",
    body: [
      "Un'antenna che batte una cifra, la terza del codice. A orecchio nudo tace: con lo stetoscopio sul ricevitore si sentono i battiti e la spia li segue. Tanti battiti, una pausa, e di nuovo: l'ascolto dura due giri.",
      "Finché il codice non è inserito, un ping ruba secondi. Tagliare il filo di senso zittisce anche il cluster: fallo solo dopo aver contato i lampi, se ti serve ancora la seconda cifra.",
      "Se la scena non ha antenna, la terza cifra è la riga CIAK sul piatto. Le altre righe imperative sono bugie da locandina.",
    ],
  },
  {
    id: "cluster",
    title: "Cluster di lampeggi",
    kicker: "Modulo",
    body: [
      "Una fila di spie che corre e si ferma. Il numero di lampi fra una pausa e l'altra è la seconda cifra. Si contano a vista: conviene ispezionare il cluster da vicino.",
      "Il filo di senso lo alimenta. Tagliato, le spie muoiono. Se non avevi ancora la cifra, ti resta solo un suggerimento.",
    ],
  },
  {
    id: "contatore",
    title: "Contatore B",
    kicker: "Opzionale",
    body: [
      "Tre ruote, solo nelle scene da protagonista. Non blocca il taglio. Se a metà tempo non è allineato, brucia venticinque secondi.",
      "Da sinistra: numero di fili-esca, prima cifra (UV), seconda cifra (cluster). Le esche sono i ritorni morti e i rami ciechi: il multimetro non li mette fra BAT + e l'INNESCO.",
    ],
  },
  {
    id: "strumenti",
    title: "Strumenti di mano",
    kicker: "Banco",
    body: [
      "La borsa è divisa in mano, misura e banco. Ogni pezzo del prop vuole il suo attrezzo: chiusure il cacciavite, grano la brugola, fili la tronchese, battiti lo stetoscopio, guardie i coccodrilli.",
      "Le pinzette staccano un ponticello. Se la copertura è già aperta e togli i coccodrilli dal microswitch, il contatto chiude la scena.",
      "Il nastro giallo segna un filo già misurato: non cambia il circuito, tiene la memoria quando i colori si ripetono.",
      "La pila di servizio è una sola. Riaccende il display se hai tagliato l'alimentazione a condensatore già scarico. Il filo resta aperto.",
      "Sotto i quindici secondi il vetro pulsa e l'ordigno trema in mano. L'antenna, se non è zittita, avvisa il ping prima di rubare secondi.",
      "Quattro suggerimenti. In ripresa ognuno costa diciotto secondi.",
    ],
  },
  {
    id: "archetipi",
    title: "Tre carrozzerie",
    kicker: "Scena",
    body: [
      "Valigetta del regista: il vetro sul tempo, le chiusure davanti, il piatto in facciata. È l'inquadratura che il pubblico riconosce prima ancora del dialogo.",
      "Cilindro di scena: tubo fresato in culla, calotta che si alza, moduli sul piano lavorato. Sembra un pezzo d'officina, resta un attrezzo da troupe.",
      "Console da regia: cuneo inclinato, vetro di plancia, lo stesso banco logico con un'altra silhouette. La procedura non cambia col vestito: cambiano solo coperchio e ombre.",
    ],
  },
];

export const DIFFICULTY_COPY: Record<
  string,
  { label: string; text: string }
> = {
  comparsa: {
    label: "Comparsa",
    text: "Pochi fili, colori unici, niente perle. La linea dell'inibitore passa da un giunto: va trovata, non letta su un'etichetta.",
  },
  caratterista: {
    label: "Caratterista",
    text: "Gemelli di colore, perle di senso, un percorso che forse è finto e fili con l'anima interrotta.",
  },
  protagonista: {
    label: "Protagonista",
    text: "Due strade verso l'innesco, due rami sulla linea. A volte basta un taglio, a volte ne servono due.",
  },
};
