// Generated index comes from the folders in content/. See CONTENT.md.
const response = await fetch('./content-index.json', {cache:'no-store'});
if(!response.ok) throw Error('No se pudo cargar el catálogo');
export const {birds,source,revision} = await response.json();
export const uiSounds = {click:null,change:null};
