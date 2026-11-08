/* Retrieved 2026-11-08. Labels remain product-specific, not cuisine-wide averages.
 * Same row schema as regional-foods.cjs; final optional string is the portion label.
 * Weighed portions are PULS quantity aids, never claims about an unknown piece weight.
 * Recipe estimates retain the preparation described by the publisher.
 * Fried sucuk omitted: no adequately traceable preparation/yield data found.
 */
module.exports=[
 {group:'sucuk',source:'Çiftliket · Etikett-Richtwert',url:'https://www.ciftliket.com/dana-izgara-sucuk',rows:[
  ['roh','Sucuk, ungebraten (Çiftliket)','sucuk sujuk sudzuk sudžuk Knoblauchwurst raw beef sausage',100,372,24.68,0.61,30.6,50,'Gewogene Portion (selbst wiegen)']
 ]},
 {group:'adana',source:'Akser USTA · Etikett-Richtwert',url:'https://akserfood.de/portfolio_page/usta-adana-kebap/',rows:[
  ['usta','Adana Kebab, unzubereitet (Akser USTA)','adana kebap spicy beef lamb minced meat skewer roh',100,256,16.3,9.8,17.6,100,'Gewogene Portion (selbst wiegen)']
 ]},
 {group:'durum-kalb',source:'REWE / Mangal Poldi · Etikett-Richtwert',url:'https://www.rewe.de/shop/p/mangal-doener-poldis-dueruem-to-go-kalb-300g/7392118',rows:[
  ['mangal','Dürüm Döner Kalb (Mangal Poldi)','durum dueruem döner doner doener veal wrap yufka',100,228,7.8,23,12,300,'Dürüm / Packung (300 g)']
 ]},
 {group:'durum-huhn',source:'SLIMFIT · Rezept-Richtwert',url:'https://www.slimfit.net/kalori/tavuk-doner-durum.html',rows:[
  ['pommes','Dürüm Döner Hähnchen mit Pommes und Mayonnaise','durum dueruem döner doner doener chicken tavuk dürüm yufka',100,227,12,18,11.6,300,'Dürüm (ca.)']
 ]},
 {group:'doenerteller',source:'Nutrola · Rezept-Richtwert',url:'https://nutrola.app/de/blog/kalorien-in-doener-kebab-schnitzel-bratwurst-currywurst',rows:[
  ['ohne-brot','Döner-Teller ohne Brot','döner teller doner doener kebab plate without bread',400,520,40,38,25,400,'Teller (ca.)']
 ]},
 {group:'lepinja',source:'BILLA / Don Don · Etikett-Richtwert',url:'https://shop.billa.at/produkte/grillbrot-lepinja-00734001',rows:[
  ['dondon','Lepinja / Somun, Fladenbrot (Don Don)','lepinja somun Balkan flatbread grillbrot',100,231,7.8,46,1.1,200,'Fladenbrot / Stück (200 g)']
 ]},
 {group:'kiflice',source:'Lidl HR · Etikett-Richtwert',url:'https://www.lidl.hr/p/zlatna-kiflica/p4854',rows:[
  ['zlatna','Kiflice, Mais-Mischgebäck (Lidl Zlatna kiflica)','kiflice kiflica zlatna corn wheat rolls hoernchen hörnchen',100,346,8.6,56.1,9.6,100,'Gewogene Portion (selbst wiegen)']
 ]}
];
