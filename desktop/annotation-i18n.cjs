(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AnnotationI18n=api;})(typeof window==='undefined'?{}:window,()=>{
 const keys=['Mover','Caneta','Laser','Texto','Borracha','Desfazer','Limpar','Voltar a clicar','para voltar a clicar na tela','Tamanho do texto','Ferramentas de anotação','Cores de anotação','Arrastar ferramentas','Texto da anotação','Vermelho','Laranja','Amarelo','Verde','Turquesa','Azul','Roxo','Rosa','Preto','Branco'];
 const translations={
 en:['Move','Pen','Laser','Text','Eraser','Undo','Clear','Click through','to click the screen again','Text size','Annotation tools','Annotation colors','Drag tools','Annotation text','Red','Orange','Yellow','Green','Teal','Blue','Purple','Pink','Black','White'],
 es:['Mover','Lápiz','Láser','Texto','Borrador','Deshacer','Limpiar','Volver a hacer clic','para volver a hacer clic en la pantalla','Tamaño del texto','Herramientas de anotación','Colores de anotación','Arrastrar herramientas','Texto de la anotación','Rojo','Naranja','Amarillo','Verde','Turquesa','Azul','Morado','Rosa','Negro','Blanco'],
 fr:['Déplacer','Stylo','Laser','Texte','Gomme','Annuler','Effacer','Cliquer à nouveau','pour cliquer à nouveau sur l’écran','Taille du texte','Outils d’annotation','Couleurs d’annotation','Déplacer les outils','Texte de l’annotation','Rouge','Orange','Jaune','Vert','Turquoise','Bleu','Violet','Rose','Noir','Blanc']
 };
 function t(key,language=typeof navigator==='undefined'?'pt':navigator.language){const locale=language.split('-')[0],index=keys.indexOf(key);return translations[locale]?.[index]||key;}
 return {t};
});
