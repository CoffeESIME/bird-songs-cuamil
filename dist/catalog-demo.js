// Los archivos demo no se atribuyen a las especies. Reemplazar rutas al verificar el material.
export const birds = [
 {id:'cardenal',name:'Cardenal rojo',scientific:'Cardinalis cardinalis',habitat:'Bosques y jardines',sample:1},
 {id:'chipe',name:'Chipe amarillo',scientific:'Setophaga petechia',habitat:'Matorrales y humedales',sample:2},
 {id:'colibri',name:'Colibrí garganta rubí',scientific:'Archilochus colubris',habitat:'Jardines y bordes de bosque',sample:3},
 {id:'mirlo',name:'Mirlo primavera',scientific:'Turdus migratorius',habitat:'Bosques y parques',sample:4},
 {id:'zanate',name:'Zanate mexicano',scientific:'Quiscalus mexicanus',habitat:'Ciudades y campos abiertos',sample:5}
].sort((a,b)=>a.name.localeCompare(b.name,'es')).map(b=>({...b,audio:null,demo:true,cutout:`media/cutout-${b.id}.png`,analysis:`media/sample-${b.sample}.json`,media:[{type:'video',src:`media/sample-${b.sample}.mp4`}],photos:[`media/sample-${b.sample}.jpg`,`media/detail-${b.sample}.jpg`,`media/photo-${b.sample}-3.jpg`,`media/photo-${b.sample}-4.jpg`]}));
export const uiSounds={click:null,change:null};
