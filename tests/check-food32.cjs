/* Extend the real app regression harness with nutrition edge cases. */
const fs32=require('fs'),vm32=require('vm');
const existing32=fs32.readFileSync('tests/check-premium.cjs','utf8');
const extra32=String.raw`
run(fs.readFileSync('js/food-search.js','utf8'));run(fs.readFileSync('js/catalog-search.js','utf8'));run(fs.readFileSync('js/food-upgrade.js','utf8'));
assert.equal(run('parseLabelText("Energie 840 kJ / 200 kcal\\nFett 10 g\\ndavon gesättigte Fettsäuren 2 g\\nKohlenhydrate 20 g\\ndavon Zucker 8 g\\nEiweiß 7,5 g").p'),7.5);
assert.equal(run('parseLabelText("Eiweiss 8 g").p'),8);
assert.equal(run('parseLabelText("Protein < 0,5 g").p'),undefined);
assert.equal(run('parseLabelText("Fett 10 g 5 g\\nKohlenhydrate 20 g 10 g\\nProtein 8 g 4 g\\n200 kcal 100 kcal",1).kcal'),100);
assert.equal(run('parseLabelText("Fett 10 g 5 g",1).f'),5);
assert.equal(run('parseLabelText("Fett 10 g 20 %",1).f'),undefined);
assert.equal(run('parseLabelText("Brennwert 840 kJ").kcal'),undefined);
assert.equal(run('foodWarnings({kcal:200,p:10,c:20,f:9}).length'),0);
assert(run('foodWarnings({kcal:20,p:50,c:50,f:80}).length>=2'));
assert.equal(run('foodWarnings({kcal:0,p:0,c:0,f:0}).length'),0);
assert(run('foodWarnings({kcal:null,p:0,c:0,f:0}).length'));
assert.equal(run('uniqueFoods([{name:"Milch",unit:"ml",kcal:50,p:3,c:5,f:2,source:"BLS"},{name:"Milch",unit:"ml",kcal:50,p:3,c:5,f:2,source:"USDA"}]).length'),1);
assert.equal(run('uniqueFoods([{name:"Reis roh",kcal:350,p:7,c:75,f:1},{name:"Reis gekocht",kcal:120,p:3,c:25,f:1}]).length'),2);
assert.equal(run('mapOffProduct({serving_size:"1 Scheibe (30 g)",nutriments:{}},"1").portions[0].amount'),30);
assert.equal(run('mapOffProduct({serving_size:"1 Stück",nutriments:{}},"1").portions'),undefined);
assert.equal(run('parseFoodLine("zwei Eier").count'),2);
assert.equal(run('parseFoodLine("ein Brot").query'),"Brot");
assert.equal(run('parseFoodLine("200 g Skyr").amount'),200);
assert.equal(run('foodPortions({unit:"ml",portions:[{name:"EL",amount:10,unit:"g"}]}).length'),0);
run('state.custom.push({id:"favorite32",name:"Food",kcal:10,p:1,c:1,f:0,favorite:true,portions:[{name:"Stück",amount:30,unit:"g"}]})');
assert(run('validData(JSON.parse(JSON.stringify(state)))'));run('state.custom.at(-1).portions[0].amount=-1');assert(!run('validData(state)'));run('state.custom.at(-1).portions[0].amount=30');
console.log('PASS: OCR columns, missing values, German labels, EU macro plausibility, safe duplicates, source portions, counted text and synchronized favorite validation');
`;
vm32.runInNewContext('(function(require){'+existing32+'\n'+extra32+'\n})(require)',{require,console},{filename:'food32-harness.cjs'});
