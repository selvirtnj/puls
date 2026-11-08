/* Reference transcription, retrieved 2026-11-08. Nutritional estimates, not lab results.
 * Turkish rows: published 100 g tables reviewed by dietitian Şeyda Ertaş:
 * https://www.dytseydaertas.com/besin/<slug>
 * Balkan rows: published recipe calculations (March 2026):
 * https://www.fitkofer.rs/kalorije-srpskih-jela
 * FitKofer gives kcal/P/C/F per weighed serving; divide by serving grams.
 * Neither reference establishes a universal recipe. Portion weights are approximate.
 * No micronutrients are imported. Brand-specific references retain their brand.
 * [slug, German name, search aliases, reference grams, kcal, P, C, F, portion grams]
 */
const turkish = [
 ['peynirli-pide','Pide mit Käse','peynirli cheese Turkish flatbread',100,245,10,32,9,104.1],
 ['kiymali-pide','Pide mit Hackfleisch','kıymalı kiymali minced meat Turkish flatbread',100,209,8.2,24.48,8.52,170.3],
 ['kiymali-borek','Börek mit Hackfleisch','borek boerek kıymalı kiymali minced meat pastry',100,248,9.2,28.83,10.39,100],
 ['peynirli-borek','Börek mit Käse','borek boerek peynirli cheese pastry',100,259,10.11,33.48,9.14,150.2],
 ['ispanakli-borek','Börek mit Spinat','borek boerek ıspanaklı ispanakli spinach pastry',100,220,6.5,27,9.5,134.1],
 ['izgara-kofte','Köfte, gegrillt','kofte koefte izgara Turkish meatballs',100,167,14.23,4.27,10.09,119.8],
 ['urfa-kebap','Urfa Kebab','kebap grilled minced meat skewer',100,183,15.38,1.64,11.88,216.9],
 ['menemen','Menemen, Eier mit Tomaten und Paprika','Turkish eggs tomatoes peppers',100,71,3.52,3.39,4.79,249.3],
 ['mercimek-corbasi','Mercimek Çorbası, türkische Linsensuppe','mercimek corbasi chorbasi lentil soup',100,46,2.46,8.28,0.2,297.8],
 ['bulgur-pilavi','Bulgur Pilavı, zubereitet','pilavi pilaw cooked bulgur pilaf',100,121,3,18.5,4,129.8],
 ['iskender-kebap','Iskender Kebab mit Brot, Joghurt und Sauce','İskender kebap doner döner doener yogurt bread',100,220,13,14,12.5,343.2],
 ['kunefe','Künefe, Käse-Kadayif mit Sirup','kunefe kuenefe kanafeh cheese syrup dessert',100,355,6.13,45.75,17.1,120],
 ['ispanakli-gozleme','Gözleme mit Spinat','gozleme goezleme ıspanaklı ispanakli spinach flatbread',100,220,7.5,28,8.5,287.7],
 ['manti','Mantı, zubereitet','manti mantı Turkish dumplings teigtaschen',100,220,9.5,28,7.5,146.8],
 ['ezogelin-corbasi','Ezogelin Çorbası, Linsen-Bulgur-Suppe','ezogelin corbasi chorbasi lentil bulgur soup',100,68,3.2,9.5,1.8,139.7],
 ['cacik','Cacık, Joghurt mit Gurke','cacik yogurt cucumber',100,41,2.04,3.15,2.12,null],
 ['kisir','Kısır, türkischer Bulgursalat','kisir bulgur salad',100,162,4.18,28.81,3.41,109.9],
 ['icli-kofte','İçli Köfte, gefüllte Bulgurklöße','icli kofte koefte kibbeh stuffed bulgur',100,233,9.87,32.28,6.83,null],
 ['susamli-simit','Simit, Sesamring','susamli sesame bread ring',100,284,10,52,5.5,109.2],
 ['komagene-cig-kofte','Çiğ Köfte, fleischlos (Komagene)','cig kofte koefte çiğ köfte etsiz vegan bulgur',100,234,5.4,32,8.7,200],
 ['patatesli-gozleme','Gözleme mit Kartoffeln','gozleme goezleme patatesli potato flatbread',100,210,5.5,32,6.5,327.6],
 ['patatesli-borek','Börek mit Kartoffeln','borek boerek patatesli potato pastry',100,272,5.69,35.83,11.57,200],
 ['su-boregi','Su Böreği, Käse-Teigauflauf','su boregi börek borek cheese water borek',100,270,9,30,13,280],
 ['sigara-boregi','Sigara Böreği, gefüllte Teigröllchen','sigara boregi börek borek fried cheese rolls',100,311,9.47,33.98,15.14,60.1],
 ['mercimek-koftesi','Mercimek Köftesi, Linsen-Bulgur-Bällchen','mercimek koftesi kofte köfte lentil bulgur balls',100,165,5.2,20.5,6,175.8],
 ['karniyarik','Karnıyarık, Aubergine mit Hackfleisch','karniyarik stuffed aubergine eggplant minced meat',100,135,6.5,7.5,8.5,141.5]
];
const balkan = [
 ['cevapi','Ćevapi, gegrillt, ohne Brot','cevapi cevapcici ćevapčići cevapčići grilled meat',250,550,36,1,44,25],
 ['pljeskavica','Pljeskavica, ohne Brot','Balkan beef patty grilled meat',200,480,30,4,38,200],
 ['gurmanska-pljeskavica','Gurmanska Pljeskavica, ohne Brot','gourmet Balkan meat patty',280,620,35,6,50,280],
 ['sarma','Sarma, Sauerkrautrouladen mit Fleisch und Reis','kiseli kupus cabbage rolls meat rice',350,420,22,28,24,350],
 ['duvec','Đuveč mit Fleisch','duvec djuvec đuveč rice vegetables meat',350,380,22,35,16,350],
 ['burek-meso','Burek mit Fleisch','burek meso meat pastry Balkan pita',250,650,22,38,42,250],
 ['burek-sir','Burek mit Käse (Sirnica)','burek sir sirnica cheese pastry Balkan pita',250,615,20,53,35,250],
 ['zeljanica','Pita Zeljanica, Spinat-Käse-Pastete','zeljanica spinach cheese pie',200,380,14,30,22,200],
 ['krompirusa','Pita Krompiruša, Kartoffelpastete','krompirusa krompiruša potato pie',200,360,8,36,20,200],
 ['pasulj-kobasica','Pasulj mit Wurst','pasulj grah kobasica bean stew sausage',400,450,24,38,22,400],
 ['pasulj-posni','Pasulj, ohne Fleisch','pasulj grah posni bean stew meatless',350,280,14,42,4,350],
 ['punjene-paprike','Punjene paprike, Paprika mit Fleisch und Reis','stuffed peppers meat rice',350,380,20,30,18,350],
 ['sopska-salata','Šopska salata, Gemüse-Käse-Salat','sopska shopska salata salad cheese',250,180,6,12,12,250],
 ['kajmak','Kajmak, jung','mladi kaymak clotted cream',50,180,4,1,18,50],
 ['urnebes','Urnebes, pikanter Käseaufstrich','spicy cheese spread paprika',80,220,6,4,20,80],
 ['tufahija','Tufahija, mit Walnüssen gefüllter Apfel','tufahije walnut stuffed apple dessert',260,480,6,60,24,130],
 ['gibanica','Gibanica, Käse-Teig-Pastete','cheese egg filo pie Balkan',200,440,16,28,30,200],
 ['proja-sir','Proja mit Käse','proja sir cornbread cheese',150,420,11,38,23,150],
 ['pogaca','Pogača, Balkan-Brot','pogaca pogatscha bread',100,280,7,38,10,100],
 ['tarator','Tarator, kalte Gurken-Joghurt-Suppe','cucumber yogurt cold soup',250,140,4,8,10,250]
];
// Common German/Turkish/Balkan spellings must find both regional preparations.
for(const row of [...turkish,...balkan])if(/Börek|Böreği|Burek/.test(row[1]))row[2]+=' börek borek boerek burek';
module.exports={turkish,balkan};
