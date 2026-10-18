/* Geometry is independent of Electron so hit testing and laser fading can be tested. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AnnotationModel=api;})(typeof window==='undefined'?{}:window,()=>{
 function segmentDistance(point,start,end){const dx=end[0]-start[0],dy=end[1]-start[1],length=dx*dx+dy*dy;const t=length?Math.max(0,Math.min(1,((point[0]-start[0])*dx+(point[1]-start[1])*dy)/length)):0;return Math.hypot(point[0]-start[0]-t*dx,point[1]-start[1]-t*dy);}
 function hitStroke(points,x,y,radius=12){if(!points.length)return false;if(points.length===1)return Math.hypot(points[0][0]-x,points[0][1]-y)<=radius;return points.slice(1).some((point,index)=>segmentDistance([x,y],points[index],point)<=radius);}
 function laserSegments(points,now,lifetime=850){const visible=points.filter(point=>now-point.at>=0&&now-point.at<lifetime);return visible.slice(1).map((to,index)=>({from:visible[index],to,alpha:Math.pow(1-(now-visible[index].at)/lifetime,1.6)}));}
 return {segmentDistance,hitStroke,laserSegments};
});
