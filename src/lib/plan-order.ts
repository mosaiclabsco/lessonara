export function movePlan<T extends {id:string}>(plans:T[],id:string,direction:-1|1):T[]{
 const index=plans.findIndex(plan=>plan.id===id),next=index+direction;
 if(index<0||next<0||next>=plans.length)return plans;
 const ordered=[...plans];[ordered[index],ordered[next]]=[ordered[next],ordered[index]];return ordered;
}
